#!/usr/bin/env python3
"""
Issue Management Report Generator
===================================
Busca dados diretamente do Databricks, aplica toda a lógica de
enriquecimento e gera o dashboard HTML final.

Uso:
    python scripts/generate_report.py

Credenciais em .env (raiz do projeto):
    DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
    DATABRICKS_TOKEN=dapi...
    DATABRICKS_WAREHOUSE_ID=3f3791356e419544

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
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, date

# ─── Caminhos ─────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR   = os.path.join(BASE_DIR, 'data', 'config')
TEMPLATE_DIR = os.path.join(BASE_DIR, 'template')
OUTPUT_DIR   = os.path.join(BASE_DIR, 'output')
ENV_PATH     = os.path.join(BASE_DIR, '.env')

# ─── Configurações editáveis ───────────────────────────────────────────────────
BCO_NAMES         = ['Christiane Belem', 'Ingrid Sgulmar']
ALERT_WINDOW_DAYS = 14
NPF_BASE_URL      = 'https://nubank.atlassian.net/browse/'
PROJAC_BASE_URL   = 'https://backoffice.ist.nubank.world/projac/#/im/issues/'

# ─── SQL Queries ──────────────────────────────────────────────────────────────

QUERY_ISSUES = """
SELECT
  i.code,
  i.key,
  i.status,
  i.summary,
  i.countries,
  i.reporter_name,
  i.squad_reporter,
  i.created_at,
  i.updated_at,
  i.due_date_at,
  i.completed_at,
  i.responsible_email,
  i.accountable_email,
  macroprocess.process_journey_macroprocess__name,
  i.overall_risk_rating,
  i.origin,
  i.subcategory,
  i.residual_risk_level,
  i.responsible_name,
  i.accountable_name,
  i.business_units,
  i.npf_keys,
  CONCAT('{projac_base}', i.code) AS projac_link
FROM ist__dataset.projac_issues i
LEFT JOIN etl.ist__contract.malhacao__process_journey_macroprocesses macroprocess
  ON i.macroprocess_id = macroprocess.process_journey_macroprocess__id
WHERE
  macroprocess.process_journey_macroprocess__name IN ('Global Lending', 'Secured Loans', 'Lending')
  OR array_contains(i.business_units, 'Global Lending')
""".format(projac_base=PROJAC_BASE_URL)

QUERY_APS = """
WITH
  action_plan_status_history AS (
    SELECT key, to_status AS last_status, timestamp
    FROM etl.br__dataset.jira_issues_status_history
    UNION ALL
    SELECT code AS key, status AS last_status, NULL AS timestamp
    FROM ist__dataset.projac_action_plans
  ),
  ranked_action_plan_status AS (
    SELECT key, last_status,
      ROW_NUMBER() OVER (PARTITION BY key ORDER BY timestamp DESC NULLS LAST) AS rn
    FROM action_plan_status_history
  ),
  latest_action_plan_status AS (
    SELECT key, last_status
    FROM ranked_action_plan_status
    WHERE rn = 1
  )
SELECT
  b.code      AS ap_code,
  CONCAT('{projac_base}', a.code, '/action-plan/', b.code) AS ap_link_projac,
  b.status    AS ap_status,
  b.countries AS ap_country,
  CONCAT('{projac_base}', a.code)                          AS issue_link_projac,
  a.status    AS issue_status,
  a.summary   AS issue_summary,
  a.due_date_at   AS issue_due_date_at,
  a.subcategory   AS issue_subcategory,
  b.summary       AS ap_summary,
  b.created_at    AS ap_created_at,
  b.due_date_at   AS ap_due_date_at,
  c.last_status   AS ap_last_status,
  b.business_unit AS ap_business_unit,
  b.assignee_names AS ap_assignee_name
FROM ist__dataset.projac_issues a
LEFT JOIN ist__dataset.projac_action_plans b
  ON (a.key = b.issue_key OR a.id = b.issue_id)
