#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

wait_for_url() {
  local url="$1"
  local timeout_seconds="$2"
  local started
  started="$(date +%s)"

  while true; do
    local code
    code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
    if [[ "$code" == "200" ]]; then
      return 0
    fi

    if (( $(date +%s) - started >= timeout_seconds )); then
      return 1
    fi
    sleep 2
  done
}

retry_cmd() {
  local label="$1"
  local max_attempts="$2"
  local initial_sleep="$3"
  shift 3

  local attempt=1
  local sleep_for="$initial_sleep"
  while (( attempt <= max_attempts )); do
    if "$@"; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      echo "❌ $label failed after $attempt attempts."
      return 1
    fi

    echo "⚠️ $label failed (attempt $attempt/$max_attempts). Retrying in ${sleep_for}s..."
    sleep "$sleep_for"
    sleep_for=$((sleep_for * 2))
    attempt=$((attempt + 1))
  done
}

echo "Starting Supabase (if not already running)..."
npx supabase start

SUPABASE_STUDIO_URL="http://127.0.0.1:54323"
SUPABASE_STATUS_ENV="$(npx supabase status -o env 2>/dev/null || true)"
if [[ -n "$SUPABASE_STATUS_ENV" ]]; then
  while IFS='=' read -r k v; do
    [[ -z "${k:-}" ]] && continue
    if [[ "$k" == "STUDIO_URL" ]]; then
      SUPABASE_STUDIO_URL="$v"
    fi
  done <<< "$SUPABASE_STATUS_ENV"
fi

if ! wait_for_url "$SUPABASE_STUDIO_URL" 120; then
  echo "❌ Supabase Studio did not become healthy at $SUPABASE_STUDIO_URL"
  echo "   Recovery: npx supabase stop && npx supabase start"
  exit 1
fi

if ! retry_cmd "supabase db reset" 4 2 npx supabase db reset; then
  echo "   Recovery step 1: npx supabase stop"
  echo "   Recovery step 2: npx supabase start"
  echo "   Recovery step 3: npx supabase db reset"
  exit 1
fi

if ! retry_cmd "supabase db push" 3 2 npx supabase db push; then
  echo "   Recovery: npx supabase db push"
  exit 1
fi

if ! node scripts/seed-users.mjs; then
  echo "⚠️ seed-users failed. Run manually after fixing env:"
  echo "   node scripts/seed-users.mjs"
fi

if ! retry_cmd "supabase db seed" 3 2 npx supabase db seed; then
  echo "⚠️ db seed failed. Run manually:"
  echo "   npx supabase db seed"
fi

echo "✅ DB reset flow completed."
