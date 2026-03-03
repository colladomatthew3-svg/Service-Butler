#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "git is required"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required: https://cli.github.com/"
  exit 1
fi

if [ ! -d .git ]; then
  git init
fi

git add .

if git diff --cached --quiet; then
  echo "No changes staged; skipping commit"
else
  git commit -m "Initial MVP"
fi

gh repo create servicebutler-ai --source=. --public --remote=origin || true
git branch -M main
git push -u origin main
