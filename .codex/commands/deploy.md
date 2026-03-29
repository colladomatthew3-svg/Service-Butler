---
description: Run the Service Butler deploy gate, confirm production intent, and only then execute the relevant deployment steps.
---

# Service Butler Deploy Gate

Use the deploy controls workflow for this repo. Treat every deploy as customer-visible unless explicitly told otherwise.

## Preflight

1. Read [AGENTS.md](/Users/matthewcollado/Downloads/Service%20Butler/AGENTS.md) and [docs/AGENTS.md](/Users/matthewcollado/Downloads/Service%20Butler/docs/AGENTS.md).
2. Inspect `git status --short`.
3. Identify whether the target is local demo, preview, or production.
4. For preview or production, run the smallest relevant gate:
   - `npm run build`
   - `npm run typecheck`
   - `npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts`
   - `npm run check:production`
5. If leadgen or outbound code changed, also run:
   - `npm run operator-healthcheck`
   - `npm run validate-integrations`

## Production Rule

If the request is ambiguous, do not assume production.

If the request is explicitly production:

- State the exact production command before running it.
- Require explicit confirmation in the conversation before execution.
- Summarize rollback options immediately after deploy.

## Summary Format

Return:

- environment targeted
- checks run
- checks skipped and why
- deploy command used
- rollback path
