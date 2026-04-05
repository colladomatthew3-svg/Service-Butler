# Validation Checklist

This checklist is the operational gate for changes that affect scanner runs, connector runs, queue processing, routing, outbound actions, or workflow runtime behavior.

## Principles

* verify the actual code path that changed
* prefer real table writes and real failure simulations over static assertions
* do not accept demo-only behavior as proof of live readiness
* fail if runtime mode, source truth, or safety mode is ambiguous

## Before You Call It Ready

Always capture:

* `git status --short --branch`
* branch name and commit SHA
* target environment
* the command outputs from the gates below
* the latest proof artifacts under `output/proof/<timestamp>/`

## Environment Preflight

| Check | Command | Pass signal | Why it matters |
| --- | --- | --- | --- |
| Repo cleanliness | `git status --short --branch` | You can explain every uncommitted file. | Avoid accidental release scope drift. |
| Production readiness summary | `npm run check:production` | Exit code `0`. | This is the main environment gate. |
| Operator health | `npm run operator-healthcheck` | Exit code `0`. | Confirms required tables, flags, and tenant mapping. |
| Integration validation | `npm run validate-integrations` | Exit code `0` or explicit simulated skip when credentials are absent. | Confirms safe-mode provider paths and live event writes. |
| Stale-run watchdog probe | `npm run runtime:mark-stale-runs` | Exit code `0` with pass/warn output. | Confirms stale connector runs can be surfaced and remediated. |
| Proof artifact | `npm run proof:servpro` | Writes `output/proof/<timestamp>/summary.md`. | Prevents claims without a preserved proof chain. |

## Code Gates

Run the smallest set that still covers the change:

| Change area | Commands | Minimum pass criteria |
| --- | --- | --- |
| General runtime or data flow | `npm run typecheck` and `npm run build` | Both exit `0`. |
| Scanner runtime | `npm test -- tests/v2-scanner-fallbacks.spec.ts tests/v2-scanner-throughput-verification.spec.ts tests/demo-scanner.spec.ts tests/control-plane-network.spec.ts` | Scanner stays live-safe, falls back honestly, and reports throughput. |
| Connector framework | `npm test -- tests/v2-connectors.spec.ts tests/v2-permits-ingestion.spec.ts tests/v2-free-sources-connectors.spec.ts tests/v2-scoring.spec.ts` | Connector normalization, compliance gating, and scoring stay stable. |
| Opportunity pipeline-state contract | `npm test -- tests/v2-opportunity-pipeline.spec.ts` | Canonical stage mapping remains stable and explainable. |
| Routing and territory logic | `npm test -- tests/v2-territory-routing.spec.ts tests/v2-network-activation.spec.ts tests/control-plane-readiness.spec.ts` | Routing decisions and readiness gates remain tenant-safe. |
| Qualification and review flows | `npm test -- tests/v2-opportunity-qualification.spec.ts tests/opportunity-qualification.spec.ts tests/v2-opportunity-qualification-backfill.spec.ts` | Qualification state and provenance remain explainable. |
| Outbound safety | `npm test -- tests/v2-outbound-safe-mode.spec.ts tests/v2-suppression-destinations.spec.ts tests/v2-assignment-webhook.spec.ts` | Safe mode, suppression, and queueing behave as expected. |
| Webhooks and attribution | `npm test -- tests/v2-webhook-auth.spec.ts tests/v2-booked-job-webhook.spec.ts tests/v2-assignment-webhook.spec.ts` | Webhooks fail closed and remain idempotent. |
| Runtime mode honesty | `npm test -- tests/v2-runtime-mode-disclosure.spec.ts tests/control-plane-readiness.spec.ts tests/control-plane-network.spec.ts` | Simulated, partial, and live modes are disclosed honestly. |

## Runtime Validation Matrix

### Connector Runs

Required validation:

* run the relevant connector tests
* inspect `src/lib/v2/connectors/runner.ts` behavior through a test or mock that confirms:
  * a run row is created
  * compliance can block ingestion before pull
  * duplicate source events are deduped
  * partial runs report `partial`
  * stale/replayed lifecycle states are accepted
  * idempotency collisions return an existing run instead of ambiguous duplicates
  * failures persist `error_summary`

Suggested tests:

* `tests/v2-connectors.spec.ts`
* `tests/v2-permits-ingestion.spec.ts`
* `tests/v2-free-sources-connectors.spec.ts`
* `tests/v2-scanner-throughput-verification.spec.ts`

Pass when:

* `v2_connector_runs` receives a terminal state
* `v2_source_events` rows are written only for valid normalized records
* compliance-denied runs fail without creating fake events
* partial runs are surfaced, not hidden

### Scanner Runs

Required validation:

* verify the scanner still filters synthetic rows
* verify scanner fallback behavior when legacy persistence is missing
* verify live mode stays live, even when geocoding fails
* verify throughput numbers reflect real persisted signals

