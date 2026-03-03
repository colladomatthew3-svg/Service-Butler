#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
PIDS_FILE="$ROOT_DIR/.pids"
ENV_FILE="$ROOT_DIR/.env.local"
mkdir -p "$LOG_DIR"
ENV_CHANGED=0

print_header() {
  echo ""
  echo "=============================="
  echo "$1"
  echo "=============================="
}

have_cmd() { command -v "$1" >/dev/null 2>&1; }

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! have_cmd "$cmd"; then
    echo "❌ Missing required command: $cmd"
    echo "   Install hint: $hint"
    exit 1
  fi
}

optional_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! have_cmd "$cmd"; then
    echo "⚠️ Optional command missing: $cmd ($hint)"
  fi
}

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

get_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo ""
    return
  fi
  local line
  line=$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 || true)
  echo "${line#*=}"
}

ensure_env_key() {
  local key="$1"
  if ! grep -q -E "^${key}=" "$ENV_FILE"; then
    echo "${key}=" >> "$ENV_FILE"
  fi
}

set_env_key() {
  local key="$1"
  local value="$2"
  local previous
  previous="$(get_env_value "$key")"

  if grep -q -E "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi

  if [[ "$previous" != "$value" ]]; then
    ENV_CHANGED=1
  fi
}

write_pid() {
  local name="$1"
  local pid="$2"
  if [[ -f "$PIDS_FILE" ]]; then
    grep -v -E "^${name}:" "$PIDS_FILE" > "$PIDS_FILE.tmp" || true
    mv "$PIDS_FILE.tmp" "$PIDS_FILE"
  fi
  echo "${name}:${pid}" >> "$PIDS_FILE"
}

get_pid() {
  local name="$1"
  if [[ ! -f "$PIDS_FILE" ]]; then
    echo ""
    return
  fi
  grep -E "^${name}:" "$PIDS_FILE" | tail -n1 | cut -d: -f2 || true
}

start_bg() {
  local name="$1"
  local logfile="$2"
  shift 2

  nohup "$@" > "$logfile" 2>&1 &
  local pid=$!
  write_pid "$name" "$pid"
  sleep 1

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "❌ Failed to start $name. Check $logfile"
    exit 1
  fi
}

extract_ngrok_url() {
  local body
  body="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null || true)"
  if [[ -z "$body" ]]; then
    echo ""
    return
  fi

  if have_cmd jq; then
    echo "$body" | jq -r '.tunnels[] | select(.proto=="https") | .public_url' | head -n1
    return
  fi

  echo "$body" | grep -Eo 'https://[^" ]+' | grep 'ngrok' | head -n1 || true
}

extract_whsec() {
  local file="$1"
  grep -Eo 'whsec_[A-Za-z0-9]+' "$file" | tail -n1 || true
}

create_stripe_price_if_missing() {
  local existing
  existing="$(get_env_value STRIPE_PRICE_ID)"
  if [[ -n "$existing" ]]; then
    return 0
  fi

  echo "STRIPE_PRICE_ID is empty. Attempting to create Stripe test product + monthly price..."
  if ! have_cmd stripe; then
    echo "⚠️ Stripe CLI not found; create a recurring test price in dashboard and paste STRIPE_PRICE_ID into .env.local"
    return 0
  fi

  local product_json product_id price_json price_id
  if have_cmd jq; then
    product_json="$(stripe products create --name 'ServiceButler Test Plan' --description 'Local test plan' --format json 2>/dev/null || true)"
    product_id="$(echo "$product_json" | jq -r '.id // empty' 2>/dev/null || true)"
  else
    product_json="$(stripe products create --name 'ServiceButler Test Plan' --description 'Local test plan' --format json 2>/dev/null || true)"
    product_id="$(echo "$product_json" | grep -Eo '"id"\s*:\s*"prod_[^"]+"' | head -n1 | sed -E 's/.*"(prod_[^"]+)".*/\1/' || true)"
  fi

  if [[ -z "$product_id" ]]; then
    echo "⚠️ Could not create Stripe product automatically. Create one test recurring monthly price manually and paste STRIPE_PRICE_ID into .env.local"
    return 0
  fi

  price_json="$(stripe prices create --currency usd --unit-amount 9900 --recurring interval=month --product "$product_id" --format json 2>/dev/null || true)"
  if have_cmd jq; then
    price_id="$(echo "$price_json" | jq -r '.id // empty' 2>/dev/null || true)"
  else
    price_id="$(echo "$price_json" | grep -Eo '"id"\s*:\s*"price_[^"]+"' | head -n1 | sed -E 's/.*"(price_[^"]+)".*/\1/' || true)"
  fi

  if [[ -n "$price_id" ]]; then
    set_env_key "STRIPE_PRICE_ID" "$price_id"
    echo "✅ STRIPE_PRICE_ID set to $price_id"
  else
    echo "⚠️ Could not create Stripe price automatically. Create one recurring monthly test price and paste STRIPE_PRICE_ID into .env.local"
  fi
}

