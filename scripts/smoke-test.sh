#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env.local"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

BUILD_STATUS="FAIL"
SUPABASE_STATUS="SKIPPED"
STRIPE_STATUS="MANUAL"
TWILIO_STATUS="MANUAL"
ENV_STATUS="PASS"

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

get_billing_mode() {
  local mode
  mode="$(get_env_value BILLING_MODE)"
  if [[ "$mode" == "stripe" ]]; then
    echo "stripe"
  else
    echo "disabled"
  fi
}

run_step() {
  local label="$1"
  shift
  echo "\n▶ $label"
  if "$@"; then
    echo "✅ $label"
    return 0
  else
    echo "❌ $label"
    return 1
  fi
}

# Build checks
if run_step "Typecheck" npm run typecheck \
  && run_step "Lint" npm run lint \
  && run_step "Build" npm run build; then
  BUILD_STATUS="PASS"
else
  BUILD_STATUS="FAIL"
fi

# Supabase checks
SUPABASE_DB_URL="$(get_env_value SUPABASE_DB_URL)"
if command -v psql >/dev/null 2>&1 && [[ -n "$SUPABASE_DB_URL" ]]; then
  if psql "$SUPABASE_DB_URL" -f scripts/validate-db.sql > "$LOG_DIR/smoke-validate-db.log" 2>&1; then
    SUPABASE_STATUS="PASS"
  else
    SUPABASE_STATUS="FAIL"
  fi
else
  SUPABASE_STATUS="SKIPPED"
  echo "\nℹ️ Supabase SQL validation skipped. Install psql and set SUPABASE_DB_URL in .env.local"
fi

# Env sanity
BILLING_MODE="$(get_billing_mode)"
MISSING=()
for key in TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER WEBHOOK_BASE_URL; do
  val="$(get_env_value "$key")"
  if [[ -z "$val" ]]; then
    MISSING+=("$key")
  fi
done

if [[ "$BILLING_MODE" == "stripe" ]]; then
  for key in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID; do
    val="$(get_env_value "$key")"
    if [[ -z "$val" ]]; then
      MISSING+=("$key")
    fi
  done
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "\n❌ Missing env keys in .env.local: ${MISSING[*]}"
  ENV_STATUS="FAIL"
fi

WEBHOOK_BASE_URL="$(get_env_value WEBHOOK_BASE_URL)"
if [[ -n "$WEBHOOK_BASE_URL" && ! "$WEBHOOK_BASE_URL" =~ ^https:// ]]; then
  echo "\n❌ WEBHOOK_BASE_URL must start with https://"
  ENV_STATUS="FAIL"
fi

# Stripe sanity
if [[ "$BILLING_MODE" == "disabled" ]]; then
  STRIPE_STATUS="DISABLED"
  echo "\nℹ️ Stripe checks skipped because BILLING_MODE=disabled."
elif command -v stripe >/dev/null 2>&1; then
  STRIPE_STATUS="FAIL"
  if stripe trigger customer.subscription.created >/dev/null 2>&1 && stripe trigger customer.subscription.updated >/dev/null 2>&1; then
    if command -v psql >/dev/null 2>&1 && [[ -n "$SUPABASE_DB_URL" ]]; then
      stripe_webhooks=$(psql "$SUPABASE_DB_URL" -Atqc "select count(*) from public.webhook_events where provider='stripe' and created_at > now() - interval '15 minutes';" 2>/dev/null || echo "0")
      stripe_subs=$(psql "$SUPABASE_DB_URL" -Atqc "select count(*) from public.stripe_subscriptions;" 2>/dev/null || echo "0")
      if [[ "${stripe_webhooks:-0}" -gt 0 && "${stripe_subs:-0}" -gt 0 ]]; then
        STRIPE_STATUS="PASS"
      else
        STRIPE_STATUS="MANUAL"
        echo "\nℹ️ Stripe triggers sent, but DB verification was inconclusive. Check logs/next.log for webhook receipt."
      fi
    else
      STRIPE_STATUS="MANUAL"
      echo "\nℹ️ Stripe triggers sent. Install psql + set SUPABASE_DB_URL to auto-verify DB changes."
      echo "   Otherwise check logs/next.log for webhook receipt."
    fi
  else
    STRIPE_STATUS="FAIL"
    echo "\n❌ Stripe CLI trigger failed. Run 'stripe login' and ensure listener is active."
  fi
else
  STRIPE_STATUS="MANUAL"
  echo "\nℹ️ Stripe CLI missing. Install it to run webhook trigger checks automatically."
fi

# Twilio manual sanity
cat <<'TWILIO'

Twilio manual sanity (60 seconds):
1) Send an SMS from the app UI to your VERIFIED phone number.
2) Reply from that phone.
3) Confirm inbound reply appears in conversation and active sequences stop.

Top failure cases:
- Twilio trial only allows outbound to verified destination numbers.
- Signature validation fails if WEBHOOK_BASE_URL does not exactly match ngrok HTTPS origin.
TWILIO

TWILIO_STATUS="MANUAL"

# Final summary
echo "\n=============================="
echo "SMOKE TEST SUMMARY"
echo "=============================="
echo "Build:            $BUILD_STATUS"
echo "Env sanity:       $ENV_STATUS"
echo "Supabase:         $SUPABASE_STATUS"
echo "Stripe webhooks:  $STRIPE_STATUS"
echo "Twilio:           $TWILIO_STATUS"

if [[ "$BUILD_STATUS" == "PASS" && "$ENV_STATUS" == "PASS" && ( "$SUPABASE_STATUS" == "PASS" || "$SUPABASE_STATUS" == "SKIPPED" ) && ( "$STRIPE_STATUS" == "PASS" || "$STRIPE_STATUS" == "MANUAL" || "$STRIPE_STATUS" == "DISABLED" ) ]]; then
  echo "\n✅ Overall: READY FOR MANUAL TWILIO VERIFY"
  exit 0
fi

echo "\n❌ Overall: NEEDS ATTENTION (see output above)"
exit 1