Suggested tests:

* `tests/v2-scanner-fallbacks.spec.ts`
* `tests/v2-scanner-throughput-verification.spec.ts`
* `tests/v2-runtime-mode-disclosure.spec.ts`
* `tests/demo-scanner.spec.ts`

Pass when:

* the scanner returns warnings instead of pretending success
* live mode does not silently degrade to demo mode
* persisted v2 opportunities can backstop legacy scanner rows
* synthetic records are hidden from buyer-facing metrics

### Opportunity Qualification

Required validation:

* verify research-only signals stay out of buyer proof
* verify `qualified_contactable` requires provenance
* verify qualification updates preserve explainability
* verify outbound queueing only happens when the opportunity is truly eligible

Suggested tests:

* `tests/v2-opportunity-qualification.spec.ts`
* `tests/opportunity-qualification.spec.ts`
* `tests/v2-opportunity-qualification-backfill.spec.ts`

Pass when:

* qualification updates never drop provenance
* research-only rows remain research-only
* outreach queue entries are marked `pending_review`

### Routing and Assignment

Required validation:

* verify territory matching
* verify SLA and escalation behavior
* verify routing does not cross tenant boundaries

Suggested tests:

* `tests/v2-territory-routing.spec.ts`
* `tests/v2-network-activation.spec.ts`
* `tests/control-plane-network.spec.ts`

Pass when:

* routing decisions stay within the tenant boundary
* escalations are explainable
* no fallback path leaks data across tenants

### Outbound Actions

Required validation:

* safe mode must remain safe
* suppression and DNC must block sends
* qualification-triggered outreach must queue for review
* reply handling must opt leads out and write suppression rows

Suggested tests:

* `tests/v2-outbound-safe-mode.spec.ts`
* `tests/v2-suppression-destinations.spec.ts`
* `tests/v2-assignment-webhook.spec.ts`

Pass when:

* Twilio safe mode returns a preview path, not a live send
* HubSpot safe mode returns a preview path, not a live task
* `v2_outreach_queue` stays `pending_review` until a human approval path exists
* STOP-like replies update `v2_leads.do_not_contact` and `v2_suppression_list`

### Webhooks and Attribution

Required validation:

* missing webhook secret must fail closed
* wrong signatures must be rejected
* booked-job webhook retries must not duplicate side effects
* attribution must link back to opportunity and source event when available

Suggested tests:

* `tests/v2-webhook-auth.spec.ts`
* `tests/v2-booked-job-webhook.spec.ts`

Pass when:

* missing `WEBHOOK_SHARED_SECRET` returns `503`
* bad signatures return `401`
* duplicate webhook events short-circuit writes
* opportunity updates only happen after a unique accepted webhook

## Production Gates

Run these in order before a production-affecting merge or deploy:

1. `npm run typecheck`
2. `npm run build`
3. `npm test -- tests/smoke-home-login.spec.ts tests/smoke-dashboard-entry.spec.ts tests/smoke-demo-lead-to-schedule.spec.ts`
4. `npm run operator-healthcheck`
5. `npm run validate-integrations`
6. `npm run proof:servpro`
7. `npm run check:production`

Pass condition:

* all required commands exit `0`
* proof artifacts are present
* `/api/health/production` has no required failures

## Failure Simulations You Should Always Exercise

These are the minimum negative cases that keep the gate honest:

* remove `WEBHOOK_SHARED_SECRET` and confirm webhook routes return `503`
* send the wrong webhook signature and confirm `401`
* enable Twilio safe mode and confirm preview output only
* enable HubSpot safe mode and confirm preview output only
* insert a duplicate booked-job webhook and confirm no duplicate writes
* run the scanner when geocoding fails and confirm the response remains live-partial, not fake live
* probe a source with missing Firecrawl or provider config and confirm readiness blocks live capture
* run integration validation with missing credentials and confirm the script reports simulated skip, not a fake pass

## Evidence Bundle

For every validation pass, capture:

* command output or a screenshot
* `output/proof/<timestamp>/summary.md`
* any stderr logs from `output/proof/<timestamp>/`
* the latest `connector_run` row or source health row when runtime behavior changed
* the latest `/api/health/production` JSON if a live environment was involved

## Stop Conditions

Stop and do not merge if any of the following are true:

* a required command fails
* live mode is silently downgraded to simulated mode
* a source marked live-safe is actually sample-backed or simulated
* webhook auth can be bypassed
* outbound sends can happen without suppression or safe mode
* a stale or failed run has no visible remediation path
* a tenant-scoped route can read or write outside the tenant boundary

## What “Stable” Means Here

Stable does not mean “no errors ever.” It means:

* failures are explicit
* retries are bounded
* duplicate webhooks are idempotent
* run states are visible
* stale work is detectable
* source safety is clear
* operator actions are explainable
* proof artifacts exist for claims about live behavior
