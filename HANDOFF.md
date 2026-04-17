# Handoff — Issue Management Global Lending Dashboard

Guia completo para a pessoa que vai manter este report.

Criado por: **Christiane Belem** | Atualizado em: **2026-04-17**

---

## O que é este projeto

Duas automações que rodam toda **segunda-feira às 8h**:

| Automação | O que faz | Destino |
|---|---|---|
| **Report semanal** | Busca Issues & APs do Projac no Databricks, gera dashboard e envia resumo | Slack + GitHub Pages |
| **Scan de potenciais Issues** | Lê mensagens dos últimos 7 dias nos canais de Lending, analisa com Claude e identifica possíveis Issues não registrados | Slack |

| URL | Descrição |
|---|---|
| `https://chrisbelem.github.io/issue-management-report/steerco/` | Dashboard interativo (SteerCo) |
| `https://sites.google.com/nubank.com.br/projacweeklyreport/home` | Google Sites (embed do Apps Script) |

---

## Pré-requisitos (instalar uma vez)

Você vai precisar de um **Mac com acesso à rede Nubank** (VPN ou escritório).

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

### 5. clasp (Google Apps Script CLI) — opcional, para atualizar Google Sites
```bash
npm install -g @google/clasp
clasp login   # abre navegador para autenticação com conta Nubank
```

---

## Configuração inicial (fazer uma vez)

### 1. Clonar o repositório
```bash
git clone https://github.com/chrisbelem/issue-management-report.git ~/issue-management-report
cd ~/issue-management-report
```

### 2. Instalar dependências do React
```bash
cd steerco
npm install
cd ..
```

### 3. Criar o arquivo `.env` com as credenciais

Criar o arquivo `.env` na raiz do projeto:
```
DATABRICKS_HOST=https://nubank-e2-general.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
DATABRICKS_WAREHOUSE_ID=3f3791356e419544
SLACK_TOKEN=xoxb-...
SLACK_CHANNEL=C09QVFRBB51
SLACK_SCANNER_CHANNEL=C09QVFRBB51
LITELLM_API_KEY=...
LITELLM_BASE_URL=https://ist-prod-litellm.nullmplatform.com
```

**Como obter cada credencial:**

| Credencial | Onde buscar |
|---|---|
| `DATABRICKS_TOKEN` | Databricks → User Settings → Developer → Access Tokens → Generate new token |
| `DATABRICKS_HOST` | URL do workspace Databricks (não muda) |
| `DATABRICKS_WAREHOUSE_ID` | Não muda — já está preenchido acima |
| `SLACK_TOKEN` | Token do bot do Slack (`xoxb-...`) — pegar com quem criou o bot |
| `SLACK_CHANNEL` | ID do canal de destino do report (não muda: `C09QVFRBB51`) |
| `SLACK_SCANNER_CHANNEL` | ID do canal de destino do scan (pode ser o mesmo) |
| `LITELLM_API_KEY` | Pegar no LiteLLM interno da Nubank (IST/Platform team) |
| `LITELLM_BASE_URL` | Não muda — já está preenchido acima |

### 4. Configurar acesso ao GitHub

Peça para transferir o repositório para o seu usuário GitHub ou te adicionar como colaborador em `chrisbelem/issue-management-report`.

```bash
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@nubank.com.br"
```

Se o repositório for transferido para o seu usuário, atualizar o remote:
```bash
git remote set-url origin https://github.com/SEU_USUARIO/issue-management-report.git
```

### 5. Criar pasta de logs
```bash
mkdir -p ~/issue-management-report/logs
```

---

## Como rodar o report manualmente

Sempre com **VPN ativa** (ou no escritório):

```bash
cd ~/issue-management-report

# 1. Gera dados + envia Slack
/opt/homebrew/bin/python3 scripts/generate_report.py

# 2. Build do dashboard React
cd steerco && /opt/homebrew/bin/npm run build && cd ..

# 3. Publicar no GitHub Pages
git add docs/ steerco/public/data.json apps_script/
git commit -m "chore: weekly report $(date +'%Y-%m-%d')"
git push origin main

# 4. (Opcional) Atualizar Google Sites via Apps Script
cd apps_script && clasp push && cd ..
```

Para rodar **sem enviar mensagem no Slack** (teste):
```bash
/opt/homebrew/bin/python3 scripts/generate_report.py --no-slack
```

### Rodar o scan de potenciais Issues manualmente
```bash
cd ~/issue-management-report
/opt/homebrew/bin/python3 scripts/slack_issue_scanner.py

# Para testar sem enviar no Slack:
/opt/homebrew/bin/python3 scripts/slack_issue_scanner.py --no-slack
```

---

## Automação local (launchd) — roda toda segunda automaticamente

O `run_weekly.sh` já executa tudo na sequência: report → build React → git push → scan de issues.

### 1. Criar o arquivo de configuração do launchd

