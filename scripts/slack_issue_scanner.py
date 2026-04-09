#!/usr/bin/env python3
"""
slack_issue_scanner.py

Lê mensagens dos últimos 7 dias nos canais configurados do Slack,
usa a API do Claude para identificar potenciais Issues para o Projac,
e envia o resumo no Slack.

Uso:
    python3 scripts/slack_issue_scanner.py            # roda completo + envia Slack
    python3 scripts/slack_issue_scanner.py --no-slack # roda e imprime no terminal, sem enviar
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timedelta, timezone

# ─── Canais a monitorar ────────────────────────────────────────────────────────

# IDs dos canais (botão direito no canal → "View channel details")
# Formato: { 'CHANNEL_ID': 'nome-do-canal' }
CHANNELS_TO_MONITOR = {
    'C02HQDV0U5S': 'lending-secured-cpx-policy-legal-compliance',
    'C06M9NW1CQK': 'lending-secured-inss-public-employees-pvt',
    'C04JTD26N2X': 'lending-secured-lending-private-inss-public',
    'C04QWP5BJAC': 'lending-pj-wcl',
    'C04LZ5CMKHS': 'lending-pj-invoice',
    'C028XSE4W0K': 'lending-new-markets-squad',
    'C04HKDV3N0Y': 'lending-inss-squad-pvt',
    'C09CGB66M1A': 'lending-eng-ops',
}

DAYS_BACK    = 7        # janela de análise em dias
MAX_MSGS_PER_CHANNEL = 150   # limita para não estourar contexto do Claude
MAX_MSG_LEN          = 400   # trunca mensagens muito longas

# ─── Carregar .env ─────────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env()

SLACK_TOKEN           = os.environ.get('SLACK_TOKEN', '')
SLACK_CHANNEL         = os.environ.get('SLACK_SCANNER_CHANNEL') or os.environ.get('SLACK_CHANNEL', '')
LITELLM_API_KEY   = os.environ.get('LITELLM_API_KEY', '')
LITELLM_BASE_URL  = os.environ.get('LITELLM_BASE_URL', 'https://ist-prod-litellm.nullmplatform.com')
CLAUDE_MODEL      = 'anthropic/claude-sonnet-4-6'

# ─── Slack API ─────────────────────────────────────────────────────────────────

def slack_get(method, params=None, _retries=4):
    url = f'https://slack.com/api/{method}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {SLACK_TOKEN}'})
    for attempt in range(_retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
            if not data.get('ok'):
                raise RuntimeError(f'Slack API error [{method}]: {data.get("error")}')
            return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get('Retry-After', 10)) + 2
                print(f' (rate limit, aguardando {wait}s...)', end=' ', flush=True)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f'Slack API [{method}]: muitas tentativas após rate limit')


def resolve_channels(names):
    """Mapeia nome → id para todos os canais (públicos e privados)."""
    name_map = {}
    cursor = None
    while True:
        params = {'limit': 200, 'types': 'public_channel,private_channel'}
        if cursor:
            params['cursor'] = cursor
        data = slack_get('conversations.list', params)
        for ch in data.get('channels', []):
            if ch['name'] in names:
                name_map[ch['name']] = ch['id']
        cursor = data.get('response_metadata', {}).get('next_cursor', '')
        if not cursor:
            break
        time.sleep(0.3)
    return name_map


def get_thread_replies(channel_id, thread_ts):
    """Retorna replies de uma thread (exclui a mensagem-pai que já foi coletada)."""
    params = {'channel': channel_id, 'ts': thread_ts, 'limit': 100}
    data = slack_get('conversations.replies', params)
    replies = []
    for m in data.get('messages', [])[1:]:   # [0] é a mensagem-pai
        if m.get('bot_id') or m.get('app_id'):
            continue
        text = (m.get('text') or '').strip()
        if text and len(text) >= 5:
            replies.append(text)
    return replies


def make_slack_link(channel_id, ts):
    """Constrói link direto para a thread no Slack."""
    ts_clean = ts.replace('.', '')
    return f'https://nubank.slack.com/archives/{channel_id}/p{ts_clean}'


def get_messages(channel_id, oldest_ts):
    """Retorna threads completas (mensagem-pai + replies) desde oldest_ts."""
    SKIP_SUBTYPES = {'channel_join', 'channel_leave', 'channel_archive',
                     'channel_unarchive', 'bot_message', 'file_share'}
    threads = []
    cursor = None
    while True:
        params = {'channel': channel_id, 'oldest': str(oldest_ts), 'limit': 200}
        if cursor:
            params['cursor'] = cursor
        data = slack_get('conversations.history', params)
        for m in data.get('messages', []):
            if m.get('subtype') in SKIP_SUBTYPES:
                continue
            if m.get('bot_id') or m.get('app_id'):
                continue
            text = (m.get('text') or '').strip()
            if not text or len(text) < 5:
                continue
            thread = {
                'parent': text,
                'link': make_slack_link(channel_id, m['ts']),
                'replies': [],
            }
            if m.get('reply_count', 0) > 0:
                try:
                    thread['replies'] = get_thread_replies(channel_id, m['ts'])
                    time.sleep(0.3)
                except RuntimeError:
                    pass
            threads.append(thread)
        cursor = data.get('response_metadata', {}).get('next_cursor', '')
        if not cursor or not data.get('has_more'):
            break
        time.sleep(0.3)
    return threads

# ─── Claude API ────────────────────────────────────────────────────────────────

def ask_claude(messages_payload):
    """Chama o LiteLLM proxy interno do Nubank (formato OpenAI-compatible)."""
    body = json.dumps({
        'model': CLAUDE_MODEL,
        'max_tokens': 4000,
        'messages': messages_payload,
    }).encode()
    req = urllib.request.Request(
        f'{LITELLM_BASE_URL}/v1/chat/completions',
        data=body,
        headers={
            'Authorization': f'Bearer {LITELLM_API_KEY}',
            'content-type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())['choices'][0]['message']['content']

# ─── Prompt ────────────────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """\
You are a risk management expert supporting the Global Lending team at Nubank.

