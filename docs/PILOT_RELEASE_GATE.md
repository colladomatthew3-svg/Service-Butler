# Pilot Release Gate

This gate is for a real pilot or internal live cut of Service Butler. It is not a demo gate, and it is not satisfied by synthetic-only validation.

The goal is to prove four things at once:

1. live sources are actually active
2. scanner output is explainable and scored
3. routing and review behave correctly
4. outbound and booked-job conversion remain safe and attributable

## Decision rule

| Status | Use when |
| --- | --- |
| `GO` | Live source capture is real, scoring and routing behave correctly, outbound stays safe, verified leads exist, and at least one booked-job attribution chain is present in the proof window. |
| `GO FOR INTERNAL REVIEW ONLY` | Live capture and qualification are real, but booked-job proof is still incomplete or one source family is intentionally live-partial and documented. |
| `NO-GO` | Any required command fails, validation is simulated-only, throughput is zero or synthetic, or live/source truth is inconsistent. |

## Required preflight

Before running the gate, confirm:

- the intended target environment and owner
- the branch and commit SHA
- any unrelated worktree changes
- whether outbound is intentionally safe-mode only

If the target is production or a production-affecting pilot environment, do not proceed without explicit approval from the owner of that environment.

## Gate order

Run the checks in this order. Later stages should not be trusted if an earlier stage fails.

### 1. Code and smoke gate

Run:

```bash
npm run typecheck
npm run build
npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts tests/smoke-demo-lead-to-schedule.spec.ts
```

Pass criteria:

- `typecheck` exits `0`
- `build` exits `0`
- the smoke tests pass on the intended environment

Fail criteria:

- any command exits non-zero
- demo-safe fallback pages stop rendering
- navigation or auth breaks on the operator entry path

Coverage note:

- These smokes prove the shell of the app, not the live lead engine. They are necessary but not sufficient.

### 2. Intelligence and workflow test gate

Run the targeted validation set that covers scoring, routing, review, outbound safety, and conversion:

```bash
npm test -- \
  tests/v2-scoring.spec.ts \
  tests/v2-multi-signal-scoring.spec.ts \
  tests/v2-territory-routing.spec.ts \
  tests/v2-network-activation.spec.ts \
  tests/v2-sdr-agent.spec.ts \
  tests/v2-opportunity-qualification.spec.ts \
  tests/v2-opportunity-qualification-backfill.spec.ts \
  tests/v2-outbound-safe-mode.spec.ts \
  tests/v2-booked-job-webhook.spec.ts \
  tests/v2-buyer-flow-smoke.spec.ts \
  tests/opportunities-view-behavior.spec.ts
```

Pass criteria:

- scoring stays bounded and explainable
- routing chooses territory and SLA behavior correctly
- SDR qualification blocks weak or synthetic proof
- outbound stays in safe mode or disabled mode as intended
- booked-job attribution remains idempotent
- buyer flow can move from queued scanner signal to lead and job evidence

Fail criteria:

- any test fails
- synthetic proof is accepted as buyer-grade
- routing or qualification allows unverified contact through to dispatch
- duplicate booked-job webhooks trigger duplicate writes

### 3. Runtime and readiness gate

Run:

```bash
npm run check:production
npm run operator-healthcheck
npm run validate-integrations
npm run proof:servpro
```

Pass criteria:

- `check:production` reports no `FAIL` checks
- `operator-healthcheck` reports active territories, active data sources, and the expected env flags
- `validate-integrations` exercises a real tenant and does not report `mode=simulated`
- `proof:servpro` writes a fresh `output/proof/<timestamp>/summary.md`

Fail criteria:

- missing or inconsistent Supabase, webhook, or v2 rollout config
- no active territories or no active live-safe sources
- `validate-integrations` falls back to simulated mode because Supabase credentials are missing
- proof bundle is missing, stale, or incomplete

Important pilot rule:

