# Handoff — Issue Management Global Lending Dashboard

Guia completo para a pessoa que vai manter este report.

---

## O que é este projeto

Dashboard automatizado de **Issues & Action Plans do Global Lending**, publicado toda segunda-feira.

| Destino | URL |
|---|---|
| Dashboard interativo (SteerCo) | `https://chrisbelem.github.io/issue-management-report/steerco/` |
| Slack | Canal configurado em `.env` (mensagens com resumo semanal) |

---

## Pré-requisitos (instalar uma vez)

Você vai precisar de um Mac com acesso à rede Nubank (VPN ou escritório).

### 1. Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Python 3
```bash
brew install python3
```
Verifique: `python3 --version` deve retornar 3.11 ou superior.

O script usa **apenas bibliotecas padrão do Python** (urllib, csv, json) — não precisa instalar nada via pip.

### 3. Node.js e npm
```bash
brew install node
```
Verifique: `node --version` deve retornar 20 ou superior.

### 4. Git
```bash
brew install git
```

---

## Configuração inicial (fazer uma vez)

### 1. Clonar o repositório
```bash
git clone https://github.com/chrisbelem/issue-management-report.git
cd issue-management-report
```

### 2. Instalar dependências do React
```bash
cd steerco
npm install
cd ..
```

### 3. Criar o arquivo `.env` com as credenciais

Criar o arquivo `.env` na raiz do projeto (substituir os valores reais):
```
DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_WAREHOUSE_ID=3f3791356e419544
SLACK_TOKEN=xoxb-...
SLACK_CHANNEL=C09QVFRBB51
```

**Como obter cada credencial:**

| Credencial | Onde buscar |
|---|---|
| `DATABRICKS_TOKEN` | Databricks → User Settings → Developer → Access Tokens → Generate new token |
| `DATABRICKS_HOST` | URL do workspace Databricks (não muda) |
| `DATABRICKS_WAREHOUSE_ID` | Não muda — já está preenchido acima |
| `SLACK_TOKEN` | Pegar com o dono do bot no Slack (token `xoxb-...`) |
| `SLACK_CHANNEL` | ID do canal (não muda) |

### 4. Configurar acesso ao GitHub

Você precisará ter permissão de push no repositório `chrisbelem/issue-management-report`.
Peça para Christiane Belem te adicionar como colaborador no GitHub.

Configurar sua identidade no git:
```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@nubank.com.br"
```

---

## Como rodar o report manualmente

Sempre com VPN ativa (ou no escritório):

```bash
cd ~/issue-management-report

# 1. Gera dados + envia Slack
/opt/homebrew/bin/python3 scripts/generate_report.py

# 2. Build do dashboard React
cd steerco
/opt/homebrew/bin/npm run build
cd ..

# 3. Publicar no GitHub Pages
git add docs/ steerco/public/data.json apps_script/
git commit -m "chore: weekly report $(date +'%Y-%m-%d')"
git push origin main
```

Para rodar **sem enviar mensagem no Slack** (teste):
```bash
/opt/homebrew/bin/python3 scripts/generate_report.py --no-slack
```

---

## Automação local (launchd) — para rodar toda segunda automaticamente

### 1. Criar o arquivo de automação

```bash
cat > ~/Library/LaunchAgents/com.christiane.issue-management-report.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.christiane.issue-management-report</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/$(whoami)/issue-management-report/scripts/run_weekly.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>8</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/$(whoami)/issue-management-report/logs/run.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/$(whoami)/issue-management-report/logs/run.log</string>
</dict>
</plist>
EOF
```

### 2. Ativar a automação
```bash
launchctl load ~/Library/LaunchAgents/com.christiane.issue-management-report.plist
```

### 3. Verificar se está funcionando
```bash
launchctl list | grep issue-management   # deve aparecer na lista
tail -50 ~/issue-management-report/logs/run.log   # log da última execução
```

### 4. Forçar execução imediata (para testar)
```bash
mkdir -p ~/issue-management-report/logs
launchctl start com.christiane.issue-management-report
```

> O Mac precisa estar ligado na segunda-feira às 8h para a automação funcionar.
> Se o Mac estiver desligado, rodar manualmente quando voltar.

---

## Manutenção recorrente

### Token do Databricks expirou (erro 401 ou 403)

1. Acessar: Databricks → User Settings → Developer → Access Tokens
2. Gerar novo token
3. Atualizar `DATABRICKS_TOKEN` no arquivo `.env`

### Alguém aparece sem Business Area no log

O script exibe no terminal:
```
AVISO: X pessoa(s) sem BU/BA no mapeamento:
  -> Nome Sobrenome
```

Adicionar a pessoa em `data/config/people_mapping.csv`:
```csv
name,bu,ba
Nome Completo,Lending,Nome da Business Area
```

Depois rodar o script de novo.

### Issue ou AP aparece na BA errada

A Business Area sempre segue o **Responsible** do issue no Projac. Se está errado, verificar quem é o Responsible no Projac e garantir que essa pessoa está no Mantiqueira ou no `people_mapping.csv` com a BA correta.

### Issue ou AP com dado desatualizado (não sincronizou no Databricks)

É possível excluir manualmente um item até o Databricks sincronizar.
No arquivo `scripts/generate_report.py`, no início, existem dois sets:

```python
EXCLUDED_ISSUES = {'I012319'}   # ← adicionar o código aqui
EXCLUDED_APS    = {'AP015815'}  # ← adicionar o código aqui
```

Remover da lista quando o dado estiver correto no Databricks.

---

## Estrutura dos arquivos importantes

```
issue-management-report/
├── scripts/
│   ├── generate_report.py      ← script principal
│   └── run_weekly.sh           ← orquestra: python → npm build → git push
├── steerco/
│   ├── src/components/
│   │   ├── OverviewTab.jsx     ← gráficos por BA, KPIs, tabela consolidada
│   │   ├── DetailsTab.jsx      ← issues e APs late com presentation notes
│   │   ├── LateIssues.jsx      ← cards de issues late
│   │   └── CriticalAPs.jsx     ← cards de APs críticos
│   └── public/data.json        ← gerado pelo script (não editar manualmente)
├── docs/                       ← build do React (GitHub Pages serve daqui)
├── data/config/
│   └── people_mapping.csv      ← fallback manual pessoa → BU/BA
├── .env                        ← credenciais (não está no git — criar manualmente)
└── HANDOFF.md                  ← este arquivo
```

---

## Lógica de negócio resumida

| Campo | Regra |
|---|---|
| Quais issues entram | `business_units` contém `"Global Lending"` (campo Treatment do Projac) |
| Quais APs entram | `ap_business_unit` é `"Global Lending"` ou `"Secured Loans"` |
| Business Area do issue | Sempre do **Responsible** do issue (lookup no Mantiqueira → fallback no CSV) |
| Business Area do AP | Sempre do **Responsible** do issue pai (mesma regra) |
| Status excluídos (issues) | Done, Completed, Cancelled, Risk Accepted |
| Status excluídos (APs) | Done, Completed, Cancelled, Not Approved |

---

## Dúvidas

Criado por: **Christiane Belem**