Analyze the Slack messages below and identify situations that should be registered \
as an Issue in Projac, following Nubank's Issue Management Methodology.

## Nubank's official definition

An **Issue** is a **control gap or deficiency** resulting from an internal or external \
source that poses a **new risk or an increased level of known risk** to Nubank. \
It may arise from systems, processes, and/or personnel — including non-compliance \
with policies, standards, and regulations.

## Must be registered as an Issue

- A control is missing, ineffective, or insufficient to mitigate a known risk
- Non-compliance with internal policies, regulatory requirements, or standards
- A risk event that materialized (incident, loss, regulatory finding)
- **Any finding, observation, or question raised by a regulator or external auditor** \
(e.g. CGU, Bacen, external audit, SOX auditors) — even if still under discussion or \
response. These must always be registered as Issues because they represent an \
opportunity to identify and implement controls to mitigate the reported risk. \
Risk acceptance is NOT permitted for regulator findings.
- A recurring issue — previously identified but not fully resolved
- A process or system gap that exposes the company to new or increased risk

## Must NOT be flagged as an Issue

- Operational discussions, questions, or decisions without an identified control gap
- Incidents that were fully resolved with no residual risk or gap remaining
- NP&F+ assessments (these follow a separate "Potential Issue" process)
- Routine updates, announcements, celebratory messages, or onboarding
- Risks already being managed with documented action plans in Projac

## Slack messages to analyze

{channel_content}

## Expected output

For each potential Issue found, return:

**Potential Issue N:** [short title in English, as it would appear in Projac]
- **Channel:** #channel-name
- **Thread:** [paste the thread_link URL from the message that originated this Issue]
- **Summary:** What happened and what control gap or risk it represents (2–3 sentences)
- **Why it qualifies as an Issue:** Reference to the specific control gap or deficiency, \
and why it poses new or increased risk per Nubank's methodology
- **Suggested owner:** Name or team mentioned in the messages, if identifiable
- **Suggested rating:** 🔴 Very High / 🔴 High / 🟡 Medium / 🟢 Low — with brief justification

