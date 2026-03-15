#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/8] Applying migrations"
npm run db:push

echo "[2/8] Seeding pilot enterprise + franchise tenants"
node scripts/seed-pilot-tenants.mjs

echo "[3/8] Enabling v2 writes for this shell session"
export SB_USE_V2_WRITES=true
printf 'SB_USE_V2_WRITES=%s\n' "$SB_USE_V2_WRITES"

echo "[4/8] Running legacy-to-v2 parity checks"
npm run pilot:parity

echo "[5/8] Enabling v2 reads for this shell session"
export SB_USE_V2_READS=true
printf 'SB_USE_V2_READS=%s\n' "$SB_USE_V2_READS"

echo "[6/8] Running pilot routing + assignment smoke"
npm run pilot-test

echo "[7/8] Outreach API verification"
APP_URL="${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3000}"
echo "Run this against your running app (auth required):"
echo "curl -X POST \"$APP_URL/api/leads/<LEAD_ID>/outreach\" -H 'content-type: application/json' -d '{\"channel\":\"sms\",\"to\":\"+15555550123\",\"message\":\"Pilot outreach test\"}'"

echo "[8/8] Rollback switches"
echo "export SB_USE_V2_READS=false"
echo "export SB_USE_V2_WRITES=false"

echo "Pilot deployment run completed."
