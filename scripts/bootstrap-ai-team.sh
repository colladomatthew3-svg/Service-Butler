#!/bin/bash

echo "🚀 Bootstrapping AI Engineering Team..."

echo "Creating GitHub labels..."

gh label create "agent:integrator" --color FF5733 2>/dev/null
gh label create "agent:uiux" --color 1ABC9C 2>/dev/null
gh label create "agent:brand" --color F39C12 2>/dev/null
gh label create "agent:scanner" --color 9B59B6 2>/dev/null
gh label create "agent:qa" --color 3498DB 2>/dev/null
gh label create "agent:critic" --color E74C3C 2>/dev/null

gh label create "priority:P0" --color FF0000 2>/dev/null
gh label create "priority:P1" --color F1C40F 2>/dev/null
gh label create "priority:P2" --color 95A5A6 2>/dev/null

echo "Creating issues..."

gh issue create --title "P0 Demo Login + Review Hub stability" \
--body "Ensure demo login works without magic link friction and review hub loads correctly." \
--label "priority:P0"

gh issue create --title "P0 Scanner wow loop + intent signals tuning" \
--body "Improve scanner experience and intent signals realism." \
--label "priority:P0"

gh issue create --title "P0 Lead → Job → Schedule → Pipeline flow polish" \
--body "Improve contractor workflow from lead to scheduled job." \
--label "priority:P0"

echo "Creating agent branches..."

git checkout -b agent/integrator
git push -u origin agent/integrator

git checkout main

git checkout -b agent/uiux-design
git push -u origin agent/uiux-design

git checkout main

git checkout -b agent/scanner-engine
git push -u origin agent/scanner-engine

git checkout main

git checkout -b agent/product-critic
git push -u origin agent/product-critic

git checkout main

git checkout -b agent/qa-automation
git push -u origin agent/qa-automation

git checkout main

echo "✅ AI engineering team setup complete"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LABELS_CREATED=()
LABELS_UPDATED=()
ISSUES_CREATED=()
ISSUES_SKIPPED=()
BRANCHES_CREATED=()
BRANCHES_PUSHED=()
FILES_ADDED=()

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: required command not found: $cmd"
    exit 1
  fi
}

ensure_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label create "$name" --color "$color" --description "$description" >/dev/null 2>&1; then
    LABELS_CREATED+=("$name")
  else
    gh label edit "$name" --color "$color" --description "$description" >/dev/null
    LABELS_UPDATED+=("$name")
  fi
}

issue_exists() {
  local title="$1"
  gh issue list --state all --limit 500 --json title --jq '.[].title' | grep -Fqx "$title"
}

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  if issue_exists "$title"; then
    ISSUES_SKIPPED+=("$title")
    return
  fi

  IFS=',' read -r -a label_list <<< "$labels"
  local label_flags=()
  for label in "${label_list[@]}"; do
    label_flags+=("--label" "$label")
  done

  gh issue create \
    --title "$title" \
    --body "$body" \
    "${label_flags[@]}" >/dev/null

  ISSUES_CREATED+=("$title")
}

ensure_branch() {
  local branch="$1"
  if ! git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch "$branch"
    BRANCHES_CREATED+=("$branch")
  fi

  if git push -u origin "$branch" >/dev/null 2>&1; then
    BRANCHES_PUSHED+=("$branch")
  elif git push origin "$branch" >/dev/null 2>&1; then
    BRANCHES_PUSHED+=("$branch")
  else
    echo "Warning: failed to push branch '$branch'. Check remote permissions."
  fi
}

# 1) Verify prerequisites
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: not inside a git repository."
  exit 1
}

require_cmd git
require_cmd gh

gh auth status >/dev/null 2>&1 || {
  echo "Error: gh CLI is not authenticated. Run: gh auth login"
  exit 1
}

git remote get-url origin >/dev/null 2>&1 || {
  echo "Error: git remote 'origin' is not configured."
  exit 1
}

