#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "[run_weekly] $(date) — iniciando geração do report..."

# 1. Gera dados + envia pro Slack
/opt/homebrew/bin/python3 scripts/generate_report.py

# 2. Build do app React (SteerCo)
echo "[run_weekly] Buildando app SteerCo..."
cd steerco
/opt/homebrew/bin/npm run build
cd ..

# 3. Commit e push para GitHub Pages
echo "[run_weekly] Publicando no GitHub..."
git add docs/ steerco/public/data.json apps_script/
git diff --cached --quiet && echo "[run_weekly] Sem mudanças para commitar." || \
  git commit -m "chore: weekly report $(date +'%Y-%m-%d')" && git push origin main

echo "[run_weekly] Concluído."
