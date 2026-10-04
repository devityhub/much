#!/usr/bin/env bash
# Sobe o PassTime no Fly.io com URL permanente https://<app>.fly.dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

if ! command -v fly >/dev/null 2>&1 && ! command -v flyctl >/dev/null 2>&1; then
  echo "Instalando flyctl…"
  curl -fsSL https://fly.io/install.sh | sh
fi

FLY="$(command -v fly || command -v flyctl)"
APP="${FLY_APP:-passtime}"
REGION="${FLY_REGION:-iad}"

if ! "$FLY" auth whoami >/dev/null 2>&1; then
  if [ -n "${FLY_API_TOKEN:-}" ]; then
    export FLY_API_TOKEN
    echo "Usando FLY_API_TOKEN…"
  elif [ -t 0 ]; then
    echo "Faça login no Fly.io (abre o navegador):"
    "$FLY" auth login
  else
    cat <<'EOF'
Sem login no Fly.io.

1. Crie conta em https://fly.io
2. No painel ou no seu PC:  fly tokens create deploy -x 999999h
3. Cole o token aqui (ou exporte FLY_API_TOKEN=...) e rode de novo:
     npm run deploy:fly

EOF
    exit 1
  fi
fi

if ! "$FLY" status -a "$APP" >/dev/null 2>&1; then
  echo "Criando app $APP…"
  "$FLY" apps create "$APP" --org personal 2>/dev/null \
    || "$FLY" apps create "$APP"
fi

# Volume persistente para SQLite + uploads
if ! "$FLY" volumes list -a "$APP" 2>/dev/null | grep -q passtime_data; then
  echo "Criando volume passtime_data…"
  "$FLY" volumes create passtime_data --region "$REGION" --size 1 -a "$APP" -y
fi

if ! "$FLY" secrets list -a "$APP" 2>/dev/null | grep -q JWT_SECRET; then
  SECRET="$(openssl rand -hex 32)"
  echo "Definindo JWT_SECRET…"
  "$FLY" secrets set JWT_SECRET="$SECRET" -a "$APP"
fi

echo "Fazendo deploy (build remoto)…"
"$FLY" deploy -a "$APP" --remote-only

HOSTNAME="$("$FLY" info -a "$APP" --json 2>/dev/null | node -pe 'JSON.parse(fs.readFileSync(0,"utf8")).Hostname||""' || true)"
if [ -z "$HOSTNAME" ]; then
  HOSTNAME="${APP}.fly.dev"
fi

echo
echo "PassTime no ar: https://${HOSTNAME}"
echo "Spotify Redirect URI: https://${HOSTNAME}/api/spotify/callback"
echo "Cole essa URI no app do Spotify Developer e (opcional) em SPOTIFY_REDIRECT_URI:"
echo "  fly secrets set SPOTIFY_REDIRECT_URI=https://${HOSTNAME}/api/spotify/callback -a $APP"
