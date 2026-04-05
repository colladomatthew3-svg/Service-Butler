# Runtime and Operations

This document audits the current execution model and defines the runtime contract Service Butler needs for stable, hands-off lead intelligence operations.

Update (April 5, 2026): connector runtime hardening has started in code via `supabase/migrations/20260405193000_connector_run_runtime_hardening.sql` and runner updates that add heartbeat, idempotency key, and replay metadata support. Remaining work is watchdog execution and full replay controls across all workflow families.

## Scope

This covers:

* scanner runs
* connector runs
* queue processing
* outbound actions
* webhook ingestion
* retries and idempotency
* stale-run handling
* source health checks
* environment readiness
* failure reporting

## Relevant Code Paths

The runtime is spread across several layers:

* `src/lib/v2/connectors/runner.ts`
* `src/lib/v2/connectors/types.ts`
* `src/lib/v2/connectors/registry.ts`
* `src/lib/v2/data-sources.ts`
* `src/lib/v2/readiness.ts`
* `src/app/api/connectors/runs/route.ts`
* `src/app/api/data-sources/[id]/run/route.ts`
* `src/app/api/data-sources/[id]/health/route.ts`
* `src/app/api/scanner/run/route.ts`
* `src/app/api/scanner/events/route.ts`
* `src/app/api/scanner/events/[id]/dispatch/route.ts`
* `src/lib/v2/sdr-agent.ts`
* `src/lib/v2/routing-engine.ts`
* `src/lib/v2/qualification-outreach-bridge.ts`
* `src/lib/v2/outreach-orchestrator.ts`
* `src/lib/v2/webhook-auth.ts`
* `src/lib/v2/booked-job-webhook.ts`
* `src/app/api/webhooks/crm/job-booked/route.ts`
* `src/app/api/webhooks/outbound/reply/route.ts`
* `src/app/api/webhooks/connectors/completed/route.ts`
* `src/app/api/health/production/route.ts`
* `scripts/operator-healthcheck.ts`
* `scripts/validate-integrations.ts`
* `scripts/production-readiness.sh`

## Current State Audit

| Surface | What exists now | Status | Risk |
| --- | --- | --- | --- |
| Connector execution | `runConnectorForSource()` inserts a `v2_connector_runs` row, pulls source records, normalizes them, upserts `v2_source_events`, creates `v2_opportunities`, writes `v2_opportunity_signals`, and marks runs terminal with heartbeat/idempotency/replay metadata support. | Implemented (hardened in-progress) | Stale-run watchdog invocation and operator replay UX are still missing. |
| Source health | `probeDataSourceHealth()` and `runDataSourceConnector()` call connector healthchecks before executing the pull path. | Implemented | Health is a point-in-time probe, not a continuous source health ledger. |
| Runtime mode derivation | `src/lib/v2/data-sources.ts` derives `fully-live`, `live-partial`, or `simulated` from source status, terms/compliance, and latest run status. | Implemented | Mode is inferred from scattered fields instead of a canonical run ledger. |
| Scanner runtime | `src/app/api/scanner/run/route.ts` and `src/lib/services/scanner.ts` combine live scanning, synthetic filtering, legacy scanner event persistence, and v2 opportunity writes. | Partial | The scanner is still hybrid: legacy feed plus v2 truth store. |
| Opportunity qualification | `src/app/api/opportunities/[id]/qualify/route.ts` updates `v2_opportunities.explainability_json` and may queue outreach. | Implemented | There is no separate workflow ledger for the qualification or routing run. |
| Outreach queue | `queueQualificationOutreach()` inserts `v2_outreach_queue` rows in `pending_review`. | Partial | There is no worker in this repo that drains the queue, approves, sends, or records replay lineage. |
| Outbound sending | `dispatchOutreach()` applies DNC, suppression, and cooling-window checks before Twilio/HubSpot actions. | Implemented | Delivery state lives in `v2_outreach_events`, but not in a canonical workflow-run table. |
| Webhook idempotency | `webhook_events` is used by webhook helpers to prevent duplicate processing. | Implemented | Idempotency is provider-specific and not generalized to all workflows. |
| Booked job attribution | `processBookedJobWebhook()` upserts `v2_jobs`, `v2_job_attributions`, and updates linked opportunities. | Implemented | The retry/replay contract is only implicit through webhook dedupe. |
| Environment readiness | `src/lib/v2/readiness.ts` and `/api/health/production` fail closed on required env problems and report remediation. | Implemented | Good guardrails, but not yet tied to a workflow ledger or source watchdog. |
| Operator validation | `operator-healthcheck`, `validate-integrations`, and `check:production` provide release gating. | Implemented | These validate configuration and a few integration paths, but not stale-run recovery or replay safety. |

