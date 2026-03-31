# Handoff — Issue Management Global Lending Dashboard

Este documento descreve tudo que a pessoa responsável por manter este projeto precisa saber.

---

## O que é este projeto

Dashboard automatizado de **Issues & Action Plans do Global Lending**, gerado diariamente (dias úteis) a partir de dados do Databricks. O report é publicado em três lugares:

| Destino | URL / Localização |
|---|---|
| GitHub Pages (SteerCo React app) | `https://chrisbelem.github.io/issue-management-report/steerco/` |
| Google Apps Script | Deployment ID configurado no secret `APPS_SCRIPT_DEPLOYMENT_ID` |
| Confluence | Página configurada no secret `CONFLUENCE_PAGE_ID` |
| Slack | Canal configurado no secret `SLACK_CHANNEL` |

---

## Estrutura do repositório

```
issue-management-report/
├── .github/workflows/
│   └── generate_report.yml     ← pipeline de automação (roda todo dia útil às 8h BRT)
├── scripts/
│   └── generate_report.py      ← script principal: busca dados, enriquece e gera o dashboard
├── steerco/                    ← app React (dashboard interativo para SteerCo)
│   ├── src/components/         ← componentes do dashboard
│   └── public/data.json        ← dados gerados pelo script (não editar manualmente)
├── docs/                       ← build do app React (GitHub Pages serve daqui)
│   └── steerco/
├── template/
│   └── dashboard_template.html ← template do dashboard HTML clássico
├── apps_script/                ← versão Google Apps Script do dashboard
└── data/
    └── config/
        └── people_mapping.csv  ← fallback manual de pessoa → BU/BA (raramente necessário)
```

---

## Como funciona a automação

O GitHub Actions roda o workflow `.github/workflows/generate_report.yml` automaticamente:

- **Agendamento:** todos os dias úteis (segunda a sexta) às 8h horário de Brasília (11h UTC)
- **Trigger manual:** pode ser disparado a qualquer momento em `Actions → Generate Issue Management Report → Run workflow`

### Passos do pipeline

1. **`generate_report.py`** — Busca issues e APs no Databricks, enriquece com Business Area via Mantiqueira (org_level_6), gera `docs/index.html` e `steerco/public/data.json`
2. **Build React** — Compila o app SteerCo (`npm ci && npm run build`) e gera os arquivos em `docs/steerco/`
3. **Deploy Google Apps Script** — Publica via `clasp`
4. **Publish Confluence** — Sobe o `docs/index.html` como attachment na página configurada
5. **Commit & push** — Faz commit dos arquivos gerados e push para `main` (GitHub Pages atualiza automaticamente)

---

## Secrets configurados no GitHub

Acessar em: `Settings → Secrets and variables → Actions`

| Secret | O que é |
|---|---|
| `DATABRICKS_HOST` | URL do workspace Databricks (ex: `https://nubank-e2-general.cloud.databricks.com`) |
| `DATABRICKS_TOKEN` | Personal Access Token do Databricks com acesso às tabelas de issues |
| `DATABRICKS_WAREHOUSE_ID` | ID do SQL Warehouse do Databricks |
| `SLACK_TOKEN` | Bot token do Slack (`xoxb-...`) com permissão `files:write` e `chat:write` |
| `SLACK_CHANNEL` | ID do canal Slack onde o report é postado |
| `APPS_SCRIPT_DEPLOYMENT_ID` | ID do deployment do Google Apps Script |
| `CLASP_CREDENTIALS` | Conteúdo do arquivo `~/.clasprc.json` (credenciais OAuth do clasp) |
| `CONFLUENCE_URL` | URL base do Confluence (ex: `https://nubank.atlassian.net`) |
| `CONFLUENCE_EMAIL` | E-mail da conta Atlassian usada para publicar |
| `CONFLUENCE_TOKEN` | API token do Atlassian |
| `CONFLUENCE_PAGE_ID` | ID numérico da página Confluence onde o report é publicado |

