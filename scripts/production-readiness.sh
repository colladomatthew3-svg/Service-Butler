#!/usr/bin/env bash
set -euo pipefail

pass_count=0
warn_count=0
fail_count=0

pass() {
  printf 'PASS  %s\n' "$1"
  pass_count=$((pass_count + 1))
}

warn() {
  printf 'WARN  %s\n' "$1"
  warn_count=$((warn_count + 1))
}

fail() {
  printf 'FAIL  %s\n' "$1"
  fail_count=$((fail_count + 1))
}

is_enabled() {
  case "${1:-}" in
    1|true|TRUE|on|ON|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

require_env() {
  local key="$1"
  if [[ -n "${!key:-}" ]]; then
    pass "$key is set"
  else
    fail "$key is missing"
  fi
}

optional_group() {
  local label="$1"
  shift
  local missing=()
  local key
  for key in "$@"; do
    if [[ -z "${!key:-}" ]]; then
      missing+=("$key")
    fi
  done

  if [[ "${#missing[@]}" -eq 0 ]]; then
    pass "$label is configured"
  else
    warn "$label is incomplete: missing ${missing[*]}"
  fi
}

printf 'Service Butler production readiness\n'
printf 'Checked at %s\n\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if [[ -n "${NEXT_PUBLIC_APP_URL:-}" ]]; then
  if [[ "${NEXT_PUBLIC_APP_URL}" =~ ^https?:// ]]; then
    pass "NEXT_PUBLIC_APP_URL looks valid"
  else
    fail "NEXT_PUBLIC_APP_URL must start with http:// or https://"
  fi
else
  fail "NEXT_PUBLIC_APP_URL is missing"
fi

require_env "NEXT_PUBLIC_SUPABASE_URL"
require_env "NEXT_PUBLIC_SUPABASE_ANON_KEY"
require_env "SUPABASE_SERVICE_ROLE_KEY"
require_env "WEBHOOK_SHARED_SECRET"

if is_enabled "${SB_USE_V2_WRITES:-off}" && is_enabled "${SB_USE_V2_READS:-off}"; then
  pass "V2 rollout flags are enabled (reads + writes)"
else
  fail "V2 rollout flags must both be enabled: SB_USE_V2_READS=true and SB_USE_V2_WRITES=true"
fi

if is_enabled "${DEMO_MODE:-off}"; then
  if [[ "${NODE_ENV:-development}" == "development" ]]; then
    warn "DEMO_MODE is enabled in development"
  elif is_enabled "${ALLOW_NON_DEV_DEMO_MODE:-off}"; then
    fail "DEMO_MODE is enabled outside development"
  else
    pass "DEMO_MODE is blocked outside development by app logic"
  fi
else
  pass "DEMO_MODE is disabled"
fi

if [[ "${BILLING_MODE:-disabled}" == "stripe" ]]; then
  pass "BILLING_MODE=stripe"
  require_env "STRIPE_SECRET_KEY"
  require_env "STRIPE_WEBHOOK_SECRET"
  require_env "STRIPE_PRICE_ID"
else
  warn "BILLING_MODE is disabled"
fi

if [[ -n "${SERVICE_BUTLER_ENRICHMENT_URL:-}" ]]; then
  pass "Premium enrichment endpoint is configured for live-safe enrichment fallback"
  if [[ -n "${SERVICE_BUTLER_ENRICHMENT_PROVIDER:-}" ]]; then
    pass "Premium enrichment provider label is configured"
  else
    warn "SERVICE_BUTLER_ENRICHMENT_PROVIDER is not set"
  fi
else
  warn "Premium enrichment endpoint is not configured"
fi

optional_group "email provider" "FROM_EMAIL" "POSTMARK_SERVER_TOKEN"
if [[ -n "${FROM_EMAIL:-}" && -n "${SENDGRID_API_KEY:-}" ]]; then
  pass "SendGrid email fallback is configured"
elif [[ -n "${SENDGRID_API_KEY:-}" ]]; then
  warn "SENDGRID_API_KEY is set but FROM_EMAIL is missing"
elif [[ -z "${POSTMARK_SERVER_TOKEN:-}" ]]; then
  warn "No SendGrid fallback configured"
fi

if is_enabled "${SB_DISABLE_TWILIO:-off}"; then
  pass "Twilio is explicitly disabled for live-safe production"
elif [[ -n "${TWILIO_ACCOUNT_SID:-}" && -n "${TWILIO_AUTH_TOKEN:-}" && -n "${TWILIO_PHONE_NUMBER:-}" ]]; then
  if is_enabled "${SB_TWILIO_SAFE_MODE:-off}"; then
    pass "Twilio is configured in safe mode"
  else
    warn "Twilio credentials are present but SB_TWILIO_SAFE_MODE is not enabled"
  fi
else
  warn "Twilio is not configured; outbound SMS/voice stays disabled"
fi

if is_enabled "${SB_DISABLE_HUBSPOT:-off}"; then
  pass "HubSpot is explicitly disabled for live-safe production"
elif [[ -n "${HUBSPOT_ACCESS_TOKEN:-}" ]]; then
  if is_enabled "${SB_HUBSPOT_SAFE_MODE:-off}"; then
    pass "HubSpot is configured in safe mode"
  else
    warn "HubSpot access token is present but SB_HUBSPOT_SAFE_MODE is not enabled"
  fi
else
  warn "HubSpot is not configured; CRM sync stays disabled"
fi

optional_group "Smartlead" "SMARTLEAD_API_KEY"
optional_group "Inngest" "INNGEST_EVENT_KEY" "INNGEST_SIGNING_KEY"

tenant_report="$(node scripts/production-readiness-tenant.mjs 2>&1 || true)"
if [[ -n "${tenant_report}" ]]; then
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    level="${line%%|*}"
    message="${line#*|}"
    case "${level}" in
      pass) pass "${message}" ;;
      warn) warn "${message}" ;;
      fail) fail "${message}" ;;
      *) warn "Tenant readiness probe output: ${line}" ;;
    esac
  done <<< "${tenant_report}"
fi

printf '\nSummary: %d pass, %d warn, %d fail\n' "$pass_count" "$warn_count" "$fail_count"

if [[ "$fail_count" -gt 0 ]]; then
  exit 1
fi