## What Is Durable Today

These are the durable records already in the system:

* `v2_connector_runs`
* `v2_source_events`
* `v2_opportunities`
* `v2_opportunity_signals`
* `v2_assignments`
* `v2_leads`
* `v2_jobs`
* `v2_job_attributions`
* `v2_outreach_events`
* `v2_outreach_queue`
* `v2_suppression_list`
* `v2_audit_logs`
* `webhook_events`

That is a strong foundation, but it is not yet a single runtime ledger. Execution state is still inferred from a mix of run rows, opportunity rows, audit logs, webhook rows, and queue rows.

## Runtime State Model

The runtime should converge on a single explicit state machine for every workflow family.

### Canonical States

| State | Meaning | Terminal | Current coverage |
| --- | --- | --- | --- |
| `queued` | Work has been accepted and is waiting to start. | No | Present in schema defaults and some Inngest/event flow semantics. |
| `running` | A worker has claimed the run and is actively processing. | No | Present for connector runs. |
| `success` | The run completed all required work. | Yes | `completed` in connector runs and successful webhook paths. |
| `partial` | Some work succeeded, but one or more records or steps failed. | Yes | Present for connector runs. |
| `failed` | The run failed before finishing its required work. | Yes | Present for connector runs and several routes. |
| `stale` | The run was left `running` past a timeout without a terminal update. | Yes | Implemented for connector-run model; watchdog execution path still needs wiring. |
| `replayed` | A new run was created from a prior run to recover or reprocess. | Yes | Implemented in connector-run status model; replay trigger UX/ops controls still pending. |

### Recommended Ledger Shape

The repo needs one canonical workflow ledger, not just per-table status columns.

Recommended schema direction:

* `v2_workflow_runs`
* `v2_workflow_run_attempts`
* `v2_workflow_run_events`

If schema expansion must be staged, the minimum viable path is to extend `v2_connector_runs` first and then normalize into a shared workflow table later.

### Suggested Ledger Fields

Every run record should include:

* `id`
* `tenant_id`
* `workflow_type` such as `connector_pull`, `scanner_run`, `opportunity_qualification`, `routing`, `outreach_send`, `webhook_ingest`
* `status`
* `attempt_number`
* `idempotency_key`
* `run_group_id`
* `replayed_from_run_id`
* `source_id` where relevant
* `opportunity_id` where relevant
* `lead_id` where relevant
* `assignment_id` where relevant
* `queued_at`
* `started_at`
* `completed_at`
* `heartbeat_at`
* `stale_at`
* `error_code`
* `error_summary`
* `error_detail`
* `input_fingerprint`
* `output_summary_json`
* `step_summary_json`
* `created_by`
* `updated_by`

## Workflow-Specific Runtime Contract

### Connector Pulls

Current behavior:

* `src/lib/v2/connectors/runner.ts` creates a `v2_connector_runs` row with `status = running`
* the connector’s `compliancePolicy()` can block the run before any ingestion
* `pull()` fetches records
* `normalize()` converts records into `ConnectorNormalizedEvent` objects
* `v2_source_events` receives deduped event rows via `upsert(..., { onConflict: "source_id,dedupe_key" })`
* `v2_opportunities` and `v2_opportunity_signals` are written from normalized events
* the run becomes `completed`, `partial`, or `failed`

Gaps:

* stale-run watchdog invocation path is not yet wired into scheduled operations
* no retry count or run-attempt table
* replay controls are available in schema/runner but not yet exposed as an explicit operator flow
* no summary of which events were skipped due to validation or dedupe

Recommendation:

* record a run heartbeat after pull, after normalize, and after each batch write
* store validation failures per event, not just aggregate counts
* create a replayable `run_key` that makes repeated invocations idempotent
* mark the original run `replayed` instead of mutating it in place when a manual retry is issued

