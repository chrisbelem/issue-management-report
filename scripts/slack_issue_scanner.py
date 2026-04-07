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

CHANNELS_TO_MONITOR = [
    'lending-secured-bu-private',
    'lending-secured-cpx-policy-legal-compliance',
    'lending-secured-inss-public-employees-pvt',
    'lending-secured-lending-private-inss-public',
    'lending-pj-wcl',
    'lending-pj-invoice',
    'lending-new-markets-squad',
    'lending-inss-squad-pvt',
    'lending-eng-ops',
]

DAYS_BACK    = 7        # janela de análise em dias
CLAUDE_MODEL = 'claude-sonnet-4-6'
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
ANTHROPIC_API_KEY     = os.environ.get('ANTHROPIC_API_KEY', '')

# ─── Slack API ─────────────────────────────────────────────────────────────────

def slack_get(method, params=None):
    url = f'https://slack.com/api/{method}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {SLACK_TOKEN}'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    if not data.get('ok'):
        raise RuntimeError(f'Slack API error [{method}]: {data.get("error")}')
    return data


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


def get_messages(channel_id, oldest_ts):
    """Retorna lista de textos de mensagens humanas desde oldest_ts."""
    SKIP_SUBTYPES = {'channel_join', 'channel_leave', 'channel_archive',
                     'channel_unarchive', 'bot_message', 'file_share'}
    messages = []
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
            if not text or len(text) < 10:   # ignora reações e mensagens muito curtas
                continue
            messages.append(text)
        cursor = data.get('response_metadata', {}).get('next_cursor', '')
        if not cursor or not data.get('has_more'):
            break
        time.sleep(0.3)
    return messages

# ─── Claude API ────────────────────────────────────────────────────────────────

def ask_claude(messages_payload):
    body = json.dumps({
        'model': CLAUDE_MODEL,
        'max_tokens': 4000,
        'messages': messages_payload,
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=body,
        headers={
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read())['content'][0]['text']

# ─── Prompt ────────────────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """\
Você é especialista em gestão de riscos operacionais do Nubank Global Lending.

Analise as mensagens dos canais do Slack abaixo e identifique situações que deveriam \
ser registradas como um Issue no Projac (sistema de gestão de issues de risco).

## Critérios para registrar um Issue no Projac

**DEVE virar Issue:**
- Falha operacional ou incidente recorrente (mesmo que já resolvido)
- Problema regulatório, de compliance ou auditoria sem resolução
- Risco identificado sem plano de mitigação definido
- Decisão de negócio que cria exposição a risco (produto novo, mudança de processo)
- Problema de processo afetando clientes, parceiros ou parceiros de negócio
- Prazo regulatório próximo sem ação documentada

**NÃO deve virar Issue:**
- Discussões operacionais do dia a dia sem risco identificado
- Perguntas técnicas com respostas satisfatórias
- Deploy, manutenção planejada ou mudanças sem incidentes
- Avisos internos, celebrações, onboarding

## Mensagens analisadas

{channel_content}

## Resposta esperada

Para cada potencial Issue identificado, retorne:

**Issue potencial N:** [título curto]
- **Canal:** #nome-do-canal
- **Resumo:** o que aconteceu / qual o risco em 2–3 frases
- **Por que é um Issue:** justificativa baseada nos critérios
- **Responsável sugerido:** nome mencionado nas mensagens ou área responsável (se identificável)
- **Urgência:** 🔴 Alta / 🟡 Média / 🟢 Baixa

Se nenhuma mensagem indicar necessidade de registro, diga: \
"Nenhum potencial Issue identificado esta semana."

Responda em português.
"""


def build_channel_content(channel_messages: dict) -> str:
    parts = []
    for channel, msgs in channel_messages.items():
        if not msgs:
            continue
        sample = msgs[-MAX_MSGS_PER_CHANNEL:]   # mais recentes primeiro
        formatted = '\n'.join(f'  • {m[:MAX_MSG_LEN]}{"…" if len(m) > MAX_MSG_LEN else ""}' for m in sample)
        parts.append(f'### #{channel} ({len(msgs)} mensagens)\n{formatted}')
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
    if not ANTHROPIC_API_KEY:
        missing.append('ANTHROPIC_API_KEY')
    if not no_slack and not SLACK_CHANNEL:
        missing.append('SLACK_CHANNEL (ou SLACK_SCANNER_CHANNEL)')
    if missing:
        print(f'ERRO: variáveis não configuradas no .env: {", ".join(missing)}')
        sys.exit(1)

    oldest_ts = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).timestamp()
    week_label = datetime.now().strftime('%d/%m/%Y')
    print(f'[slack_issue_scanner] Período: últimos {DAYS_BACK} dias (até {week_label})')

    # 1. Resolver nomes → IDs
    print('[slack_issue_scanner] Resolvendo IDs dos canais...')
    try:
        channel_map = resolve_channels(set(CHANNELS_TO_MONITOR))
    except RuntimeError as e:
        print(f'ERRO ao listar canais: {e}')
        print('  Verifique se o SLACK_TOKEN tem permissões: channels:read, groups:read')
        sys.exit(1)

    missing_channels = [c for c in CHANNELS_TO_MONITOR if c not in channel_map]
    if missing_channels:
        print(f'  AVISO: canais não encontrados (bot não convidado?): {", ".join(missing_channels)}')

    # 2. Buscar mensagens
    channel_messages = {}
    for name in CHANNELS_TO_MONITOR:
        ch_id = channel_map.get(name)
        if not ch_id:
            continue
        print(f'  -> #{name}...', end=' ', flush=True)
        try:
            msgs = get_messages(ch_id, oldest_ts)
            print(f'{len(msgs)} mensagens')
            if msgs:
                channel_messages[name] = msgs
        except RuntimeError as e:
            print(f'ERRO: {e} (bot foi convidado neste canal?)')
        time.sleep(0.2)

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
