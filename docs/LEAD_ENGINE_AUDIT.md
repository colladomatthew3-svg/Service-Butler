# Lead Engine Audit

Date: 2026-04-05

Scope: actual repository audit of scanner, source ingestion, automations, integrations, dashboard/jobs flow, tenant isolation, and runtime behavior.

## Executive Summary

Service Butler is not a toy. The repository already contains a real v2 lead-intelligence stack with tenant isolation, Postgres-backed source/event/opportunity tables, scoring, routing, qualification, safe-mode outreach, booked-job attribution, and a production readiness check path.

The problem is not absence of engineering. The problem is split truth.

The repo still runs two overlapping systems:

- a legacy `accounts / scanner_events / opportunities / leads / jobs` path
- a v2 `v2_tenants / v2_data_sources / v2_source_events / v2_opportunities / v2_leads / v2_jobs` path

That duality is the main architectural risk. The code is honest about demo/synthetic data, but there is still enough mirroring and fallback behavior that operators can accidentally read a mixed story unless the v2 path is treated as the canonical operating plane.

## Severity-Ordered Findings

| Severity | Finding | Evidence | Why it matters |
| --- | --- | --- | --- |
| P1 | The repo has two active truth paths for the same business objects. | `src/app/api/scanner/run/route.ts:198-485`, `src/app/api/opportunities/route.ts:32-188`, `src/app/(dashboard)/dashboard/page.tsx:84-210` | Legacy and v2 views can diverge. That creates duplicate attribution, inconsistent dashboards, and operator mistrust. |
| P1 | Connector runtime hardening is in progress but not complete. | `supabase/migrations/20260405193000_connector_run_runtime_hardening.sql`, `src/lib/v2/connectors/runner.ts:706-1017`, `src/lib/workflows/v2-functions.ts:8-139` | `stale/replayed`, heartbeat, and idempotency metadata are now in code, but watchdog execution and replay operator UX are not fully wired yet. |
| P2 | Several live sources intentionally fall back to sample/static data or partial-live modes. | `src/lib/control-plane/catalog.ts:16-185`, `src/lib/control-plane/readiness.ts:60-130`, `src/lib/v2/connectors/permits/index.ts`, `src/lib/v2/connectors/social/index.ts`, `src/lib/v2/connectors/incidents/index.ts`, `src/lib/v2/connectors/utility/index.ts` | Good for development, but risky if a buyer expects every surface to be live by default. The UI must keep surfacing this honestly. |
| P2 | Qualification-triggered outreach is intentionally safe-mode and review-gated. | `src/lib/v2/qualification-outreach-bridge.ts:94-165`, `src/app/api/opportunities/[id]/qualify/route.ts:133-181` | This is a good safety choice, but it means the system is not yet fully hands-off from qualification to first-touch send. |
| P2 | Demo and synthetic code still directly shapes operator flows. | `src/lib/services/review-mode.ts:14-38`, `src/lib/services/scanner.ts:729-856`, `src/lib/services/scanner-truth.ts:9-27`, `src/app/api/scanner/events/[id]/dispatch/route.ts:53-94` | Demo support is useful, but it must stay visibly separated from buyer-proof metrics and live truth. |

## What Is Real Today

### Implemented

| Capability | Status | Evidence |
| --- | --- | --- |
| Tenant resolution and isolation | Implemented | `src/lib/v2/context.ts:80-143`, `supabase/migrations/20260314103000_franchise_v2_foundation.sql:526-705` |
| Source registry model and connector interface | Implemented | `src/lib/v2/connectors/types.ts:1-61`, `src/lib/v2/connectors/registry.ts:1-38` |
| Live connector runner with compliance gating, dedupe, scoring, cluster upserts, and opportunity writes | Implemented | `src/lib/v2/connectors/runner.ts:675-904` |
| Explainable scoring | Implemented | `src/lib/v2/scoring.ts:47-130`, `src/lib/v2/connectors/runner.ts:489-539` |
| Routing and assignment | Implemented | `src/lib/v2/routing-engine.ts:185-260`, `src/app/api/opportunities/[id]/route/route.ts:10-58` |
| Qualification and job conversion | Implemented | `src/lib/v2/opportunity-qualification.ts`, `src/app/api/opportunities/[id]/qualify/route.ts:64-181`, `src/app/api/scanner/events/[id]/dispatch/route.ts:53-430` |
| Booked-job attribution | Implemented | `src/lib/v2/booked-job-webhook.ts:146-255` |
| Audit logs | Implemented | `src/lib/v2/audit.ts`, `src/lib/v2/connectors/runner.ts:851-895`, `src/lib/v2/booked-job-webhook.ts:235-248` |
| Production readiness health endpoint | Implemented | `src/lib/v2/readiness.ts:79-141`, `src/app/api/health/production/route.ts:8-40` |

### Partial