### Scanner Runs

Current behavior:

* `src/app/api/scanner/run/route.ts` forces the live scanner path
* synthetic scanner records are filtered out before persistence
* legacy `scanner_events` rows are written when available
* live scanner opportunities can be mirrored into the v2 truth store
* `src/app/api/scanner/events/route.ts` can fall back to v2 opportunities when legacy scanner rows are missing

Gaps:

* the scanner is still a hybrid of legacy and v2 data models
* there is no explicit scanner run ledger
* a partial legacy write can still leave the live scan looking successful
* there is no stale scan watchdog

Recommendation:

* introduce a scanner run record that captures the source inputs, live-mode status, and persistence targets
* treat the scanner as a workflow with a claimable run row and terminal state
* persist a run summary even when legacy tables are unavailable

### Opportunity Qualification

Current behavior:

* `POST /api/opportunities/[id]/qualify` updates `v2_opportunities`
* `buildQualificationUpdate()` encodes contactability, provenance, and next action into `explainability_json`
* `maybeQueueQualificationOutreach()` may queue an outreach item in `v2_outreach_queue`

Gaps:

* no queue worker in repo drains `v2_outreach_queue`
* no explicit qualification run row
* no replay semantics for a qualification change

Recommendation:

* create a qualification workflow run record whenever a qualification mutation is accepted
* preserve before/after snapshots as ledger events
* write the outreach queue item and the queue claim into the same workflow family

### Routing and Assignment

Current behavior:

* `src/lib/v2/routing-engine.ts` uses territory matching, SLA computation, and routing rules
* `src/lib/v2/sdr-agent.ts` may auto-route opportunities after qualification
* `src/lib/workflows/v2-functions.ts` includes an SLA escalation watch for assignments

Gaps:

* assignment decisions are not persisted as a dedicated run ledger
* there is no explicit reroute/replay record when an assignment escalates
* queue and SLA watch behavior are split across service code and Inngest

Recommendation:

* persist a routing decision record with the reason, rules matched, territory, and fallback path
* write SLA escalation as a new event on the same workflow group
* expose replay status when an assignment is auto-escalated

### Outbound Actions

Current behavior:

* `src/lib/v2/outreach-orchestrator.ts` checks DNC, suppression, and cooling windows
* Twilio and HubSpot actions have safe-mode preview paths
* `v2_outreach_events` records queued, sent, failed, skipped, and replied events
* `src/app/api/webhooks/outbound/reply/route.ts` converts STOP-like replies into suppression rows and DNC updates

Gaps:

* queue approval and send are not represented as one workflow ledger
* SMS, email, voice, and CRM-task sends do not share one execution model
* there is no explicit send retry history or replay lineage

Recommendation:

* create a send ledger that records the destination, purpose, safety mode, and provider response
* keep safe-mode preview rows distinct from live sends
* record a send attempt event before provider call and a terminal event after the provider response

## Retries and Idempotency

Current idempotency mechanisms:

* `webhook_events` dedupes webhook processing by `provider` and `event_id`
* `v2_source_events` dedupes by `(source_id, dedupe_key)`
* `v2_outbound_queue` has a unique member index for list membership
* some outbound helpers prevent duplicate sends through suppression and cooling windows

Missing pieces:

* no generic run idempotency key
* no replay lineage
* no attempt counter
* no guaranteed single-flight execution per workflow key

Recommended policy:

* every execution entrypoint must accept or compute an `idempotency_key`
* identical keys within the same workflow family must either return the existing run or create a `replayed` child run, never a second ambiguous primary run
* retries should be explicit and bounded
* retries should only happen on retryable failures, not on validation or compliance blocks

Suggested retry policy:

* retryable: network failures, provider timeouts, transient Supabase connectivity, temporary rate limits
* not retryable: compliance denial, missing credentials, auth failure, invalid payload, duplicate webhook, tenant mismatch
* maximum automatic retries: 3
* backoff: exponential with jitter
* terminal after max retries: `failed`

## Stale-Run Watchdog

Watchdog primitives now exist:

* SQL function: `public.mark_stale_connector_runs(p_stale_after_minutes integer default 45)`
* ops script: `scripts/mark-stale-connector-runs.mjs`
* package command: `npm run runtime:mark-stale-runs`