> ⚠️ **Atenção:** Os tokens do Databricks e Atlassian têm validade. Se o pipeline falhar com erro 401/403, o primeiro passo é renovar os tokens.

---

## Infraestrutura — Self-Hosted Runner

O pipeline usa um **self-hosted runner** (não o runner padrão do GitHub) porque o Databricks tem ACL de IP que bloqueia IPs externos.

### Status atual

O runner **ainda precisa ser provisionado**. Enquanto isso, o pipeline vai falhar com erro de IP bloqueado.

### Como configurar

1. Provisionar uma máquina/container dentro da rede Nubank com acesso ao Databricks
2. Acessar `github.com/chrisbelem/issue-management-report → Settings → Actions → Runners → New self-hosted runner`
3. Seguir as instruções para instalar e registrar o runner
4. O runner precisa ter acesso a:
   - Databricks (inbound já liberado por estar na rede interna)
   - Internet (para push no GitHub, post no Slack, publish no Confluence)
   - Python 3.11+ e Node.js 20+

---

## Tabelas do Databricks utilizadas

| Tabela | Finalidade |
|---|---|
| `ist__dataset.projac_issues` | Issues do Projac |
| `ist__dataset.projac_action_plans` | Action Plans do Projac |
| `etl.br__dataset.jira_issues_status_history` | Histórico de status dos APs |
| `etl.ist__contract.malhacao__process_journey_macroprocesses` | Nome do macroprocess (ex: Global Lending) |
| `etl.ist__contract.mantiqueira__idents` | Email e unique_name dos funcionários |
| `etl.br__series_contract.mantiqueira_group_org_chart_levels` | Estrutura org (org_level_5 = BU, org_level_6 = Business Area) |

### Filtro Global Lending

O script filtra issues em Python (não no SQL) usando:
- `macroprocess IN ('Global Lending', 'Secured Loans', 'Lending')` **OU**
- `business_units` contém `'Global Lending'`

Para APs, filtra por `ap_business_unit IN ('Global Lending', 'Secured Loans')`.

---

## Manutenção recorrente

### Se aparecerem itens com BA = "TBD" no report

O script já exclui automaticamente itens sem Business Area resolvida. Se estiver excluindo muitos itens, pode ser que o Mantiqueira não tenha o funcionário cadastrado. Nesse caso, adicione manualmente em:

```
data/config/people_mapping.csv
```

Formato:
```csv
name,bu,ba
Nome Completo,Nome da BU,Nome da Business Area
```

### Se o token do Databricks expirar

1. Gerar novo Personal Access Token no Databricks
2. Atualizar o secret `DATABRICKS_TOKEN` no GitHub (`Settings → Secrets → DATABRICKS_TOKEN → Update`)
3. Rodar o workflow manualmente para confirmar

### Se o token do Atlassian expirar

1. Gerar novo API token em `id.atlassian.com/manage-profile/security/api-tokens`
2. Atualizar o secret `CONFLUENCE_TOKEN` no GitHub

### Se o CLASP_CREDENTIALS expirar

1. Na máquina local, rodar `clasp login` para renovar o token
2. Copiar o conteúdo de `~/.clasprc.json`
3. Atualizar o secret `CLASP_CREDENTIALS` no GitHub

---

## Como rodar localmente (para debug)

```bash
# Clonar o repo
git clone https://github.com/chrisbelem/issue-management-report.git
cd issue-management-report

# Criar o .env na raiz com as credenciais
cat > .env << EOF
DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_WAREHOUSE_ID=...
SLACK_TOKEN=xoxb-...
SLACK_CHANNEL=C...
EOF

# Rodar o script (Python padrão, sem dependências extras)
python3 scripts/generate_report.py

# Buildar o app React
cd steerco
npm ci
npm run build

# Visualizar localmente
npm run preview
# Abre em http://localhost:4173/issue-management-report/steerco/
```

---

## Contato

Dúvidas sobre o projeto: **Christiane Belem** (criadora do report)