LEFT JOIN latest_action_plan_status c ON b.code = c.key
WHERE b.business_unit IN ('Global Lending', 'Secured Loans')
""".format(projac_base=PROJAC_BASE_URL)

# ─── Carregar .env ─────────────────────────────────────────────────────────────

def load_env(path):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env(ENV_PATH)

DATABRICKS_HOST         = os.environ.get('DATABRICKS_HOST', '').rstrip('/')
DATABRICKS_TOKEN        = os.environ.get('DATABRICKS_TOKEN', '')
DATABRICKS_WAREHOUSE_ID = os.environ.get('DATABRICKS_WAREHOUSE_ID', '')

# ─── Databricks API ────────────────────────────────────────────────────────────

def _db_request(path, method='GET', payload=None):
    url  = f"{DATABRICKS_HOST}{path}"
    data = json.dumps(payload).encode() if payload else None
    req  = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', f'Bearer {DATABRICKS_TOKEN}')
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Databricks API error {e.code}: {body}")

def db_run_query(sql):
    """Executa SQL no Databricks e retorna list[dict]."""
    result = _db_request('/api/2.0/sql/statements', 'POST', {
        'warehouse_id': DATABRICKS_WAREHOUSE_ID,
        'statement':    sql,
        'wait_timeout': '50s',
        'disposition':  'INLINE',
        'format':       'JSON_ARRAY',
    })

    # Poll se ainda rodando
    statement_id = result.get('statement_id')
    while result.get('status', {}).get('state') in ('PENDING', 'RUNNING'):
        print('  -> Aguardando Databricks...')
        time.sleep(4)
        result = _db_request(f'/api/2.0/sql/statements/{statement_id}')

    state = result.get('status', {}).get('state')
    if state != 'SUCCEEDED':
        err = result.get('status', {}).get('error', {})
        raise RuntimeError(f"Query falhou ({state}): {err.get('message', '')}")

    schema  = result.get('manifest', {}).get('schema', {})
    columns = [c['name'] for c in schema.get('columns', [])]
    rows    = result.get('result', {}).get('data_array', []) or []

    # Paginar se necessário
    next_chunk = result.get('result', {}).get('next_chunk_index')
    while next_chunk is not None:
        chunk      = _db_request(f'/api/2.0/sql/statements/{statement_id}/result/chunks/{next_chunk}')
        rows      += chunk.get('data_array', []) or []
        next_chunk = chunk.get('next_chunk_index')

    print(f'  -> {len(rows)} linhas')
    return [dict(zip(columns, [str(v) if v is not None else '' for v in row])) for row in rows]

# ─── Utilitários ───────────────────────────────────────────────────────────────

def parse_date(val):
    if not val or str(val).strip() in ('', 'null', 'None', 'nan'):
        return None
    val = str(val).strip()[:10]
    try:
        return datetime.strptime(val, '%Y-%m-%d').date()
    except:
        return None

def safe(val):
    if val is None:
        return ''
    s = str(val).strip()
    return '' if s in ('nan', 'None', 'null') else s

def first_name_from_list(val):
    if not val:
        return ''
    cleaned = re.sub(r'[\[\]"\'\\]', '', str(val))
    names   = [n.strip() for n in cleaned.split(',') if n.strip()]
    return names[0] if names else ''

def parse_npf_keys(val):
    """
    Extrai o primeiro NP&F key de strings como '["PNPF-1234"]' ou 'PNPF-1234'.
    Retorna '' se vazio.
    """
    if not val or str(val).strip() in ('', '[]', 'null', 'None'):
        return ''
    cleaned = re.sub(r'[\[\]"\'\\]', '', str(val))
    keys    = [k.strip() for k in cleaned.split(',') if k.strip()]
    return keys[0] if keys else ''

def to_csv_string(rows, fieldnames):
    out    = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=fieldnames, extrasaction='ignore',
                            quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return out.getvalue()

# ─── Mapeamento de pessoas ─────────────────────────────────────────────────────

def build_people_mapping(people_rows):
    mapping = {}
    for row in people_rows:
        name = safe(row.get('name', ''))
        bu   = safe(row.get('bu', 'TBD'))
        ba   = safe(row.get('ba', 'TBD'))
        if name:
            mapping[name.lower()] = {'bu': bu, 'ba': ba}
    return mapping

def lookup_person(name, people_map):
    if not name:
        return 'TBD', 'TBD'
    key = name.strip().lower()
    if key in people_map:
        m = people_map[key]
        return m['bu'], m['ba']
    # Tenta match por primeiro + último nome
    parts_n = key.split()
    for k, v in people_map.items():
        parts_k = k.split()
        if parts_k and parts_n and parts_k[0] == parts_n[0] and parts_k[-1] == parts_n[-1]:
            return v['bu'], v['ba']
    return 'TBD', 'TBD'

def read_people_mapping():
    path = os.path.join(CONFIG_DIR, 'people_mapping.csv')
    if not os.path.exists(path):
        print(f'AVISO: {path} não encontrado. BU/BA ficará TBD.')
        return {}
    rows = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            rows.append(dict(row))
    return build_people_mapping(rows)

def enrich_people_map_from_org(people_map, issues_rows, ap_rows):
    """
    Para nomes não encontrados em people_map, tenta buscar BU/BA automaticamente
    no Databricks (productivity_nu_employee_with_org_structure) usando o e-mail
    mapeado via projac_issues. Atualiza people_map in-place.
    """
    # 1. Coleta name→email das issues (responsible + accountable)
    name_to_email = {}
    for row in issues_rows:
        for nk, ek in (('responsible_name', 'responsible_email'),
                       ('accountable_name', 'accountable_email')):
            n = safe(row.get(nk, ''))
            e = safe(row.get(ek, ''))
            if n and e:
                name_to_email[n.lower()] = e

    # 2. Todos os nomes que aparecem como dono de ação
    all_names = set()
    for row in issues_rows:
        for f in ('responsible_name', 'accountable_name', 'reporter_name'):
            n = safe(row.get(f, ''))
            if n:
                all_names.add(n)
    for row in ap_rows:
        for n in re.sub(r'[\[\]"\'\\]', '', safe(row.get('ap_assignee_name', ''))).split(','):
            n = n.strip()
            if n:
                all_names.add(n)

    # 3. Filtra quem ainda não tem mapeamento e tem e-mail conhecido
    missing_with_email = {}
    for name in all_names:
        if name.lower() not in people_map:
            email = name_to_email.get(name.lower(), '')
            if email:
                missing_with_email[email] = name

    if not missing_with_email:
        return

    print(f'[generate_report] Buscando BU/BA de {len(missing_with_email)} pessoas no org structure...')
    emails_sql = ', '.join(f"'{e}'" for e in missing_with_email.keys())
    try:
        org_rows = db_run_query(
            f"SELECT ident__email, business_unit_name, business_area_name "
            f"FROM ist__dataset.productivity_nu_employee_with_org_structure "
            f"WHERE ident__email IN ({emails_sql})"
        )
    except Exception as e:
        print(f'  AVISO: falha ao buscar org structure: {e}')
        return

    found = 0
    for row in org_rows:
        email = safe(row.get('ident__email', ''))
        bu    = safe(row.get('business_unit_name', '')) or 'TBD'
        ba    = safe(row.get('business_area_name', '')) or 'TBD'
        name  = missing_with_email.get(email, '')
        if name:
            people_map[name.lower()] = {'bu': bu, 'ba': ba}
            found += 1

    print(f'  -> {found} pessoas enriquecidas automaticamente via org structure')

# ─── Lógica de AP ─────────────────────────────────────────────────────────────

STATUS_PRIORITY = {
    'Late': 0,
    'Pending Approval (late)': 1,
    'Pending Validation (late)': 2,
    'In Validation': 3,
    'Pending Approval': 4,
    'Pending Validation': 5,
    'On Track': 6,
}

def build_ap_index(ap_rows):
    """Índice {issue_code: [ap_row, ...]} usando os últimos 7 chars da issue_link_projac."""
    index = {}
    for row in ap_rows:
        link = safe(row.get('issue_link_projac', ''))
        code = link[-7:] if len(link) >= 7 else link.split('/')[-1]
        if code:
            index.setdefault(code, []).append(row)
    return index

def best_ap(ap_list):
    def priority(row):
        status  = safe(row.get('ap_status', ''))
        p       = STATUS_PRIORITY.get(status, 99)
        due     = parse_date(row.get('ap_due_date_at', ''))
        due_ord = due.toordinal() if due else 99999
        return (p, due_ord)
    return min(ap_list, key=priority)

def get_bco_name():
    return BCO_NAMES[0]

def compute_action_issue(ap_status, ap_due_date_str, ap_assignee_raw,
                         origin, responsible_name, reporter_name, today):
    ap_status = safe(ap_status)
    assignee  = first_name_from_list(ap_assignee_raw) or safe(ap_assignee_raw)

    if not ap_status or ap_status in ('#N/A', 'TBD', 'nan', ''):
        return 'Create AP', safe(responsible_name)

    if ap_status == 'Late':
        return 'AP Late: Replan/Complete AP', assignee

    if ap_status in ('Pending Approval', 'Pending Approval (late)'):
        action = 'Complete AP Pending Approval'
        if safe(origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(reporter_name)

    if ap_status in ('Pending Validation', 'Pending Validation (late)', 'In Validation'):
        action = 'Complete AP Pending Validation'
        if safe(origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(reporter_name)

    if ap_status == 'On Track':
        due = parse_date(ap_due_date_str)
        if due and (due - today).days <= ALERT_WINDOW_DAYS:
            return 'AP will overdue < 2 weeks', assignee
        return 'AP On Track: Complete Before Due Date', assignee

    return '-', '-'

def compute_action_ap(ap_status, issue_origin, issue_reporter,
                      ap_assignee_raw, ap_due_date_str, today):
    ap_status = safe(ap_status)
    assignee  = first_name_from_list(ap_assignee_raw) or safe(ap_assignee_raw)

    if ap_status == 'In Validation':
        action = 'Complete AP Pending Validation'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    if ap_status == 'Late':
        return 'AP Late: Replan/Complete AP', assignee

    if ap_status in ('Pending Approval', 'Pending Approval (late)'):
        action = 'Complete AP Pending Approval'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    if ap_status in ('Pending Validation', 'Pending Validation (late)'):
        action = 'Complete AP Pending Validation'
        if safe(issue_origin) == 'Self-Identified':
            return action, get_bco_name()
        return action, safe(issue_reporter)

    if ap_status == 'On Track':
        due = parse_date(ap_due_date_str)
        if due and (due - today).days <= ALERT_WINDOW_DAYS:
            return 'AP will overdue < 2 weeks', assignee
        return 'AP On Track: Complete Before Due Date', assignee

    return '-', '-'

# ─── Pipeline principal ────────────────────────────────────────────────────────

def run():
    today = datetime.today().date()
    print(f'[generate_report] Data de referência: {today}')

    # Validar credenciais
    if not DATABRICKS_HOST or not DATABRICKS_TOKEN or not DATABRICKS_WAREHOUSE_ID:
        print('ERRO: Credenciais do Databricks não configuradas.')
        print('  Crie o arquivo .env na raiz com:')
        print('    DATABRICKS_HOST=https://...')
        print('    DATABRICKS_TOKEN=dapi...')
        print('    DATABRICKS_WAREHOUSE_ID=...')
        sys.exit(1)

    people_map = read_people_mapping()

    # ── 1. Buscar Issues ──────────────────────────────────────────────────────
    print('[generate_report] Buscando Issues no Databricks...')
    issues_rows = db_run_query(QUERY_ISSUES)

    # ── 2. Buscar Action Plans ────────────────────────────────────────────────
    print('[generate_report] Buscando Action Plans no Databricks...')
    ap_rows = db_run_query(QUERY_APS)

    ap_index = build_ap_index(ap_rows)

    # ── 3. Auto-enriquecer mapeamento de pessoas via org structure ────────────
    enrich_people_map_from_org(people_map, issues_rows, ap_rows)

    # ── 4. Enriquecer Issues ──────────────────────────────────────────────────
    print('[generate_report] Enriquecendo Issues...')
    tbd_people = set()

    ISSUES_FIELDS = [
        'Type', 'code', 'NP&F+', 'projac_link', 'key', 'status', 'summary',
        'countries', 'reporter_name', 'squad_reporter', 'created_at', 'updated_at',
        'due_date_at', 'completed_at', 'responsible_email', 'accountable_email',
        'process_journey_macroprocess__name', 'overall_risk_rating', 'origin',
        'subcategory', 'residual_risk_level', 'responsible_name', 'accountable_name',
        'business_units', 'Action', 'Action Owner', 'Action Pending From', 'Business Area',
    ]

    issues_output = []
    for row in issues_rows:
        code = safe(row.get('code', ''))

        # Type + NP&F+ (usando npf_keys direto da tabela)
        npf_key  = parse_npf_keys(row.get('npf_keys', ''))
        if npf_key:
            issue_type = 'Potential Issue'
            npf_link   = NPF_BASE_URL + npf_key
        else:
            issue_type = 'Issue'
            npf_link   = '-'

        # AP mais urgente
        ap_list = ap_index.get(code, [])
        if ap_list:
            best      = best_ap(ap_list)
            ap_status   = safe(best.get('ap_status', ''))
            ap_assignee = safe(best.get('ap_assignee_name', ''))
            ap_due      = safe(best.get('ap_due_date_at', ''))
        else:
            ap_status, ap_assignee, ap_due = '', '', ''

        action, action_owner = compute_action_issue(
            ap_status, ap_due, ap_assignee,
            safe(row.get('origin', '')),
            safe(row.get('responsible_name', '')),
            safe(row.get('reporter_name', '')),
            today,
        )

        primary_owner = first_name_from_list(action_owner) or action_owner
        bu, ba = lookup_person(primary_owner, people_map)
        if bu == 'TBD' and primary_owner not in ('-', ''):
            tbd_people.add(primary_owner)

        out = {k: safe(row.get(k, '')) for k in ISSUES_FIELDS}
        out['Type']                = issue_type
        out['NP&F+']               = npf_link
        out['Action']              = action
        out['Action Owner']        = action_owner
        out['Action Pending From'] = bu
        out['Business Area']       = ba
        issues_output.append(out)

    # ── 5. Enriquecer Action Plans ─────────────────────────────────────────────
    print('[generate_report] Enriquecendo Action Plans...')

    APS_FIELDS = [
        'ap_code', 'ap_link_projac', 'ap_status', 'ap_country', 'issue_link_projac',
        'Issue Code', 'Type', 'issue rating', 'issue_status', 'issue_summary',
        'issue_due_date_at', 'issue_subcategory', 'ap_summary', 'ap_created_at',
        'ap_due_date_at', 'ap_business_unit', 'ap_assignee_name',
        'Action', 'Action Owner', 'Action Pending From', 'Business Area',
    ]

    issues_by_code = {safe(r.get('code', '')): r for r in issues_rows}

    aps_output = []
    for row in ap_rows:
        issue_link = safe(row.get('issue_link_projac', ''))
        issue_code = issue_link[-7:] if len(issue_link) >= 7 else issue_link.split('/')[-1]

        parent       = issues_by_code.get(issue_code, {})
        issue_origin = safe(parent.get('origin', ''))
        issue_reporter = safe(parent.get('reporter_name', ''))
        issue_rating   = safe(parent.get('overall_risk_rating', ''))

        npf_key    = parse_npf_keys(parent.get('npf_keys', ''))
        issue_type = 'Potential Issue' if npf_key else 'Issue'

        issue_code_col = f"I{issue_link[-6:]}" if issue_link else issue_code

        ap_status   = safe(row.get('ap_status', ''))
        ap_assignee = safe(row.get('ap_assignee_name', ''))
        ap_due      = safe(row.get('ap_due_date_at', ''))

        action, action_owner = compute_action_ap(
            ap_status, issue_origin, issue_reporter, ap_assignee, ap_due, today
        )

        primary_owner = first_name_from_list(action_owner) or action_owner
        bu, ba = lookup_person(primary_owner, people_map)
        if bu == 'TBD' and primary_owner not in ('-', ''):
            tbd_people.add(primary_owner)

        out = {k: safe(row.get(k, '')) for k in APS_FIELDS}
        out['Issue Code']          = issue_code_col
        out['Type']                = issue_type
        out['issue rating']        = issue_rating
        out['Action']              = action
        out['Action Owner']        = action_owner
        out['Action Pending From'] = bu
        out['Business Area']       = ba
        aps_output.append(out)

    # ── 6. Alertas de mapeamento incompleto ────────────────────────────────────
    if tbd_people:
        print(f'\nAVISO: {len(tbd_people)} pessoa(s) sem BU/BA no mapeamento:')
        for p in sorted(tbd_people):
            print(f'  -> {p}')
        print(f'  Adicione em: data/config/people_mapping.csv\n')

    # ── 7. Gerar strings CSV ───────────────────────────────────────────────────
    issues_csv_str = to_csv_string(issues_output, ISSUES_FIELDS)
    aps_csv_str    = to_csv_string(aps_output, APS_FIELDS)

    # ── 8. Injetar no template HTML ────────────────────────────────────────────
    template_path = os.path.join(TEMPLATE_DIR, 'dashboard_template.html')
    if not os.path.exists(template_path):
        print(f'ERRO: template não encontrado: {template_path}')
        sys.exit(1)

    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Escapa backticks para não quebrar o template literal JS
    html = html.replace('%%ISSUES_CSV%%', issues_csv_str.replace('`', '\\`'))
    html = html.replace('%%APS_CSV%%',    aps_csv_str.replace('`', '\\`'))
    html = html.replace('%%GENERATED_AT%%', datetime.now().strftime('%Y-%m-%d %H:%M'))

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, 'dashboard.html')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'\n✓ Dashboard gerado: {output_path}')
    print(f'  Issues processados : {len(issues_output)}')
    print(f'  APs processados    : {len(aps_output)}')
    print(f'\nAbra o arquivo no navegador:')
    print(f'  open {output_path}')

if __name__ == '__main__':
    run()