| Capability | Status | Evidence |
| --- | --- | --- |
| Canonical source registry | Partial | `src/lib/control-plane/catalog.ts:16-185`, `src/lib/v2/data-sources.ts:294-389` |
| Scanner as lead-intelligence engine | Partial | `src/lib/services/scanner.ts:729-980`, `src/app/api/scanner/run/route.ts:135-485` |
| Operator dashboard unification | Partial | `src/app/(dashboard)/dashboard/page.tsx:84-720`, `src/components/dashboard/lead-scanner-view.tsx:229-260`, `src/components/dashboard/opportunities-view.tsx:65-260` |
| Routing by polygon | Partial | `src/lib/v2/routing-engine.ts:61-94`, `src/lib/v2/routing-engine.ts:200-234`, `src/lib/control-plane/readiness.ts:60-130` |
| Live source health reporting | Partial | `src/lib/v2/data-sources.ts:509-620`, `src/app/api/data-sources/[id]/health/route.ts:11-76` |

### Stubbed / Demo / Synthetic

| Capability | Status | Evidence |
| --- | --- | --- |
| Demo scanner opportunities | Stubbed/demo | `src/lib/services/scanner.ts:729-856` |
| Synthetic truth filtering | Stubbed/demo guard | `src/lib/services/scanner-truth.ts:9-27` |
| Compat/demo mode API responses | Stubbed/demo | `src/app/api/data-sources/route.ts:12-27`, `src/app/api/connectors/runs/route.ts:26-47`, `src/app/api/territories/route.ts:8-31` |
| Sample/static source fallback | Stubbed/partial live | `src/lib/control-plane/readiness.ts:82-102`, `src/lib/v2/connectors/permits/index.ts`, `src/lib/v2/connectors/social/index.ts`, `src/lib/v2/connectors/incidents/index.ts` |

### Broken / Risky

| Risk | Status | Evidence |
| --- | --- | --- |
| Stale-run and replay model exists, but watchdog execution path is incomplete | Risky/partial | `supabase/migrations/20260405193000_connector_run_runtime_hardening.sql`, `src/lib/v2/connectors/runner.ts:706-1017` |
| Mixed legacy and v2 read paths can confuse operators | Risky | `src/app/api/opportunities/route.ts:32-188`, `src/app/api/scanner/events/route.ts:54-260`, `src/app/(dashboard)/dashboard/page.tsx:84-210` |
| Some connectors are live only when terms, credentials, and config align | Risky but honest | `src/lib/v2/data-sources.ts:149-223`, `src/lib/control-plane/readiness.ts:60-130` |

### Missing

| Capability | Missing piece |
| --- | --- |
| Canonical source registry as a first-class persisted control plane | Registry exists, but the operational model is still spread across `dataSourceCatalog`, `v2_data_sources`, and runtime config parsing. |
| Stable runtime ledger for queued/running/success/partial/failed/stale/replayed | Connector-run ledger is now extended with heartbeat/idempotency/replay metadata; non-connector workflows still need the same explicit model. |
| Fully hands-off conversion from signal to booked job | Outreach is safe-mode and review-gated; qualification can queue first-touch, but not all send paths are autonomous. |
| A single operator-facing truth model | Dashboard and API surfaces still merge legacy and v2 semantics. |

## Key File Evidence

### Scanner and signal capture

- `src/lib/services/scanner.ts:43-43` defines scanner runtime modes and the legacy/demo split.
- `src/lib/services/scanner.ts:729-856` creates demo opportunities.
- `src/lib/services/scanner.ts:917-980` turns connector events into opportunities.
- `src/app/api/scanner/run/route.ts:198-485` filters synthetic records, writes legacy tables, and mirrors into v2 when mapping exists.

### v2 ingestion and scoring

- `src/lib/v2/connectors/types.ts:1-61` defines the connector contract.
- `src/lib/v2/connectors/registry.ts:1-38` lists the active connector family registry.
- `src/lib/v2/connectors/runner.ts:675-904` is the canonical v2 ingest pipeline.
- `src/lib/v2/scoring.ts:47-130` computes explainable scores.

### Routing, qualification, and conversion

- `src/lib/v2/routing-engine.ts:185-260` resolves territory and routing inputs.
- `src/app/api/opportunities/[id]/route/route.ts:10-58` routes opportunities and emits an assignment event.
- `src/app/api/opportunities/[id]/qualify/route.ts:64-181` qualifies opportunities and can queue first-touch outreach.
- `src/lib/v2/booked-job-webhook.ts:146-255` turns booked jobs into job records plus attribution.

### Runtime and safety

- `src/lib/v2/readiness.ts:79-141` is the production-readiness gate.
- `src/app/api/health/production/route.ts:8-40` exposes the readiness summary.
- `src/lib/v2/webhook-auth.ts:7-28` fails closed when the shared webhook secret is missing or wrong.
- `src/lib/v2/outreach-orchestrator.ts:109-294` enforces suppression, cooling windows, and safe provider behavior.

## Bottom Line

The repo already contains most of the building blocks for a real lead intelligence engine.

What it still lacks is a single, operator-trustworthy control plane with:

- one canonical source registry
- one canonical opportunity schema
- one runtime ledger for runs and replays
- one clearly separated live vs demo story
- one stable path from signal to booked-job attribution

That is the work the next phase should focus on.
