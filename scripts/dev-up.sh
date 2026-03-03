#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
PIDS_FILE="$ROOT_DIR/.pids"
ENV_FILE="$ROOT_DIR/.env.local"
mkdir -p "$LOG_DIR"

DEV_UP_LOG="$LOG_DIR/dev-up.log"
SUPABASE_LOG="$LOG_DIR/supabase.log"
DB_PUSH_LOG="$LOG_DIR/db-push.log"
SEED_USERS_LOG="$LOG_DIR/seed-users.log"
DB_SEED_LOG="$LOG_DIR/db-seed.log"
NEXT_LOG="$LOG_DIR/next.log"
INNGEST_LOG="$LOG_DIR/inngest.log"
NGROK_LOG="$LOG_DIR/ngrok.log"
STRIPE_LISTEN_LOG="$LOG_DIR/stripe-listen.log"

: > "$DEV_UP_LOG"
exec > >(tee -a "$DEV_UP_LOG") 2>&1

ENV_CHANGED=0
FATAL=0
SEED_STATUS="ok"
SUPABASE_HEALTHY="no"
CORE_AUTH_STATUS="failed"
CORE_AUTH_CODE="000"
CORE_REST_STATUS="failed"
CORE_REST_CODE="000"
STUDIO_HTTP_CODE="000"
DB_PUSH_STATUS="not-run"
CURRENT_DB_MODE="local"
NGROK_STATUS="not-started"
NGROK_URL=""
NGROK_REASON=""
STRIPE_STATUS="not-started"
STRIPE_REASON=""
CURRENT_BILLING_MODE="disabled"
SUPABASE_STUDIO_URL="http://127.0.0.1:54323"
APP_URL="http://localhost:3000"

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
    FATAL=1
  fi
}

optional_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! have_cmd "$cmd"; then
    echo "⚠️ Optional command missing: $cmd ($hint)"
  fi
}

unquote() {
  local s="$1"
  s="${s%\"}"
  s="${s#\"}"
  echo "$s"
}

