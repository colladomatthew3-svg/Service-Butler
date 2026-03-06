#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"

echo "Service Butler demo mode"
echo "URL: http://${HOST}:${PORT}"
echo "Demo login: owner@servicebutler.local"
echo "Auth: use the Demo Login button on /login"

DEMO_MODE=true npm run dev -- --hostname "$HOST" --port "$PORT"
