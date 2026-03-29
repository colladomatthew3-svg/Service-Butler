---
name: service-butler-deploy-controls
description: Use when deploying, preparing a demo release, or deciding whether Service Butler is safe to push, preview, or promote to production.
---

# Service Butler Deploy Controls

Use this skill for release gating and deployment work.

## Release Gate

1. Inspect `git status --short`.
2. Identify target environment: local demo, preview, or production.
3. Run the smallest credible release gate:
   - `npm run build`
   - `npm run typecheck`
   - `npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts`
   - `npm run check:production`
4. If leadgen or outbound changed, also run:
   - `npm run operator-healthcheck`
   - `npm run validate-integrations`
5. If a check fails, stop and summarize the blocker before any deploy.

## Production Deploy Rule

- Never deploy to production without explicit confirmation from the user in the current conversation.
- Call out uncommitted changes before deploy.
- Include rollback guidance after deployment.

## Post-Deploy Checks

- app health endpoint
- home page
- login
- dashboard entry
- one operator workflow if available

## Output

- target environment
- commands run
- pass/fail/warn status
- deployment result
- rollback plan