# 2) Create labels
ensure_label "agent:integrator" "1f6feb" "Integrator agent ownership"
ensure_label "agent:uiux" "5319e7" "UI/UX agent ownership"
ensure_label "agent:brand" "d97706" "Brand system agent ownership"
ensure_label "agent:scanner" "0e8a16" "Scanner/lead intel agent ownership"
ensure_label "agent:qa" "fbca04" "QA agent ownership"
ensure_label "agent:critic" "6e7781" "Product critic agent ownership"

ensure_label "priority:P0" "b60205" "Highest priority"
ensure_label "priority:P1" "d93f0b" "Medium priority"
ensure_label "priority:P2" "fbca04" "Lower priority"

ensure_label "type:feature" "0052cc" "Feature work"
ensure_label "type:design" "c2e0c6" "Design/UI work"
ensure_label "type:infra" "bfdadc" "Infrastructure/devex"
ensure_label "type:qa" "f9d0c4" "Quality assurance"

# 3) Create roadmap issues
create_issue \
  "P0 — Demo Login + Review Hub stability" \
  "priority:P0,type:infra,agent:integrator" \
"## Acceptance Criteria
- Demo mode allows local navigation without auth bounce for dashboard review paths.
- /__review provides working links to all key demo routes.
- No production security behavior is weakened.
- Demo mode/off behavior is documented and deterministic.

## Demo Steps
1. Set local env for demo mode.
2. Open /__review.
3. Click dashboard routes and confirm no login bounce.
4. Disable demo mode and confirm auth protection returns.

## Likely Files Impacted
- middleware.ts
- src/lib/services/review-mode.ts
- src/app/__review/page.tsx
- scripts/review.sh
- README.md"

create_issue \
  "P0 — Scanner wow loop + intent signals tuning" \
  "priority:P0,type:feature,agent:scanner" \
"## Acceptance Criteria
- Scanner produces realistic opportunity cards with intent score, confidence, tags, and next action.
- Preview panel explains why each opportunity matters to contractors.
- Add as Lead and Add as Job actions persist via existing APIs.
- Feed feels live with loading/progress states.

## Demo Steps
1. Open /dashboard/scanner.
2. Run scan for target zip/service mode.
3. Preview an opportunity.
4. Dispatch one to lead and one to job.
5. Verify records in Leads and Pipeline.

## Likely Files Impacted
- src/components/dashboard/lead-scanner-view.tsx
- src/lib/services/scanner.ts
- src/lib/services/intent-engine.ts
- src/app/api/scanner/run/route.ts
- src/app/api/scanner/events/[id]/dispatch/route.ts"

create_issue \
  "P0 — Lead → Job → Schedule → Pipeline UX polish" \
  "priority:P0,type:design,agent:uiux" \
"## Acceptance Criteria
- Lead cards expose clear big actions: Call, Text, Convert to Job, Schedule.
- Lead detail acts as command center with sticky mobile action bar.
- Converted jobs appear in pipeline and schedule immediately.
- Pipeline updates persist and are visually clear on mobile and desktop.

## Demo Steps
1. Open /dashboard/leads.
2. Convert lead to job.
3. Set schedule on lead/job.
4. Open /dashboard/pipeline and move status.
5. Verify job detail reflects updates.

## Likely Files Impacted
- src/components/dashboard/lead-inbox-view.tsx
- src/components/dashboard/lead-detail-view.tsx
- src/components/dashboard/pipeline-view.tsx
- src/components/dashboard/job-detail-view.tsx
- src/app/(dashboard)/dashboard/pipeline/page.tsx"

create_issue \
  "P1 — Opportunity Heatmap + weather triggered campaigns" \
  "priority:P1,type:feature,agent:scanner" \
"## Acceptance Criteria
- Overview includes demand/heatmap visualization tied to opportunities.
- Weather risk surfaces recommended campaign actions.
- Scanner can prefill campaign modes from weather impact.
- UX stays fast and readable on mobile.

## Demo Steps
1. Open /dashboard and inspect weather impact.
2. Follow CTA to scanner/campaign recommendation.
3. Validate opportunities align with weather conditions.

