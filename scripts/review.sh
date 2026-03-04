#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" .env.local; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" .env.local && rm -f .env.local.bak
  else
    printf "\n%s=%s\n" "$key" "$value" >> .env.local
  fi
}

upsert_env "REVIEW_MODE" "on"

cat <<MSG

====================================
ServiceButler Review Mode Enabled
====================================
Open first: http://localhost:3000/__review

Key routes:
- http://localhost:3000/
- http://localhost:3000/login
- http://localhost:3000/dashboard
- http://localhost:3000/dashboard/leads
- http://localhost:3000/dashboard/pipeline
- http://localhost:3000/dashboard/scanner
- http://localhost:3000/dashboard/schedule
- http://localhost:3000/dashboard/settings

If you get bounced to /login, verify REVIEW_MODE=on in .env.local and restart.
MSG

if command -v open >/dev/null 2>&1; then
  open "http://localhost:3000/__review" || true
fi

npm run dev
