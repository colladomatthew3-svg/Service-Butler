---
name: service-butler-code-review
description: Use when reviewing, regression testing, or QA-gating Service Butler changes that affect operator workflows, leadgen, auth, or buyer-demo readiness.
---

# Service Butler Code Review

Use this skill when the task is review, QA, regression checking, or release confidence.

## Review Order

1. Changed files and adjacent code.
2. Operator-critical flows:
   - home
   - login
   - dashboard
   - scanner
   - leads
   - pipeline
   - jobs
   - schedule
   - settings
3. Auth, tenant scoping, webhook safety, and data integrity.
4. Tests that cover the touched behavior.

## Required Mindset

- Findings first.
- Prioritize bugs, regressions, security gaps, and missing tests over style.
- Treat demo brittleness as a real product issue.
- Treat fake-looking UI states or broken provenance as trust failures.

## Minimum Validation

Run the smallest relevant subset:

- `npm run build`
- `npm run typecheck`
- `npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts`
- targeted `tests/v2-*.spec.ts` when leadgen, scoring, webhook, or routing code changes

## Output Format

- findings ordered by severity
- exact file references
- what was verified
- what was not verified