print_header "Prerequisites"
require_cmd node "https://nodejs.org/"
require_cmd npm "https://nodejs.org/"
require_cmd npx "Installed with Node.js"
require_cmd docker "https://docs.docker.com/get-docker/"
require_cmd ngrok "https://ngrok.com/download"
require_cmd stripe "https://docs.stripe.com/stripe-cli"
optional_cmd jq "brew install jq"
optional_cmd psql "Install PostgreSQL client if you want SQL validations"

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker appears to be stopped. Start Docker Desktop and run this script again."
  exit 1
fi

print_header "Environment"
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

for key in \
  NEXT_PUBLIC_APP_URL WEBHOOK_BASE_URL \
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL \
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID \
  ALLOW_OUTBOUND_WITHOUT_STRIPE SUBSCRIPTION_GRACE_DAYS; do
  ensure_env_key "$key"
done

if [[ -z "$(get_env_value NEXT_PUBLIC_APP_URL)" ]]; then
  set_env_key "NEXT_PUBLIC_APP_URL" "http://localhost:3000"
fi
if [[ -z "$(get_env_value ALLOW_OUTBOUND_WITHOUT_STRIPE)" ]]; then
  set_env_key "ALLOW_OUTBOUND_WITHOUT_STRIPE" "false"
fi
if [[ -z "$(get_env_value SUBSCRIPTION_GRACE_DAYS)" ]]; then
  set_env_key "SUBSCRIPTION_GRACE_DAYS" "3"
fi

print_header "Install + Database"
npm install
npx supabase start | tee "$LOG_DIR/supabase-start.log"

SUPABASE_STATUS_ENV="$(npx supabase status -o env 2>/dev/null || true)"
SUPABASE_STUDIO_URL="http://127.0.0.1:54323"
SUPABASE_API_URL="http://127.0.0.1:54321"

