#!/usr/bin/env python3
"""
Issue Management Report Generator
===================================
Lê os CSVs brutos do Databricks + report da AWS QuickSight,
aplica toda a lógica de enriquecimento e gera o dashboard HTML final.

Uso:
    python scripts/generate_report.py

Inputs esperados em data/input/:
    - issues_raw.csv        (query Databricks de issues)
    - action_plans_raw.csv  (query Databricks de action plans)
    - npf_report.csv        (export da AWS QuickSight com lista de NP&Fs)

Config em data/config/:
    - people_mapping.csv    (mapeamento pessoa -> BU + BA)

Output:
    - output/dashboard.html
"""

import os
import sys
import re
import csv
import io
import math
from datetime import datetime, timedelta, date

# ─── Caminhos ────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR   = os.path.join(BASE_DIR, 'data', 'input')
CONFIG_DIR  = os.path.join(BASE_DIR, 'data', 'config')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'template')
OUTPUT_DIR  = os.path.join(BASE_DIR, 'output')

# ─── Configurações editáveis ──────────────────────────────────────────────────
# Nomes das BCOs (Business Control Officers) de Lending
BCO_NAMES = ['Christiane Belem', 'Ingrid Sgulmar']

# Coluna do report AWS que contém o número do NP&F no Jira (0-based)
# "coluna 17" da planilha = índice 16
NPF_LINK_COL_INDEX = 16

# Coluna que contém o código do issue no report AWS (0-based)
# Ajuste se o export da AWS tiver estrutura diferente
NPF_ISSUE_CODE_COL_INDEX = 0

# Janela de alerta: APs que vencem nos próximos N dias
ALERT_WINDOW_DAYS = 14

# ─── Utilitários ─────────────────────────────────────────────────────────────

def read_csv(path, **kwargs):
    """Lê um CSV e retorna lista de dicts."""
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, **kwargs)
        for row in reader:
            rows.append(dict(row))
    return rows

def read_csv_raw(path):
    """Lê CSV sem header, retorna lista de listas."""
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append(row)
    return rows