Remaining gap: scheduled execution and dashboard surfacing still need to be wired.

Recommended watchdog behavior:

* scan all `running` runs on a schedule
* mark runs `stale` when `heartbeat_at` or `completed_at` is older than the workflow-specific timeout
* create an audit event when a run becomes stale
* surface stale runs in the operator dashboard and production health response
* allow a manual rerun that creates a `replayed` child run

Suggested workflow timeouts:

* connector pull: 30 minutes unless source-specific config says otherwise
* scanner run: 15 minutes
* routing/assignment decision: 10 minutes
* qualification mutation: 5 minutes
* outbound send: 5 minutes
* webhook ingest: 2 minutes

## Source Health Checks

Current source health behavior:

* `ConnectorAdapter.healthcheck()` exists on all connectors
* `probeDataSourceHealth()` and `runDataSourceConnector()` use healthchecks before pull
* readiness logic blocks simulated or partially live sources from buyer-proof status

Recommendation:

* record healthcheck timestamps and outcomes in the runtime ledger
* keep a last-successful-health snapshot per source
* distinguish transport health from compliance health
* block live execution when required secrets or provider URLs are absent
* persist the reason a source was skipped, not just a generic failure

## Failure Reporting

The repo already has good failure surfaces:

* `src/app/api/health/production/route.ts` returns `503` on required failures
* `src/lib/v2/readiness.ts` emits remediation text
* `scripts/operator-healthcheck.ts` prints PASS/WARN/FAIL rows
* `scripts/validate-integrations.ts` produces actionable result rows
* `src/lib/v2/connectors/runner.ts` writes `error_summary`
* webhook handlers fail closed on missing or invalid shared secret

What still needs to improve:

* failure codes should be normalized across workflows
* terminal failures should carry step name, retry count, and replay lineage
* operator UI should show a run history timeline, not only the latest status

Recommended failure payload:

* `error_code`
* `error_summary`
* `error_detail`
* `failed_step`
* `workflow_type`
* `retryable`
* `retry_count`
* `stale_reason`
* `replayed_from_run_id`

## Environment Readiness and Fail-Closed Rules

The current repo already fails closed in several important places:

* `src/lib/v2/webhook-auth.ts` returns `503` if `WEBHOOK_SHARED_SECRET` is missing and `401` for bad signatures
* `src/lib/v2/readiness.ts` marks missing Supabase, missing V2 flags, and missing webhook secret as required failures
* `src/app/api/health/production/route.ts` returns `503` when required readiness checks fail
* `src/lib/v2/twilio.ts` and `src/lib/v2/outreach-orchestrator.ts` use safe-mode or disabled behavior when providers are not ready
* `src/lib/v2/data-sources.ts` and `src/lib/control-plane/readiness.ts` block simulated or partially live data sources from buyer-proof states

Operational rule:

* missing required config must never degrade into silent live behavior
* if a provider is not safe, the system should return a blocked or preview state
* if a source is simulated, the UI and runtime must say so explicitly

Required environment gates:

* `NEXT_PUBLIC_APP_URL`
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`
* `WEBHOOK_SHARED_SECRET`
* `SB_USE_V2_READS`
* `SB_USE_V2_WRITES`
* `SB_TWILIO_SAFE_MODE` when Twilio is present
* `SB_HUBSPOT_SAFE_MODE` when HubSpot is present

## Implementation Recommendations

Prioritized runtime work:

1. Add a canonical workflow ledger for connector, scanner, routing, qualification, outbound, and webhook runs.
2. Add attempt tracking and replay lineage to every workflow family.
3. Add a stale-run watchdog with workflow-specific SLAs and explicit stale transitions.
4. Add a queue worker for `v2_outreach_queue` so pending-review outreach has a real drain path.
5. Add health snapshots and last-success metadata per source.
6. Normalize failure codes and surface them in the dashboard and health endpoints.
7. Add a replay/rerun control that creates a child run instead of mutating the original execution record.

## Evidence To Preserve

When diagnosing runtime issues, keep these artifacts:

* `output/proof/<timestamp>/summary.md`
* `output/proof/<timestamp>/operator-healthcheck/*`
* `output/proof/<timestamp>/validate-integrations/*`
* `output/proof/<timestamp>/production-readiness.*`
* any stale-run snapshots from the runtime ledger
