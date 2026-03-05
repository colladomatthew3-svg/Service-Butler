#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env.local ]]; then
  cp .env.example .env.local
fi

set_env_key() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env.local; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" .env.local && rm -f .env.local.bak
  else
    printf "\n%s=%s\n" "$key" "$value" >> .env.local
  fi
}

set_env_key "DEMO_MODE" "on"

echo "Demo mode enabled (DEMO_MODE=on)."
echo "Start local stack if needed: bash scripts/dev-up.sh"
echo "Opening app at http://localhost:3000/dashboard"

npm run dev