def parse_date(val):
    """Tenta parsear uma string de data para date object."""
    if not val or str(val).strip() in ('', 'null', 'None', 'nan'):
        return None
    val = str(val).strip()
    for fmt in ('%Y-%m-%d', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(val[:len(fmt.replace('%Y','0000').replace('%m','00')
                                           .replace('%d','00').replace('%H','00')
                                           .replace('%M','00').replace('%S','00'))],
                                     fmt).date()
        except:
            pass
    try:
        # fallback: apenas pegar os primeiros 10 chars
        return datetime.strptime(val[:10], '%Y-%m-%d').date()
    except:
        return None

def safe(val):
    """Retorna string vazia se valor for nulo."""
    if val is None:
        return ''
    s = str(val).strip()
    return '' if s in ('nan', 'None', 'null') else s

def first_name_from_list(val):
    """Extrai o primeiro nome de strings como '["Alice", "Bob"]' ou 'Alice, Bob'."""
    if not val:
        return ''
    cleaned = re.sub(r'[\[\]"\'\\]', '', str(val))
    names = [n.strip() for n in cleaned.split(',') if n.strip()]
    return names[0] if names else ''

def to_csv_string(rows, fieldnames):
    """Converte lista de dicts em string CSV."""
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fieldnames, extrasaction='ignore',
                            quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return out.getvalue()

# ─── Lógica de negócio ────────────────────────────────────────────────────────

def build_npf_mapping(npf_rows):
    """
    Constrói dict {issue_code: pnpf_link} a partir do export da AWS.
    O export pode ter ou não cabeçalho – tentamos detectar.
    """
    mapping = {}
    for row in npf_rows:
        if len(row) <= max(NPF_ISSUE_CODE_COL_INDEX, NPF_LINK_COL_INDEX):
            continue
        code = safe(row[NPF_ISSUE_CODE_COL_INDEX])
        link = safe(row[NPF_LINK_COL_INDEX])
        # Ignorar linhas de cabeçalho
        if code.lower() in ('code', 'issue_code', 'key', 'id', ''):
            continue
        if code and link:
            mapping[code] = link
    return mapping

def build_people_mapping(people_rows):
    """Constrói dict {nome: {bu, ba}} a partir do arquivo de configuração."""
    mapping = {}
    for row in people_rows:
        name = safe(row.get('name', ''))
        bu   = safe(row.get('bu', 'TBD'))
        ba   = safe(row.get('ba', 'TBD'))
        if name:
            mapping[name.lower()] = {'bu': bu, 'ba': ba}
    return mapping

def lookup_person(name, people_map):
    """Retorna (bu, ba) para uma pessoa. Caso não encontre, retorna ('TBD','TBD')."""
    if not name:
        return 'TBD', 'TBD'
    key = name.strip().lower()
    match = people_map.get(key)
    if match:
        return match['bu'], match['ba']
    # Tenta match parcial (primeiro + último nome)
    for k, v in people_map.items():
        parts_k = k.split()
        parts_n = key.split()
        if parts_k and parts_n and parts_k[0] == parts_n[0] and parts_k[-1] == parts_n[-1]:
            return v['bu'], v['ba']
    return 'TBD', 'TBD'

def build_ap_index(ap_rows):
    """
    Cria um índice {issue_code: [ap_row, ...]} para lookup rápido.
    Usa os últimos 7 chars da issue_link_projac como chave (= código do issue).
    """
    index = {}
    for row in ap_rows:
        link = safe(row.get('issue_link_projac', ''))
        # Extrai código do issue da URL (últimos 7 chars = e.g. I012319)
        code = link[-7:] if len(link) >= 7 else link.split('/')[-1]
        if not code:
            continue
        index.setdefault(code, []).append(row)
    return index

STATUS_PRIORITY = {
    'Late': 0,
    'Pending Approval (late)': 1,
    'Pending Validation (late)': 2,
    'In Validation': 3,
    'Pending Approval': 4,
    'Pending Validation': 5,
    'On Track': 6,
}

def best_ap(ap_list):
    """Retorna o AP mais urgente de uma lista."""
    def priority(row):
        status = safe(row.get('ap_status', ''))
        p = STATUS_PRIORITY.get(status, 99)
        due = parse_date(row.get('ap_due_date_at', ''))
        # Para On Track, prioriza o que vence primeiro
        due_ord = due.toordinal() if due else 99999
        return (p, due_ord)
    return min(ap_list, key=priority)

def get_bco_name():
    """Retorna o nome da BCO padrão. Pode ser tornado configurável."""
    return BCO_NAMES[0]  # Christiane Belem como padrão

def compute_action_issue(ap_status, ap_due_date_str, ap_assignee_raw,
                         origin, responsible_name, reporter_name, today):
    """
    Calcula (action, action_owner) para a aba de Issues.
    Regras conforme documentação do processo.
    """
    ap_status = safe(ap_status)
    assignee  = first_name_from_list(ap_assignee_raw) or safe(ap_assignee_raw)

    # Sem AP
    if not ap_status or ap_status in ('#N/A', 'TBD', 'nan'):
        return 'Create AP', safe(responsible_name)

    # Late
    if ap_status == 'Late':
        return 'AP Late: Replan/Complete AP', assignee

    # Pending Approval
    if ap_status in ('Pending Approval', 'Pending Approval (late)'):
        action = 'Complete AP Pending Approval'
        if safe(origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(reporter_name)

    # Pending Validation / In Validation
    if ap_status in ('Pending Validation', 'Pending Validation (late)', 'In Validation'):
        action = 'Complete AP Pending Validation'
        if safe(origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(reporter_name)

    # On Track
    if ap_status == 'On Track':
        due = parse_date(ap_due_date_str)
        if due and (due - today).days <= ALERT_WINDOW_DAYS:
            return 'AP will overdue < 2 weeks', assignee
        return 'AP On Track: Complete Before Due Date', assignee

    return '-', '-'

def compute_action_ap(ap_status, issue_origin, issue_reporter, ap_assignee_raw,
                      ap_due_date_str, today):
    """
    Calcula (action, action_owner) para a aba de Action Plans.
    """
    ap_status = safe(ap_status)
    assignee  = first_name_from_list(ap_assignee_raw) or safe(ap_assignee_raw)

    # In Validation
    if ap_status == 'In Validation':
        action = 'Complete AP Pending Validation'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    # Late
    if ap_status == 'Late':
        return 'AP Late: Replan/Complete AP', assignee

    # Pending Approval
    if ap_status in ('Pending Approval', 'Pending Approval (late)'):
        action = 'Complete AP Pending Approval'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    # Pending Validation
    if ap_status in ('Pending Validation', 'Pending Validation (late)'):
        action = 'Complete AP Pending Validation'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    # On Track
    if ap_status == 'On Track':
        due = parse_date(ap_due_date_str)
        if due and (due - today).days <= ALERT_WINDOW_DAYS:
            return 'AP will overdue < 2 weeks', assignee
        return 'AP On Track: Complete Before Due Date', assignee

    return '-', '-'

# ─── Pipeline principal ───────────────────────────────────────────────────────

def run():
    today = datetime.today().date()
    print(f"[generate_report] Data de referência: {today}")

    # 1. Carregar arquivos
    issues_path  = os.path.join(INPUT_DIR, 'issues_raw.csv')
    aps_path     = os.path.join(INPUT_DIR, 'action_plans_raw.csv')
    npf_path     = os.path.join(INPUT_DIR, 'npf_report.csv')
    people_path  = os.path.join(CONFIG_DIR, 'people_mapping.csv')

    for p in (issues_path, aps_path, people_path):
        if not os.path.exists(p):
            print(f"ERRO: arquivo não encontrado: {p}")
            sys.exit(1)

    print("[generate_report] Carregando issues...")
    issues_rows = read_csv(issues_path)

    print("[generate_report] Carregando action plans...")
    ap_rows = read_csv(aps_path)

    print("[generate_report] Carregando mapeamento de pessoas...")
    people_rows = read_csv(people_path)
    people_map  = build_people_mapping(people_rows)

    npf_mapping = {}
    if os.path.exists(npf_path):
        print("[generate_report] Carregando report NP&F da AWS...")
        npf_raw = read_csv_raw(npf_path)
        npf_mapping = build_npf_mapping(npf_raw)
        print(f"  -> {len(npf_mapping)} mapeamentos NP&F carregados")
    else:
        print("AVISO: npf_report.csv não encontrado. Type = 'Issue' para todos, NP&F = '-'")

    ap_index = build_ap_index(ap_rows)

    # ── 2. Enriquecer Issues ──────────────────────────────────────────────────
    print("[generate_report] Enriquecendo Issues...")
    issues_output = []
    tbd_people = set()

    ISSUES_FIELDS = [
        'Type', 'code', 'NP&F+', 'projac_link', 'key', 'status', 'summary',
        'countries', 'reporter_name', 'squad_reporter', 'created_at', 'updated_at',
        'due_date_at', 'completed_at', 'responsible_email', 'accountable_email',
        'process_journey_macroprocess__name', 'overall_risk_rating', 'origin',
        'subcategory', 'residual_risk_level', 'responsible_name', 'accountable_name',
        'business_units', 'Action', 'Action Owner', 'Action Pending From', 'Business Area'
    ]

    for row in issues_rows:
        code = safe(row.get('code', ''))

        # Type + NP&F
        issue_type, npf_link = ('Issue', '-')
        if code in npf_mapping:
            issue_type = 'Potential Issue'
            npf_link   = npf_mapping[code]

        # AP info
        ap_list = ap_index.get(code, [])
        if ap_list:
            best = best_ap(ap_list)
            ap_status   = safe(best.get('ap_status', ''))
            ap_assignee = safe(best.get('ap_assignee_names', best.get('ap_assignee_name', '')))
            ap_due      = safe(best.get('ap_due_date_at', ''))
        else:
            ap_status, ap_assignee, ap_due = '', '', ''

        # Action + Action Owner
        action, action_owner = compute_action_issue(
            ap_status, ap_due, ap_assignee,
            safe(row.get('origin', '')),
            safe(row.get('responsible_name', '')),
            safe(row.get('reporter_name', '')),
            today
        )

        # BU + BA do Action Owner
        primary_owner = first_name_from_list(action_owner) or action_owner
        bu, ba = lookup_person(primary_owner, people_map)
        if bu == 'TBD' and primary_owner not in ('-', ''):
            tbd_people.add(primary_owner)

        # Monta linha
        out = {k: safe(row.get(k, '')) for k in ISSUES_FIELDS}
        out['Type']               = issue_type
        out['NP&F+']              = npf_link
        out['Action']             = action
        out['Action Owner']       = action_owner
        out['Action Pending From'] = bu
        out['Business Area']      = ba
        issues_output.append(out)

    # ── 3. Enriquecer Action Plans ───────────────────────────────────────────
    print("[generate_report] Enriquecendo Action Plans...")
    aps_output = []

    APS_FIELDS = [
        'ap_code', 'ap_link_projac', 'ap_status', 'ap_country', 'issue_link_projac',
        'Issue Code', 'Type', 'issue rating', 'issue_status', 'issue_summary',
        'issue_due_date_at', 'issue_subcategory', 'ap_summary', 'ap_created_at',
        'ap_due_date_at', 'ap_business_unit', 'ap_assignee_name',
        'Action', 'Action Owner', 'Action Pending From', 'Business Area',
        'Issue Reporter', 'Issue Origin'
    ]

    # Índice de issues para lookup reverso
    issues_by_code = {safe(r.get('code', '')): r for r in issues_rows}

    for row in ap_rows:
        ap_code = safe(row.get('ap_code', ''))

        # Extrair código do issue da URL
        issue_link = safe(row.get('issue_link_projac', ''))
        issue_code = issue_link[-7:] if len(issue_link) >= 7 else issue_link.split('/')[-1]

        # Dados do issue pai
        parent = issues_by_code.get(issue_code, {})
        issue_origin   = safe(parent.get('origin', row.get('issue_origin', '')))
        issue_reporter = safe(parent.get('reporter_name', row.get('reporter_name', '')))
        issue_rating   = safe(parent.get('overall_risk_rating', ''))
        issue_type, _  = ('Issue', '-')
        if issue_code in npf_mapping:
            issue_type = 'Potential Issue'

        # Issue code coluna
        issue_code_col = f"I{issue_link[-6:]}" if issue_link else issue_code

        # Action + Action Owner
        ap_status = safe(row.get('ap_status', ''))
        ap_assignee = safe(row.get('ap_assignee_names', row.get('ap_assignee_name', '')))
        ap_due = safe(row.get('ap_due_date_at', ''))

        action, action_owner = compute_action_ap(
            ap_status, issue_origin, issue_reporter, ap_assignee, ap_due, today
        )

        # BU + BA
        primary_owner = first_name_from_list(action_owner) or action_owner
        bu, ba = lookup_person(primary_owner, people_map)
        if bu == 'TBD' and primary_owner not in ('-', ''):
            tbd_people.add(primary_owner)

        out = {k: safe(row.get(k, '')) for k in APS_FIELDS}
        out['Issue Code']          = issue_code_col
        out['Type']                = issue_type
        out['issue rating']        = issue_rating
        out['Issue Reporter']      = issue_reporter
        out['Issue Origin']        = issue_origin
        out['Action']              = action
        out['Action Owner']        = action_owner
        out['Action Pending From'] = bu
        out['Business Area']       = ba
        aps_output.append(out)

    # ── 4. Alertas de mapeamento incompleto ──────────────────────────────────
    if tbd_people:
        print(f"\nAVISO: {len(tbd_people)} pessoa(s) sem BU/BA no mapeamento:")
        for p in sorted(tbd_people):
            print(f"  -> {p}")
        print(f"  Adicione em: data/config/people_mapping.csv\n")

    # ── 5. Gerar CSV strings ──────────────────────────────────────────────────
    issues_csv_str = to_csv_string(issues_output, ISSUES_FIELDS)
    aps_csv_str    = to_csv_string(aps_output,
                                   [f for f in APS_FIELDS if f not in ('Issue Reporter', 'Issue Origin')])

    # ── 6. Injetar no template HTML ───────────────────────────────────────────
    template_path = os.path.join(TEMPLATE_DIR, 'dashboard_template.html')
    if not os.path.exists(template_path):
        print(f"ERRO: template não encontrado: {template_path}")
        sys.exit(1)

    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Escapa backticks no CSV para não quebrar o template literal JS
    issues_csv_escaped = issues_csv_str.replace('`', '\\`')
    aps_csv_escaped    = aps_csv_str.replace('`', '\\`')

    html = html.replace('%%ISSUES_CSV%%', issues_csv_escaped)
    html = html.replace('%%APS_CSV%%', aps_csv_escaped)

    # Adiciona timestamp de geração
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    html = html.replace('%%GENERATED_AT%%', ts)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, 'dashboard.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"\n✓ Dashboard gerado: {output_path}")
    print(f"  Issues processados : {len(issues_output)}")
    print(f"  APs processados    : {len(aps_output)}")
    print(f"\nAbra o arquivo no navegador ou publique no GitHub Pages.")

if __name__ == '__main__':
    run()