If no messages indicate a genuine control gap or deficiency, respond: \
"No potential Issues identified this week."

Be conservative: only flag situations with a clear control gap. \
Do not flag general risks, discussions, or resolved incidents.
"""


def build_channel_content(channel_threads: dict) -> str:
    parts = []
    for channel, threads in channel_threads.items():
        if not threads:
            continue
        sample = threads[-MAX_MSGS_PER_CHANNEL:]
        lines = []
        for t in sample:
            parent = t['parent'][:MAX_MSG_LEN] + ('…' if len(t['parent']) > MAX_MSG_LEN else '')
            lines.append(f'  • [thread_link: {t["link"]}] {parent}')
            for reply in t['replies'][:20]:
                r = reply[:MAX_MSG_LEN] + ('…' if len(reply) > MAX_MSG_LEN else '')
                lines.append(f'      ↳ {r}')
        parts.append(f'### #{channel} ({len(threads)} threads)\n' + '\n'.join(lines))
    return '\n\n'.join(parts) if parts else '(nenhuma mensagem encontrada)'

# ─── Slack output ──────────────────────────────────────────────────────────────

def send_slack_message(text):
    body = json.dumps({'channel': SLACK_CHANNEL, 'text': text}).encode()
    req = urllib.request.Request(
        'https://slack.com/api/chat.postMessage',
        data=body,
        headers={
            'Authorization': f'Bearer {SLACK_TOKEN}',
            'Content-Type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    if not data.get('ok'):
        raise RuntimeError(f'Slack send error: {data.get("error")}')

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    no_slack = '--no-slack' in sys.argv

    # Validações
    missing = []
    if not SLACK_TOKEN:
        missing.append('SLACK_TOKEN')
    if not LITELLM_API_KEY:
        missing.append('LITELLM_API_KEY')
    if not no_slack and not SLACK_CHANNEL:
        missing.append('SLACK_CHANNEL (ou SLACK_SCANNER_CHANNEL)')
    if missing:
        print(f'ERRO: variáveis não configuradas no .env: {", ".join(missing)}')
        sys.exit(1)

    oldest_ts = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).timestamp()
    week_label = datetime.now().strftime('%d/%m/%Y')
    print(f'[slack_issue_scanner] Período: últimos {DAYS_BACK} dias (até {week_label})')

    # Buscar mensagens usando IDs diretamente (sem precisar listar todos os canais)
    channel_messages = {}
    for ch_id, name in CHANNELS_TO_MONITOR.items():
        print(f'  -> #{name}...', end=' ', flush=True)
        try:
            msgs = get_messages(ch_id, oldest_ts)
            print(f'{len(msgs)} mensagens')
            if msgs:
                channel_messages[name] = msgs
        except RuntimeError as e:
            print(f'ERRO: {e} (bot foi convidado neste canal?)')
        time.sleep(0.5)

    total_msgs = sum(len(v) for v in channel_messages.values())
    if total_msgs == 0:
        print('\nNenhuma mensagem encontrada. Verifique se o bot foi convidado nos canais.')
        return

    print(f'\n[slack_issue_scanner] {total_msgs} mensagens em {len(channel_messages)} canais.')

    # 3. Analisar com Claude
    print('[slack_issue_scanner] Analisando com Claude...')
    channel_content = build_channel_content(channel_messages)
    prompt = ANALYSIS_PROMPT.format(channel_content=channel_content)
    analysis = ask_claude([{'role': 'user', 'content': prompt}])

    print('\n' + '─' * 60)
    print(analysis)
    print('─' * 60)

    # 4. Enviar no Slack
    if no_slack:
        print('\n[--no-slack] Envio para o Slack ignorado.')
    else:
        header = (
            f':mag: *Scan semanal de Potenciais Issues — {week_label}*\n'
            f'_{total_msgs} mensagens analisadas em {len(channel_messages)} canais_\n\n'
        )
        send_slack_message(header + analysis)
        print(f'\n[slack_issue_scanner] Resumo enviado no canal {SLACK_CHANNEL}.')


if __name__ == '__main__':
    main()