if [[ -z "$SUPABASE_STATUS_ENV" && -f "$LOG_DIR/supabase-start.log" ]]; then
  # Fallback parser for plain-text `supabase start` output.
  api_url="$(grep -E 'API URL:|Project URL:' "$LOG_DIR/supabase-start.log" | head -n1 | sed -E 's/.*(http[^ ]+).*/\1/' || true)"
  studio_url="$(grep -E 'Studio URL:' "$LOG_DIR/supabase-start.log" | head -n1 | sed -E 's/.*(http[^ ]+).*/\1/' || true)"
  anon_key="$(grep -E 'anon key:|Publishable key:' "$LOG_DIR/supabase-start.log" | head -n1 | sed -E 's/.*: *//' || true)"
  service_key="$(grep -E 'service_role key:|Secret key:' "$LOG_DIR/supabase-start.log" | head -n1 | sed -E 's/.*: *//' || true)"
  db_url="$(grep -E 'DB URL:' "$LOG_DIR/supabase-start.log" | head -n1 | sed -E 's/.*(postgres[^ ]+).*/\1/' || true)"

  [[ -n "$api_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"SUPABASE_URL=$api_url"
  [[ -n "$studio_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"STUDIO_URL=$studio_url"
  [[ -n "$anon_key" ]] && SUPABASE_STATUS_ENV+=$'\n'"ANON_KEY=$anon_key"
  [[ -n "$service_key" ]] && SUPABASE_STATUS_ENV+=$'\n'"SERVICE_ROLE_KEY=$service_key"
  [[ -n "$db_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"DB_URL=$db_url"
fi

if [[ -n "$SUPABASE_STATUS_ENV" ]]; then
  while IFS='=' read -r k v; do
    [[ -z "${k:-}" ]] && continue
    case "$k" in
      API_URL|SUPABASE_URL)
        SUPABASE_API_URL="$v"
        # Always refresh local Supabase URL after `supabase start`.
        set_env_key "NEXT_PUBLIC_SUPABASE_URL" "$v"
        ;;
      STUDIO_URL)
        SUPABASE_STUDIO_URL="$v"
        ;;
      ANON_KEY|SUPABASE_ANON_KEY)
        # Always refresh local publishable (anon) key after `supabase start`.
        set_env_key "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$v"
        ;;
      SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)
        # Always refresh local service role key after `supabase start`.
        set_env_key "SUPABASE_SERVICE_ROLE_KEY" "$v"
        ;;
      DB_URL|SUPABASE_DB_URL)
        if [[ -z "$(get_env_value SUPABASE_DB_URL)" ]]; then set_env_key "SUPABASE_DB_URL" "$v"; fi
        ;;
    esac
  done <<< "$SUPABASE_STATUS_ENV"
fi

if ! wait_for_url "$SUPABASE_STUDIO_URL" 120; then
  echo "❌ Supabase Studio did not become healthy at $SUPABASE_STUDIO_URL"
  echo "   Recovery: npx supabase stop && npx supabase start"
  echo "   Check: docker ps"
  exit 1
fi

if ! retry_cmd "supabase db push" 3 2 npx supabase db push; then
  echo "   Recovery: npx supabase db push"
  exit 1
fi

SEED_STATUS="ok"
if ! node scripts/seed-users.mjs; then
  SEED_STATUS="failed"
  echo "⚠️ seed-users step failed. Continuing with services so you can inspect logs."
  echo "   Recovery: node scripts/seed-users.mjs"
fi

if ! retry_cmd "supabase db seed" 3 2 npx supabase db seed; then
  SEED_STATUS="failed"
  echo "⚠️ Database seed failed after retries. Continuing with services; Supabase containers remain running."
  echo "   Recovery: npx supabase db seed"
  echo "   Check logs: tail -n 200 logs/next.log"
fi

print_header "Start Services"
bash scripts/dev-down.sh >/dev/null 2>&1 || true
: > "$PIDS_FILE"

start_bg "next" "$LOG_DIR/next.log" npm run dev
start_bg "inngest" "$LOG_DIR/inngest.log" npm run inngest:dev
start_bg "ngrok" "$LOG_DIR/ngrok.log" ngrok http 3000 --log=stdout

NGROK_URL=""
for _ in $(seq 1 30); do
  NGROK_URL="$(extract_ngrok_url)"
  if [[ -n "$NGROK_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$NGROK_URL" ]]; then
  echo "❌ Could not retrieve ngrok URL automatically."
  echo "   Recovery: run ngrok http 3000"
  echo "   Then set WEBHOOK_BASE_URL in .env.local"
  exit 1
fi

set_env_key "WEBHOOK_BASE_URL" "$NGROK_URL"

start_bg "stripe_listen" "$LOG_DIR/stripe-listen.log" stripe listen --forward-to http://localhost:3000/api/stripe/webhook

WHSEC=""
for _ in $(seq 1 30); do
  WHSEC="$(extract_whsec "$LOG_DIR/stripe-listen.log")"
  if [[ -n "$WHSEC" ]]; then
    break
  fi
  sleep 1
done

if [[ -n "$WHSEC" ]]; then
  set_env_key "STRIPE_WEBHOOK_SECRET" "$WHSEC"
else
  echo "⚠️ Could not auto-capture STRIPE_WEBHOOK_SECRET from stripe listen output."
  echo "   Recovery: copy whsec_... from $LOG_DIR/stripe-listen.log into .env.local"
fi

create_stripe_price_if_missing

if [[ "$ENV_CHANGED" -eq 1 ]]; then
  echo "Environment changed; restarting Next.js to pick up new values..."
  NEXT_PID="$(get_pid next)"
  if [[ -n "$NEXT_PID" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
    sleep 1
  fi
  start_bg "next" "$LOG_DIR/next.log" npm run dev
fi

SMS_URL="$NGROK_URL/api/twilio/sms/inbound"
VOICE_URL="$NGROK_URL/api/twilio/voice/inbound"
STATUS_URL="$NGROK_URL/api/twilio/status"

NEXT_OK="no"
INNGEST_OK="no"
STRIPE_OK="no"
if kill -0 "$(get_pid next)" 2>/dev/null; then NEXT_OK="yes"; fi
if kill -0 "$(get_pid inngest)" 2>/dev/null; then INNGEST_OK="yes"; fi
if kill -0 "$(get_pid stripe_listen)" 2>/dev/null; then STRIPE_OK="yes"; fi

print_header "✅ READY"
echo "App URL:                 http://localhost:3000"
echo "Supabase Studio URL:     $SUPABASE_STUDIO_URL"
echo "ngrok URL:               $NGROK_URL"
echo "Twilio SMS inbound:      $SMS_URL"
echo "Twilio Voice inbound:    $VOICE_URL"
echo "Twilio Status callback:  $STATUS_URL"
echo "Stripe listener running: $STRIPE_OK"
echo "Stripe whsec source:     $LOG_DIR/stripe-listen.log"
echo "Next running:            $NEXT_OK"
echo "Inngest running:         $INNGEST_OK"
echo "Seed status:             $SEED_STATUS"
if [[ "$SEED_STATUS" == "failed" ]]; then
  echo "Seed recovery commands:  node scripts/seed-users.mjs && npx supabase db seed"
fi
echo "Logs:                    ./logs/next.log ./logs/inngest.log ./logs/ngrok.log ./logs/stripe-listen.log"
echo "Stop everything:         bash scripts/dev-down.sh"
echo "Optional clean DB reset: bash scripts/db-reset.sh"
