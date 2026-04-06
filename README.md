# Issue Management Report

Gera automaticamente o dashboard HTML semanal de Issues & Action Plans — **todas as BUs** (sem filtro de área).

---

## Como funciona (automático)

O relatório roda **toda segunda-feira às 8h (horário de Brasília)** via GitHub Actions, sem nenhuma ação manual necessária.

O pipeline:
1. Busca todos os Issues e Action Plans no Databricks (sem filtro de BU)
2. Identifica **Potential Issues** via campo `npf_keys` da tabela `projac_issues` (chave PNPF do Jira)
3. Enriquece Business Area e Business Unit de cada responsável via **Mantiqueira** (`org_level_6` / `org_level_5`)
4. Gera o dashboard HTML (filtrado para Global Lending) e envia **3 mensagens no Slack**:
   - **Mensagem 1:** arquivo HTML pronto para copiar e colar no Google Sites
   - **Mensagem 2:** contagem de Issues, Potential Issues e APs late, agrupados por Business Area, com links clicáveis para o Projac
   - **Mensagem 3:** ações pendentes agrupadas por tipo (AP Late, Create AP, etc.), listando os responsáveis

---

## Estrutura do repositório

```
issue-management-report/
├── .github/workflows/
│   └── generate_report.yml     ← pipeline (toda segunda às 8h BRT)
├── scripts/
│   └── generate_report.py      ← script principal
├── steerco/                    ← app React (SteerCo)
├── docs/                       ← build servido pelo GitHub Pages
├── apps_script/                ← versão Google Apps Script
├── template/
│   └── dashboard_template.html ← template HTML (não editar)
└── data/
    └── config/
        └── people_mapping.csv  ← fallback manual pessoa → BU/BA
```

---

## Secrets necessários no GitHub

`Settings → Secrets and variables → Actions`

| Secret | O que é |
|---|---|
| `DATABRICKS_HOST` | URL do workspace (ex: `https://nubank-e2-general.cloud.databricks.com`) |
| `DATABRICKS_TOKEN` | Personal Access Token do Databricks |
| `DATABRICKS_WAREHOUSE_ID` | ID do SQL Warehouse |
| `SLACK_TOKEN` | Bot token (`xoxb-...`) com `files:write` e `chat:write` |
| `SLACK_CHANNEL` | ID do canal onde o report é postado |
| `APPS_SCRIPT_DEPLOYMENT_ID` | ID do deployment do Google Apps Script |
| `CLASP_CREDENTIALS` | Conteúdo de `~/.clasprc.json` |
| `CONFLUENCE_URL` | URL base do Confluence |
| `CONFLUENCE_EMAIL` | E-mail Atlassian |
| `CONFLUENCE_TOKEN` | API token Atlassian |
| `CONFLUENCE_PAGE_ID` | ID da página Confluence |

> ⚠️ Tokens do Databricks e Atlassian têm validade. Se o pipeline falhar com 401/403, renove os tokens.

---

## Lógica de dados

### Por que o script busca todas as BUs no Databricks?

O script **não filtra por BU na query SQL** — ele traz issues e APs de todas as áreas intencionalmente. Isso é necessário para que o Mantiqueira consiga resolver corretamente o Business Area e Business Unit de cada responsável, independente de onde essa pessoa trabalha na organização.

O filtro para **Global Lending** é aplicado **depois** do enriquecimento, apenas na geração do HTML:

| Etapa | Comportamento |
|---|---|
| Query Databricks | Traz **tudo** (todas as BUs) |
| Enriquecimento Mantiqueira | Usa **todos** os dados para mapear BU/BA corretamente |
| HTML / Slack | Exibe apenas itens de **Global Lending** |

### Issues e Action Plans
- Busca todos os issues e APs ativos do Databricks (sem filtro de BU na query)
- Exclui status terminais: `Done`, `Completed`, `Cancelled`, `Risk Accepted`
- **No HTML:** exibe apenas issues cujo macroprocess é `Global Lending`, `Secured Loans` ou `Lending`, ou cuja `business_units` contém `Global Lending`
- **No HTML:** exibe apenas APs cuja `ap_business_unit` é `Global Lending` ou `Secured Loans`

### Potential Issues
- Um issue é marcado como **Potential Issue** quando tem `npf_keys` preenchido na tabela `projac_issues`
- O link NP&F aponta para `https://nubank.atlassian.net/browse/<PNPF-XXXX>`

### Business Area e Business Unit
- Ambas vêm do **Mantiqueira** (`org_level_6` = Business Area, `org_level_5` = Business Unit)
- Lookup por email ou `unique_name` do funcionário
- Fallback manual em `data/config/people_mapping.csv`

### TTR (Time to Remediate)
- Calculado apenas para issues **Global Lending** fechados (High/Very High) nos últimos 6 meses

---

## Rodar manualmente

Pelo GitHub: `Actions → Generate Issue Management Report → Run workflow`

Localmente:
```bash
cd ~/issue-management-report

# Criar .env com as credenciais
cat > .env << EOF
DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_WAREHOUSE_ID=...
SLACK_TOKEN=xoxb-...
SLACK_CHANNEL=C...
EOF

python3 scripts/generate_report.py
```

---

## Manutenção

### Se aparecer pessoa sem BU/BA (BA = TBD)

Adicione manualmente em `data/config/people_mapping.csv`:
```csv
name,bu,ba
Nome Completo,Nome da BU,Nome da Business Area
```

### Se o token do Databricks expirar
1. Gerar novo token no Databricks
2. Atualizar `DATABRICKS_TOKEN` em `Settings → Secrets`
3. Rodar manualmente para confirmar

### Se o token Atlassian expirar
1. Gerar novo em `id.atlassian.com/manage-profile/security/api-tokens`
2. Atualizar `CONFLUENCE_TOKEN` em `Settings → Secrets`

---

## Contato

Dúvidas: **Christiane Belem**
