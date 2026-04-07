# Issue Management Report — Global Lending

Dashboard automatizado de **Issues & Action Plans do Global Lending**, gerado toda segunda-feira às 8h BRT.

---

## Como rodar (próximo mês)

O relatório roda automaticamente via **launchd** no Mac local toda segunda-feira às 8h. Se precisar rodar manualmente:

```bash
cd ~/issue-management-report
/opt/homebrew/bin/python3 scripts/generate_report.py
```

Isso vai:
1. Buscar dados atualizados do Databricks
2. Gerar o HTML e o `data.json` para o app React
3. Enviar 3 mensagens no Slack com o relatório

Depois de rodar, fazer build e publicar:

```bash
cd steerco
/opt/homebrew/bin/npm run build
cd ..
git add docs/ steerco/public/data.json apps_script/
git commit -m "chore: weekly report $(date +'%Y-%m-%d')"
git push origin main
```

O dashboard fica disponível em: `https://chrisbelem.github.io/issue-management-report/steerco/`

---

## Credenciais (.env)

Arquivo `.env` na raiz do projeto (não está no git):

```
DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
DATABRICKS_TOKEN=dapi...          ← expira! renovar no Databricks se der 401
DATABRICKS_WAREHOUSE_ID=3f3791356e419544
SLACK_TOKEN=xoxb-...              ← bot token do canal de report
SLACK_CHANNEL=C09QVFRBB51
```

### Se o token do Databricks expirar (erro 401/403)
1. Acessar o workspace Databricks → User Settings → Developer → Access Tokens
2. Gerar novo token
3. Atualizar `DATABRICKS_TOKEN` no arquivo `.env`

---

## Automação local (launchd)

O script roda automaticamente via launchd toda segunda-feira às 8h BRT.

Arquivo: `~/Library/LaunchAgents/com.christiane.issue-management-report.plist`

Logs em: `~/issue-management-report/logs/run.log`

Comandos úteis:
```bash
# Ver log da última execução
tail -50 ~/issue-management-report/logs/run.log

# Forçar execução agora
launchctl start com.christiane.issue-management-report

# Verificar se está carregado
launchctl list | grep issue-management
```

---

## Estrutura do repositório

```
issue-management-report/
├── scripts/
│   ├── generate_report.py      ← script principal (busca dados + gera dashboard + envia Slack)
│   └── run_weekly.sh           ← orquestra: python → npm build → git push
├── steerco/                    ← app React (dashboard interativo para SteerCo)
│   ├── src/components/
│   │   ├── OverviewTab.jsx     ← gráficos por BA, KPIs, tabela consolidada com drilldown
│   │   ├── DetailsTab.jsx      ← issues e APs late com presentation notes
│   │   ├── LateIssues.jsx      ← cards de issues/potential issues late
│   │   └── CriticalAPs.jsx     ← cards de APs críticos
│   └── public/data.json        ← gerado pelo script (não editar manualmente)
├── docs/                       ← build do React servido pelo GitHub Pages
├── template/
│   └── dashboard_template.html ← template HTML clássico (não editar)
├── apps_script/                ← versão Google Apps Script
├── data/
│   └── config/
│       └── people_mapping.csv  ← mapeamento manual pessoa → BU/BA (ver seção abaixo)
├── .github/workflows/
│   └── generate_report.yml     ← pipeline GitHub Actions (segunda-feira, backup)
└── .env                        ← credenciais locais (não está no git)
```

---

## Lógica de dados

### Filtro Global Lending

O script busca **todos** os issues e APs do Databricks (sem filtro na query SQL). O filtro para Global Lending é aplicado em Python **após** o enriquecimento do Mantiqueira:

| Etapa | Comportamento |
|---|---|
| Query Databricks | Traz tudo (todas as BUs) |
| Enriquecimento Mantiqueira | Mapeia BA/BU de todos os responsáveis |
| Output (HTML/Slack/React) | Exibe apenas itens de Global Lending |

**Issues incluídos:** somente se o campo `business_units` contém `"Global Lending"` (campo "Treatment" do Projac — **não** usa macroprocess).

**APs incluídos:** somente se `ap_business_unit` é `"Global Lending"` ou `"Secured Loans"`.

### Status excluídos (terminais)

Issues com status: `Done`, `Completed`, `Cancelled`, `Risk Accepted`

APs com status: `Done`, `Completed`, `Cancelled`, `Not Approved`

### Potential Issues

Um issue é marcado como **Potential Issue** quando tem o campo `npf_keys` preenchido na tabela `projac_issues` (chave PNPF do Jira). O link aponta para `https://nubank.atlassian.net/browse/<PNPF-XXXX>`.

### Business Area — como é determinada