http_code_for_url() {
  local url="$1"
  curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000"
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

retry_cmd_logged() {
  local label="$1"
  local max_attempts="$2"
  local initial_sleep="$3"
  local logfile="$4"
  shift 4

  local attempt=1
  local sleep_for="$initial_sleep"

  while (( attempt <= max_attempts )); do
    : > "$logfile"
    if "$@" > >(tee -a "$logfile") 2> >(tee -a "$logfile" >&2); then
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

  local existing_pid
  existing_pid="$(get_pid "$name")"
  if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "ℹ️ $name already running (pid $existing_pid)."
    return 0
  fi

  nohup "$@" > "$logfile" 2>&1 &
  local pid=$!
  write_pid "$name" "$pid"
  sleep 1

  if ! kill -0 "$pid" 2>/dev/null; then
    return 1
  fi

  return 0
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

print_ready() {
  print_header "READY"
  echo "App URL:                 $APP_URL"
  if [[ "$CURRENT_DB_MODE" == "remote" ]]; then
    echo "DB:                      remote (db push enabled)"
  else
    echo "DB:                      local (migrations applied on start)"
  fi
  echo "Supabase Studio URL:     $SUPABASE_STUDIO_URL (optional, http $STUDIO_HTTP_CODE)"
  echo "Core auth health:        $CORE_AUTH_STATUS (http $CORE_AUTH_CODE)"
  echo "Core rest health:        $CORE_REST_STATUS (http $CORE_REST_CODE)"
  if [[ "$CURRENT_BILLING_MODE" == "disabled" ]]; then
    echo "Billing:                 disabled (MVP mode)"
  else
    echo "Billing:                 stripe"
  fi
  if [[ -n "$NGROK_URL" ]]; then
    echo "ngrok URL:               $NGROK_URL"
    echo "Twilio SMS inbound:      $NGROK_URL/api/twilio/sms/inbound"
    echo "Twilio Voice inbound:    $NGROK_URL/api/twilio/voice/inbound"
    echo "Twilio Status callback:  $NGROK_URL/api/twilio/status"
  else
    echo "ngrok URL:               ngrok not started ($NGROK_REASON)"
  fi
  if [[ "$STRIPE_STATUS" == "running" ]]; then
    echo "Stripe listener:         running"
    echo "Stripe whsec source:     $STRIPE_LISTEN_LOG"
  else
    echo "Stripe listener:         not started ($STRIPE_REASON)"
  fi
  echo "Seed status:             $SEED_STATUS"
  if [[ "$SEED_STATUS" == "failed" ]]; then
    echo "Seed recovery commands:  node scripts/seed-users.mjs && npx supabase db seed"
  fi
  echo "Logs:"
  echo "  - ./logs/dev-up.log"
  echo "  - ./logs/supabase.log"
  echo "  - ./logs/db-push.log"
  echo "  - ./logs/seed-users.log"
  echo "  - ./logs/db-seed.log"
  echo "  - ./logs/next.log"
  echo "  - ./logs/inngest.log"
  echo "  - ./logs/ngrok.log"
  echo "  - ./logs/stripe-listen.log"
  echo "Stop everything:         bash scripts/dev-down.sh"
}

print_header "Prerequisites"
require_cmd node "https://nodejs.org/"
require_cmd npm "https://nodejs.org/"
require_cmd npx "Installed with Node.js"
require_cmd docker "https://docs.docker.com/get-docker/"
optional_cmd ngrok "https://ngrok.com/download"
optional_cmd stripe "https://docs.stripe.com/stripe-cli"
optional_cmd jq "brew install jq"
optional_cmd psql "Install PostgreSQL client if you want SQL validations"

if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker appears to be stopped. Start Docker Desktop and run this script again."
  FATAL=1
fi

print_header "Environment"
if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example"
fi

for key in \
  NEXT_PUBLIC_APP_URL WEBHOOK_BASE_URL \
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL \
  DB_MODE \
  BILLING_MODE \
  TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER \
  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID \
  ALLOW_OUTBOUND_WITHOUT_STRIPE SUBSCRIPTION_GRACE_DAYS; do
  ensure_env_key "$key"
done

if [[ -z "$(get_env_value NEXT_PUBLIC_APP_URL)" ]]; then
  set_env_key "NEXT_PUBLIC_APP_URL" "$APP_URL"
else
  APP_URL="$(get_env_value NEXT_PUBLIC_APP_URL)"
fi
if [[ -z "$(get_env_value ALLOW_OUTBOUND_WITHOUT_STRIPE)" ]]; then
  set_env_key "ALLOW_OUTBOUND_WITHOUT_STRIPE" "false"
fi
if [[ -z "$(get_env_value SUBSCRIPTION_GRACE_DAYS)" ]]; then
  set_env_key "SUBSCRIPTION_GRACE_DAYS" "3"
fi
if [[ -z "$(get_env_value BILLING_MODE)" ]]; then
  set_env_key "BILLING_MODE" "disabled"
fi
if [[ -z "$(get_env_value DB_MODE)" ]]; then
  set_env_key "DB_MODE" "local"
fi
CURRENT_BILLING_MODE="$(get_env_value BILLING_MODE)"
if [[ "$CURRENT_BILLING_MODE" != "stripe" ]]; then
  CURRENT_BILLING_MODE="disabled"
  set_env_key "BILLING_MODE" "disabled"
fi
CURRENT_DB_MODE="$(get_env_value DB_MODE)"
if [[ "$CURRENT_DB_MODE" != "remote" ]]; then
  CURRENT_DB_MODE="local"
  set_env_key "DB_MODE" "local"
fi

if [[ "$FATAL" -eq 0 ]]; then
  print_header "Install + Database"
  npm install

  : > "$SUPABASE_LOG"
  if ! npx supabase start > >(tee -a "$SUPABASE_LOG") 2> >(tee -a "$SUPABASE_LOG" >&2); then
    echo "❌ supabase start failed."
    FATAL=1
  fi
fi

if [[ "$FATAL" -eq 0 ]]; then
  SUPABASE_STATUS_ENV="$(npx supabase status -o env 2>/dev/null || true)"
  SUPABASE_API_URL="http://127.0.0.1:54321"

  if [[ -z "$SUPABASE_STATUS_ENV" && -f "$SUPABASE_LOG" ]]; then
    api_url="$(grep -E 'API URL:|Project URL:' "$SUPABASE_LOG" | head -n1 | sed -E 's/.*(http[^ ]+).*/\1/' || true)"
    studio_url="$(grep -E 'Studio URL:' "$SUPABASE_LOG" | head -n1 | sed -E 's/.*(http[^ ]+).*/\1/' || true)"
    anon_key="$(grep -E 'anon key:|Publishable key:' "$SUPABASE_LOG" | head -n1 | sed -E 's/.*: *//' || true)"
    service_key="$(grep -E 'service_role key:|Secret key:' "$SUPABASE_LOG" | head -n1 | sed -E 's/.*: *//' || true)"
    db_url="$(grep -E 'DB URL:' "$SUPABASE_LOG" | head -n1 | sed -E 's/.*(postgres[^ ]+).*/\1/' || true)"

    [[ -n "$api_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"SUPABASE_URL=$api_url"
    [[ -n "$studio_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"STUDIO_URL=$studio_url"
    [[ -n "$anon_key" ]] && SUPABASE_STATUS_ENV+=$'\n'"ANON_KEY=$anon_key"
    [[ -n "$service_key" ]] && SUPABASE_STATUS_ENV+=$'\n'"SERVICE_ROLE_KEY=$service_key"
    [[ -n "$db_url" ]] && SUPABASE_STATUS_ENV+=$'\n'"DB_URL=$db_url"
  fi

  if [[ -n "$SUPABASE_STATUS_ENV" ]]; then
    while IFS='=' read -r k v; do
      [[ -z "${k:-}" ]] && continue
      v="$(unquote "$v")"
      case "$k" in
        API_URL|SUPABASE_URL)
          SUPABASE_API_URL="$v"
          set_env_key "NEXT_PUBLIC_SUPABASE_URL" "$v"
          ;;
        STUDIO_URL)
          SUPABASE_STUDIO_URL="$v"
          ;;
        ANON_KEY|SUPABASE_ANON_KEY)
          set_env_key "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$v"
          ;;
        SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY)
          set_env_key "SUPABASE_SERVICE_ROLE_KEY" "$v"
          ;;
        DB_URL|SUPABASE_DB_URL)
          if [[ -z "$(get_env_value SUPABASE_DB_URL)" ]]; then set_env_key "SUPABASE_DB_URL" "$v"; fi
          ;;
      esac
    done <<< "$SUPABASE_STATUS_ENV"
  fi

  SUPABASE_API_URL="$(unquote "$SUPABASE_API_URL")"
  SUPABASE_STUDIO_URL="$(unquote "$SUPABASE_STUDIO_URL")"

  AUTH_URL="${SUPABASE_API_URL}/auth/v1/health"
  REST_URL="${SUPABASE_API_URL}/rest/v1/"

  started="$(date +%s)"
  while true; do
    CORE_AUTH_CODE="$(http_code_for_url "$AUTH_URL")"
    CORE_REST_CODE="$(http_code_for_url "$REST_URL")"

    if [[ "$CORE_AUTH_CODE" == "200" ]]; then
      CORE_AUTH_STATUS="ok"
    else
      CORE_AUTH_STATUS="failed"
    fi

    if [[ "$CORE_REST_CODE" != "000" ]]; then
      CORE_REST_STATUS="ok"
    else
      CORE_REST_STATUS="failed"
    fi

    if [[ "$CORE_AUTH_STATUS" == "ok" && "$CORE_REST_STATUS" == "ok" ]]; then
      SUPABASE_HEALTHY="yes"
      break
    fi

    if (( $(date +%s) - started >= 120 )); then
      break
    fi

    sleep 2
  done

  if [[ "$SUPABASE_HEALTHY" != "yes" ]]; then
    if [[ "$CORE_AUTH_CODE" == "000" && "$CORE_REST_CODE" == "000" ]]; then
      echo "❌ Supabase core API health check failed (auth/rest both unreachable)."
      echo "   Recovery: npx supabase stop && npx supabase start"
      echo "   Then retry: bash scripts/dev-up.sh"
      FATAL=1
    else
      echo "⚠️ Supabase core health degraded (auth=$CORE_AUTH_CODE rest=$CORE_REST_CODE). Continuing."
    fi
  fi

  STUDIO_HTTP_CODE="$(http_code_for_url "$SUPABASE_STUDIO_URL")"

  if [[ "$FATAL" -eq 0 ]]; then
    if [[ "$CURRENT_DB_MODE" == "remote" ]]; then
      : > "$DB_PUSH_LOG"
      if npx supabase db push > >(tee -a "$DB_PUSH_LOG") 2> >(tee -a "$DB_PUSH_LOG" >&2); then
        DB_PUSH_STATUS="ok"
      elif grep -qi "Cannot find project ref" "$DB_PUSH_LOG"; then
        DB_PUSH_STATUS="skipped"
        echo "⚠️ supabase db push skipped: project is not linked (Cannot find project ref)."
        echo "   Recovery: npx supabase link --project-ref <ref> && npx supabase db push"
      elif retry_cmd_logged "supabase db push" 2 2 "$DB_PUSH_LOG" npx supabase db push; then
        DB_PUSH_STATUS="ok"
      elif grep -qi "Cannot find project ref" "$DB_PUSH_LOG"; then
        DB_PUSH_STATUS="skipped"
        echo "⚠️ supabase db push skipped: project is not linked (Cannot find project ref)."
        echo "   Recovery: npx supabase link --project-ref <ref> && npx supabase db push"
      else
        DB_PUSH_STATUS="failed"
        echo "   Recovery: npx supabase db push"
        FATAL=1
      fi
    else
      DB_PUSH_STATUS="skipped"
      : > "$DB_PUSH_LOG"
      echo "DB_MODE=local -> skipping supabase db push." | tee -a "$DB_PUSH_LOG"
    fi

    : > "$SEED_USERS_LOG"
    if ! node scripts/seed-users.mjs > >(tee -a "$SEED_USERS_LOG") 2> >(tee -a "$SEED_USERS_LOG" >&2); then
      SEED_STATUS="failed"
      echo "⚠️ seed-users step failed. Continuing."
      echo "   Recovery: node scripts/seed-users.mjs"
    fi

    if ! retry_cmd_logged "supabase db seed" 3 2 "$DB_SEED_LOG" npx supabase db seed; then
      SEED_STATUS="failed"
      echo "⚠️ Database seed failed after retries. Continuing."
      echo "   Recovery: npx supabase db seed"
    fi
  fi
fi

print_header "Start Services"
touch "$PIDS_FILE"

if start_bg "next" "$NEXT_LOG" npm run dev; then
  :
else
  echo "⚠️ Could not start Next.js. Check $NEXT_LOG"
fi

if start_bg "inngest" "$INNGEST_LOG" npm run inngest:dev; then
  :
else
  echo "⚠️ Could not start Inngest dev server. Check $INNGEST_LOG"
fi

if have_cmd ngrok; then
  if start_bg "ngrok" "$NGROK_LOG" ngrok http 3000 --log=stdout; then
    for _ in $(seq 1 30); do
      NGROK_URL="$(extract_ngrok_url)"
      if [[ -n "$NGROK_URL" ]]; then
        NGROK_STATUS="running"
        break
      fi
      sleep 1
    done

    if [[ "$NGROK_STATUS" != "running" ]]; then
      NGROK_REASON="unable to read ngrok API tunnel URL"
    else
      set_env_key "WEBHOOK_BASE_URL" "$NGROK_URL"
    fi
  else
    NGROK_REASON="failed to launch process"
  fi
else
  NGROK_REASON="ngrok CLI not installed"
fi

if [[ "$CURRENT_BILLING_MODE" == "disabled" ]]; then
  STRIPE_STATUS="disabled"
  STRIPE_REASON="billing disabled (MVP mode)"
elif have_cmd stripe; then
  if start_bg "stripe_listen" "$STRIPE_LISTEN_LOG" stripe listen --forward-to http://localhost:3000/api/stripe/webhook; then
    STRIPE_STATUS="running"
    WHSEC=""
    for _ in $(seq 1 30); do
      WHSEC="$(extract_whsec "$STRIPE_LISTEN_LOG")"
      if [[ -n "$WHSEC" ]]; then
        break
      fi
      sleep 1
    done

    if [[ -n "$WHSEC" ]]; then
      set_env_key "STRIPE_WEBHOOK_SECRET" "$WHSEC"
    else
      STRIPE_REASON="listener running but whsec not auto-detected; check $STRIPE_LISTEN_LOG"
    fi

    create_stripe_price_if_missing
  else
    STRIPE_REASON="failed to launch process"
  fi
else
  STRIPE_REASON="stripe CLI not installed"
fi

if [[ "$ENV_CHANGED" -eq 1 ]]; then
  echo "Environment changed; restarting Next.js to pick up new values..."
  NEXT_PID="$(get_pid next)"
  if [[ -n "$NEXT_PID" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
    sleep 1
  fi
  if ! start_bg "next" "$NEXT_LOG" npm run dev; then
    echo "⚠️ Could not restart Next.js. Check $NEXT_LOG"
  fi
fi

print_ready

# Exit non-zero only for fatal prerequisites/database failures.
if [[ "$FATAL" -eq 1 ]]; then
  exit 1
fi