> Substituir `SEU_USUARIO` pelo seu usuário do Mac (resultado de `whoami`)

```bash
cat > ~/Library/LaunchAgents/com.christiane.issue-management-report.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.christiane.issue-management-report</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/Users/SEU_USUARIO/issue-management-report/scripts/run_weekly.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>/Users/SEU_USUARIO/issue-management-report</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>8</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/SEU_USUARIO/issue-management-report/logs/run.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/SEU_USUARIO/issue-management-report/logs/run.log</string>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
EOF
```

> O bloco `EnvironmentVariables` com o `PATH` é essencial — sem ele o launchd não encontra o `node`.

### 2. Ativar a automação
```bash
launchctl load ~/Library/LaunchAgents/com.christiane.issue-management-report.plist
```

### 3. Verificar se está ativa
```bash
launchctl list | grep issue-management
# Saída esperada: -  0  com.christiane.issue-management-report
# O "0" significa que a última execução foi bem-sucedida. "1" significa erro.
```

### 4. Forçar execução imediata (para testar)
```bash
launchctl start com.christiane.issue-management-report
sleep 60
tail -50 ~/issue-management-report/logs/run.log
```

> O Mac precisa estar **ligado e com VPN ativa** na segunda-feira às 8h.
> Se estiver desligado, rodar manualmente quando voltar.

---

## Manutenção recorrente

### Token do Databricks expirou (erro 401 ou 403)
1. Acessar: Databricks → User Settings → Developer → Access Tokens → Generate new token
2. Atualizar `DATABRICKS_TOKEN` no arquivo `.env`

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

No arquivo `scripts/generate_report.py`, no início, existem dois sets para exclusão manual temporária:

```python
EXCLUDED_ISSUES = {'I012319'}   # ← adicionar o código aqui
EXCLUDED_APS    = {'AP015815'}  # ← adicionar o código aqui
```

Remover da lista quando o dado estiver correto no Databricks.

### Canais do scanner com erro `channel_not_found` ou `not_in_channel`

O bot do Slack precisa ser convidado no canal. No Slack:
1. Abrir o canal
2. Digitar `/invite @nome-do-bot`

Os canais monitorados estão configurados no início de `scripts/slack_issue_scanner.py` no dicionário `CHANNELS_TO_MONITOR`.

### Ver log da última execução
```bash
tail -100 ~/issue-management-report/logs/run.log
```

---

## Estrutura dos arquivos importantes

```
issue-management-report/
├── scripts/
│   ├── generate_report.py       ← report semanal (busca Databricks → Slack → HTML)
│   ├── slack_issue_scanner.py   ← scan de potenciais issues via Claude
│   └── run_weekly.sh            ← orquestra tudo: python → npm build → git push → scan
├── steerco/
│   ├── src/components/
│   │   ├── OverviewTab.jsx      ← gráficos por BA, KPIs, tabela consolidada
│   │   ├── DetailsTab.jsx       ← issues e APs late com presentation notes
│   │   ├── LateIssues.jsx       ← cards de issues late
│   │   └── CriticalAPs.jsx      ← cards de APs críticos
│   └── public/data.json         ← gerado pelo script (não editar manualmente)
├── apps_script/
│   ├── Code.gs                  ← Google Apps Script (serve o HTML no Google Sites)
│   ├── index.html               ← gerado pelo script (não editar manualmente)
│   ├── appsscript.json          ← config do Apps Script
│   └── .clasp.json              ← ID do script no Google (não commitar o token)
├── docs/                        ← build do React (GitHub Pages serve daqui)
├── data/config/
│   └── people_mapping.csv       ← fallback manual pessoa → BU/BA
├── .env                         ← credenciais (não está no git — criar manualmente)
└── HANDOFF.md                   ← este arquivo
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

## Checklist de transferência (o que Christiane precisa fazer)

- [ ] Adicionar a nova pessoa como **colaboradora** no GitHub: `github.com/chrisbelem/issue-management-report` → Settings → Collaborators
- [ ] Passar o arquivo `.env` com todas as credenciais (Databricks token, Slack token, LiteLLM key) **por canal seguro** (não por e-mail)
- [ ] Gerar um novo `DATABRICKS_TOKEN` no Databricks para a nova pessoa (tokens são pessoais)
- [ ] Compartilhar o token do bot do Slack (`xoxb-...`) — ou criar um novo bot se necessário
- [ ] Passar a `LITELLM_API_KEY` — pegar com o time de IST/Platform se não tiver
- [ ] Dar acesso ao Google Apps Script do Google Sites: abrir `script.google.com`, localizar o projeto "Issues & Action Plans" e compartilhar com o e-mail da nova pessoa
- [ ] Transferir (ou renomear) o repositório GitHub para o usuário da nova pessoa — ou mantê-lo em `chrisbelem` e só dar permissão de push
- [ ] Fazer um run conjunto na primeira segunda-feira para garantir que tudo funciona no Mac da nova pessoa