- If `validate-integrations` prints `mode=simulated`, treat that as a fail for pilot readiness even if the script exits `0`.

### 4. Live-source burst gate

Run:

```bash
npm run scanner:burst:ops
```

Pass criteria:

- the scanner burst completes against the intended live app URL
- the burst run returns real opportunities
- the throughput summary shows:
  - `captured_real_signals >= 20`
  - `qualified_contactable_signals >= 1`
  - `scanner_verified_leads_created >= 1`
- synthetic candidates are discarded, not counted
- the scanner result includes explainable warnings only, not hard failures

Fail criteria:

- auth cannot be established
- the burst run only returns synthetic or demo output
- `captured_real_signals` is below threshold
- verified lead creation is still zero
- the scanner warns that real opportunities did not remain after filtering

### 5. Conversion proof gate

Run:

```bash
npm run lead-engine
```

What this proves:

- scanner-sourced opportunities can be qualified
- SDR qualification can create verified contact evidence
- verified leads can be exported for downstream use

Pass criteria:

- operator test, SDR qualification, and verified-lead export all succeed
- at least one live-provider opportunity becomes contactable and verified

Fail criteria:

- the pipeline only produces research-only pressure
- qualification cannot create verified contact evidence
- export succeeds but there are no real verified leads to export

## Failure simulations to verify

These simulations are already represented in the current test suite and should stay green before a pilot release:

| Failure case | What it proves | Current coverage |
| --- | --- | --- |
| Missing or blocked connector config | Sources fail closed instead of pretending to be live | `tests/control-plane-readiness.spec.ts`, `tests/v2-free-sources-connectors.spec.ts`, `tests/v2-permits-ingestion.spec.ts`, `tests/v2-incidents-intelligence.spec.ts` |
| Scanner persistence missing | Scanner returns an explicit warning instead of hiding the problem | `tests/v2-scanner-fallbacks.spec.ts`, `tests/v2-scanner-throughput-lane-ohm.spec.ts` |
| Geocoding or enrichment failure | Live scanner stays live but partial, not fake | `tests/v2-scanner-fallbacks.spec.ts` |
| Duplicate or replayed webhook | Booked-job ingestion stays idempotent | `tests/v2-booked-job-webhook.spec.ts`, `tests/v2-webhook-auth.spec.ts` |
| Safe-mode outbound | Twilio and HubSpot preview instead of sending live | `tests/v2-outbound-safe-mode.spec.ts`, `tests/v2-suppression-destinations.spec.ts` |
| Synthetic proof | Buyer-grade flow rejects fake signal provenance | `tests/v2-sdr-agent.spec.ts`, `tests/v2-proof-authenticity.spec.ts`, `tests/v2-buyer-flow-smoke.spec.ts` |

## Manual pilot checks

After the commands pass, confirm these live surfaces:

- `/api/scanner/throughput` shows non-zero real capture, non-zero qualified contactable signals, and at least one verified lead
- `/dashboard/scanner` shows source context, confidence, and routing state without fake-looking placeholders
- `/dashboard/opportunities` shows a queued or qualified path that clearly distinguishes research-only from buyer-ready
- `/dashboard/jobs` shows a booked-job path that can be traced back to an attributed lead
- `output/proof/<timestamp>/summary.md` exists and matches the live run you just exercised

## Stale-run rule

Because there is no dedicated stale-run watchdog yet, treat any live Tier 1 connector run as a fail if:

- the latest run is `queued`, `running`, or `failed`
- the latest run is `partial` and the partial state is not expected and documented
- the run is older than the pilot window and the source did not produce fresh events

Until a watchdog exists, stale-run review must be part of the pilot sign-off.

## Pilot-ready output

If the gate passes, record:

- target environment name and URL
- branch and commit SHA
- `check:production` output
- `operator-healthcheck` output
- `validate-integrations` output
- `scanner:burst:ops` throughput numbers
- `lead-engine` output
- proof bundle path from `npm run proof:servpro`

