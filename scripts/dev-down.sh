#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PIDS_FILE="$ROOT_DIR/.pids"

if [[ ! -f "$PIDS_FILE" ]]; then
  echo "Stopped."
  exit 0
fi

while IFS=':' read -r name pid; do
  [[ -z "${name:-}" || -z "${pid:-}" ]] && continue
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
  fi
done < "$PIDS_FILE"

sleep 1

while IFS=':' read -r name pid; do
  [[ -z "${name:-}" || -z "${pid:-}" ]] && continue
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
done < "$PIDS_FILE"

rm -f "$PIDS_FILE"

echo "Stopped."