A Business Area de cada issue vem **exclusivamente do Issue Responsible** (`responsible_name`):

1. Busca o Responsible no Mantiqueira → `org_level_6` = Business Area, `org_level_5` = Business Unit
2. Se não encontrar no Mantiqueira, busca em `data/config/people_mapping.csv`
3. Se ainda não encontrar → item excluído do report (BA = TBD)

**Importante:** a BA reflete quem é dono do issue (Responsible), não quem está executando a ação no momento.

### Normalização de Business Area

Alguns nomes vêm do Mantiqueira com variações. O script normaliza automaticamente:

| Nome no Mantiqueira | Nome canônico no report |
|---|---|
| CPX / Common product experience | Common Product Experience |
| Unsecured Loans | Unsecured Lending |
| Lending PJ | PJ Lending |
| Lending Foundations | Lending Foundations Platforms |

A mesma normalização é aplicada no app React (OverviewTab.jsx → `BA_ALIASES`).

---

## Manutenção mensal

### 1. Pessoa aparece sem BA (BA = TBD) no log

O script avisa no terminal quem está sem BA. Adicionar em `data/config/people_mapping.csv`:

```csv
name,bu,ba
Nome Completo,Nome da BU,Nome da Business Area
```

Exemplos reais já mapeados:
- Pessoas do Mexico (Mantiqueira não tem `org_level_6` para MX) → mapeadas manualmente
- Pessoas de outras áreas que têm responsabilidade em issues GL

**Após adicionar**, rodar o script de novo para regenerar com o dado correto.

### 2. Nova Business Area aparece com nome errado

Adicionar o alias em dois lugares:

**`scripts/generate_report.py`** → dicionário `BA_ALIASES`:
```python
BA_ALIASES = {
    ...
    'Nome vindo do Mantiqueira': 'Nome canônico',
}
```

**`steerco/src/components/OverviewTab.jsx`** → objeto `BA_ALIASES`:
```js
const BA_ALIASES = {
  ...
  'Nome vindo do Mantiqueira': 'Nome canônico',
}
```

### 3. Issue aparece na BA errada

Verificar quem é o **Responsible** do issue no Projac. A BA segue sempre o Responsible. Se o Responsible não estiver no Mantiqueira, adicionar em `people_mapping.csv`.

### 4. AP aparece no report mas não deveria

Verificar o status do AP no Projac. Status excluídos: `Done`, `Completed`, `Cancelled`, `Not Approved`. Se o AP tem outro status e não deveria aparecer, verificar se o `ap_business_unit` está correto no Projac.

---

## Slack — 3 mensagens enviadas

| Mensagem | Conteúdo |
|---|---|
| 1 | Arquivo HTML pronto para copiar e colar no Google Sites |
| 2 | Contagem de Issues/Potential Issues/APs late por Business Area, com links Projac |
| 3 | Ações pendentes por tipo (AP Late, Create AP, etc.) com lista de responsáveis |

---

## App React (SteerCo dashboard)

Dashboard interativo em `https://chrisbelem.github.io/issue-management-report/steerco/`

Funcionalidades:
- **KPI cards:** número de late (grande) + total (pequeno) por categoria
- **Gráficos por BA:** Issues, Potential Issues e Action Plans separados — clicar numa barra abre lista de itens no final da página com links Projac
- **Cross-filtering:** clicar num gráfico ou no donut de status filtra todos os outros gráficos simultaneamente
- **Tabela consolidada:** visão por Business Area com drilldown — clicar num número abre painel com os itens individuais
- **Aba Detail:** lista issues e APs late com campo de **Presentation Notes** (notas salvas localmente no browser para usar na apresentação do SteerCo)

### Presentation Notes

As notas da aba Detail são salvas no `localStorage` do browser. Isso significa:
- Ficam salvas entre sessões no mesmo computador/browser
- **Não** são sincronizadas com o GitHub nem com outros computadores
- Se mudar de computador ou limpar o browser, as notas são perdidas

---

## Tabelas do Databricks utilizadas

| Tabela | Finalidade |
|---|---|
| `ist__dataset.projac_issues` | Issues do Projac |
| `ist__dataset.projac_action_plans` | Action Plans do Projac |
| `etl.br__dataset.jira_issues_status_history` | Histórico de status dos APs |
| `etl.ist__contract.malhacao__process_journey_macroprocesses` | Nome do macroprocess |
| `etl.ist__contract.mantiqueira__idents` | Email e unique_name dos funcionários |
| `etl.br__series_contract.mantiqueira_group_org_chart_levels` | Estrutura org (org_level_5 = BU, org_level_6 = BA) |

---

## Contato

Dúvidas: **Christiane Belem**
