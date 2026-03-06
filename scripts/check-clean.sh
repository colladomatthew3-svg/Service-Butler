#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

git diff --check

if rg -n '^(<<<<<<<|=======|>>>>>>>)' src tests >/dev/null; then
  echo "Conflict markers found in src/ or tests/." >&2
  exit 1
fi

staged_files="$(git diff --cached --name-status)"
forbidden_pattern='(^|/)(tsconfig\.tsbuildinfo|\.next/|logs/|\.env($|\.)|playwright-browsers/)'
if [[ -n "$staged_files" ]] && printf '%s\n' "$staged_files" | awk '$1 != "D" { print $2 }' | rg -n "$forbidden_pattern" >/dev/null; then
  echo "Forbidden staged files detected." >&2
  printf '%s\n' "$staged_files" | awk '$1 != "D" { print $2 }' | rg -n "$forbidden_pattern" >&2
  exit 1
fi

echo "check:clean passed"