## Likely Files Impacted
- src/app/(dashboard)/dashboard/page.tsx
- src/components/dashboard/weather-ticker.tsx
- src/components/dashboard/lead-scanner-view.tsx
- src/lib/services/weather.ts"

create_issue \
  "P1 — CSV import system (inbound/outbound)" \
  "priority:P1,type:feature,agent:integrator" \
"## Acceptance Criteria
- CSV upload supports preview and field mapping sanity checks.
- Imported records are persisted and visible in outbound workflow.
- Sequence simulation updates statuses/timeline without Twilio dependency.
- Errors are user-friendly and actionable.

## Demo Steps
1. Open /dashboard/outbound.
2. Upload CSV and preview rows.
3. Import records.
4. Start sequence simulation and observe status updates.

## Likely Files Impacted
- src/components/dashboard/outbound-view.tsx
- src/app/api/outbound/import/route.ts
- src/app/api/outbound/contacts/route.ts"

create_issue \
  "P1 — Branding consistency across entire product" \
  "priority:P1,type:design,agent:brand" \
"## Acceptance Criteria
- Logo usage is consistent across marketing, auth, and app shell.
- Primary/secondary actions follow one visual language.
- Spacing and typography hierarchy are consistent page to page.
- No placeholder brand elements remain in key journeys.

## Demo Steps
1. Open /, /login, /dashboard.
2. Compare nav, headers, cards, and buttons.
3. Validate consistency on mobile width.

## Likely Files Impacted
- src/components/brand/Logo.tsx
- src/components/brand/TopNav.tsx
- src/components/dashboard/app-shell.tsx
- src/components/ui/button.tsx
- src/app/globals.css"

# 4) Create local branches and push
ensure_branch "agent/integrator"
ensure_branch "agent/uiux-design"
ensure_branch "agent/scanner-engine"
ensure_branch "agent/product-critic"
ensure_branch "agent/qa-automation"

# Track workflow files added by this bootstrap.
FILES_ADDED+=(".github/pull_request_template.md")
FILES_ADDED+=("CONTRIBUTING.md")
FILES_ADDED+=("agents/integrator.md")
FILES_ADDED+=("agents/uiux.md")
FILES_ADDED+=("agents/scanner.md")
FILES_ADDED+=("agents/critic.md")
FILES_ADDED+=("agents/qa.md")

# 9) Summary
printf "\n==============================\n"
printf "AI Team Bootstrap Summary\n"
printf "==============================\n"
printf "Labels created: %s\n" "${#LABELS_CREATED[@]}"
for l in "${LABELS_CREATED[@]:-}"; do
  [[ -n "$l" ]] && printf "  - %s\n" "$l"
done
printf "Labels updated: %s\n" "${#LABELS_UPDATED[@]}"
for l in "${LABELS_UPDATED[@]:-}"; do
  [[ -n "$l" ]] && printf "  - %s\n" "$l"
done
printf "Issues created: %s\n" "${#ISSUES_CREATED[@]}"
for i in "${ISSUES_CREATED[@]:-}"; do
  [[ -n "$i" ]] && printf "  - %s\n" "$i"
done
printf "Issues already present: %s\n" "${#ISSUES_SKIPPED[@]}"
for i in "${ISSUES_SKIPPED[@]:-}"; do
  [[ -n "$i" ]] && printf "  - %s\n" "$i"
done
printf "Branches created: %s\n" "${#BRANCHES_CREATED[@]}"
for b in "${BRANCHES_CREATED[@]:-}"; do
  [[ -n "$b" ]] && printf "  - %s\n" "$b"
done
printf "Branches pushed: %s\n" "${#BRANCHES_PUSHED[@]}"
for b in "${BRANCHES_PUSHED[@]:-}"; do
  [[ -n "$b" ]] && printf "  - %s\n" "$b"
done
printf "Files added (workflow infra): %s\n" "${#FILES_ADDED[@]}"
for f in "${FILES_ADDED[@]:-}"; do
  [[ -n "$f" ]] && printf "  - %s\n" "$f"
done

printf "\nRun command:\n"
printf "  bash scripts/bootstrap-ai-team.sh\n"
