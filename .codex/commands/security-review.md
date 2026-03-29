---
description: Audit Service Butler for security, auth, tenant isolation, secret handling, and unsafe operational commands.
---

# Service Butler Security Review

Run a focused security pass for this repo.

## Checklist

1. Review changed files first.
2. Prioritize:
   - auth and RBAC
   - webhook verification
   - tenant scoping
   - mutation endpoints
   - secret handling
   - deploy and database commands
3. Run targeted validation when relevant:
   - `npm run build`
   - `npm run typecheck`
   - `npm test -- tests/v2-webhook-auth.spec.ts tests/v2-assignment-webhook.spec.ts tests/v2-booked-job-webhook.spec.ts`
4. Call out any dangerous bash command sequences that should be blocked or escalated.

## Output

- findings first, highest severity first
- exact file references
- residual risk
- recommended follow-up checks
