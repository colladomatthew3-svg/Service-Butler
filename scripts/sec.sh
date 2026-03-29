#!/bin/bash

set -euo pipefail

tool_name="${TOOL_NAME:-${CODEX_TOOL_NAME:-${1:-}}}"
tool_input="${TOOL_INPUT:-${CODEX_TOOL_INPUT:-}}"

if [[ -z "${tool_input}" ]] && read -r -t 0; then
  tool_input="$(cat)"
fi

payload="${tool_input}"

if [[ -z "${payload}" ]]; then
  printf '{"decision":"approve","reason":"No bash payload provided to security hook."}\n'
  exit 0
fi

normalized="$(printf '%s' "${payload}" | tr '\n' ' ' | tr -s ' ' | tr '[:upper:]' '[:lower:]')"

block_pattern='(^|[[:space:]])(git reset --hard|git checkout --|sudo[[:space:]]+rm|rm[[:space:]]+-rf[[:space:]]+/|rm[[:space:]]+-rf[[:space:]]+~|curl[^|]*\|[[:space:]]*(sh|bash)|mkfs|dd[[:space:]]+if=|:\(\)\{[[:space:]]*:\|:\&[[:space:]]*\};:|chmod[[:space:]]+-r[[:space:]]+777)'
ask_pattern='(^|[[:space:]])(git push|vercel([[:space:]]+deploy)?[[:space:]].*--prod|railway[[:space:]]+up|fly[[:space:]]+deploy|npm[[:space:]]+publish|pnpm[[:space:]]+publish|supabase[[:space:]]+db[[:space:]]+push|npx[[:space:]]+supabase[[:space:]]+db[[:space:]]+push|gh[[:space:]]+workflow[[:space:]]+run)'

if printf '%s' "${normalized}" | grep -Eq "${block_pattern}"; then
  printf '{"decision":"block","reason":"Blocked by scripts/sec.sh: destructive or unsafe shell pattern detected."}\n'
  exit 0
fi

if printf '%s' "${normalized}" | grep -Eq "${ask_pattern}"; then
  printf '{"decision":"ask_user","reason":"High-impact command detected. Confirm deploy/publish/push intent before running."}\n'
  exit 0
fi

if [[ "${tool_name,,}" != *bash* ]]; then
  printf '{"decision":"approve","reason":"Security hook only evaluates Bash tool payloads."}\n'
  exit 0
fi

printf '{"decision":"approve","reason":"Bash payload passed repository security policy."}\n'
