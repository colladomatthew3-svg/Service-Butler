# Production Readiness Checklist

Use this as the authoritative release gate for any production-affecting Service Butler push.
Pair it with [Production Readiness Summary Template](./PRODUCTION_READINESS_SUMMARY_TEMPLATE.md).

Decision rule:
- `GO` only when the local gate passes and the live/environment-backed gate confirms the intended target environment.
- `GO FOR INTERNAL REVIEW ONLY` when local and live gates pass but buyer-proof or live-source coverage is still incomplete.
- `NO-GO` when any required local or live gate fails, or when target environment truth is inconsistent.

## 1. Preflight

- Identify the intended target environment and owner before starting.
- Confirm the branch and commit SHA that will be released.
- Confirm unrelated local worktree changes are not part of the release scope.
- Capture the timestamp and run context you plan to record in the summary.

## 2. Local gate

Run these commands in order:

```bash
npm run typecheck
npm run build
npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts tests/smoke-demo-lead-to-schedule.spec.ts
npm run operator-healthcheck
npm run validate-integrations
npm run proof:servpro
```

Pass rules:
- `npm run typecheck` exits `0`
- `npm run build` exits `0`
- targeted operator smoke coverage exits `0`
- `npm run operator-healthcheck` exits `0`
- `npm run validate-integrations` exits `0`
- `npm run proof:servpro` writes `output/proof/<timestamp>/summary.md`

Notes:
- Repeat the targeted smoke suite if you touched operator-critical UI, demo-mode behavior, or navigation paths.
- Treat `proof:servpro` as the release proof artifact, not just a convenience command.

## 3. Live gate

Run these against the intended target environment:

```bash
npm run check:production
```

Confirm the live target truth:
- `NEXT_PUBLIC_APP_URL` points at the intended public origin.
- Supabase URL, anon key, and service role key match the target environment.
- `WEBHOOK_SHARED_SECRET` is set for any non-local webhook exposure.
- `DEMO_MODE=off` and `REVIEW_MODE=off` unless a controlled demo is explicitly intended.
- `ALLOW_NON_DEV_DEMO_MODE=off` unless a controlled non-dev demo is explicitly approved.
- `SB_TWILIO_SAFE_MODE=true` and `SB_HUBSPOT_SAFE_MODE=true` unless live outbound has been explicitly approved.
- `SB_USE_V2_READS` and `SB_USE_V2_WRITES` match the rollout plan for the target environment.

Confirm live readiness surfaces:
- `/api/health/production` returns no required `fail` checks.
- `/dashboard/scanner` and `/api/scanner/run` behave as live-safe, not synthetic/demo-first.
- Data sources shown as live in settings are actually backed by approved providers, not sample or simulated records.
- Buyer-grade counts never include synthetic/demo/sample rows.

## 4. Decision matrix

| Status | Use when |
| --- | --- |
| `GO` | All local gates pass, the live gate passes, proof artifacts are present, and there are no unresolved blockers. |
| `GO FOR INTERNAL REVIEW ONLY` | All local and live gates pass, but proof chain or live-source coverage is incomplete for a buyer-facing claim. |
| `NO-GO` | Any required local or live gate fails, proof artifacts are missing or broken, or target environment truth is inconsistent. |

## 5. Evidence to capture

- Branch and commit SHA
- Target environment name and URL
- Command outputs or artifact paths for every passed gate
- `/api/health/production` result
- `output/proof/<timestamp>/summary.md`
- Any live-provider or connector warnings
- Rollback notes and owner

## 6. Rollback posture

If the release reveals unsafe live behavior or broken proof semantics, use this rollback order:

1. `SB_USE_V2_READS=false`
2. `SB_USE_V2_WRITES=false`
3. `SB_USE_POLYGON_ROUTING=false` if routing is implicated

Outbound safety switches:
- Keep or force `SB_TWILIO_SAFE_MODE=true`
- Keep or force `SB_HUBSPOT_SAFE_MODE=true`
- If needed, set `SB_DISABLE_TWILIO=true`
- If needed, set `SB_DISABLE_HUBSPOT=true`

After rollback:
- Rerun `npm run check:production`
- Rerun `npm run operator-healthcheck`
- Preserve `output/proof/<timestamp>/` artifacts for the handoff
