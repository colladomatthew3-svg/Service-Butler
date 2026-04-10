# Dispatchable Leads Plan

## Objective

Make Service Butler show a clear operator queue of real, recent leads that can be worked immediately, while excluding demo, seed, validation, and synthetic rows by default.

## 1. Ingestion Reality Audit

### Real external ingestion paths today

| Path | Current state | Classification | Notes |
| --- | --- | --- | --- |
| `POST /api/scanner/run` -> `runScanner()` -> `v2_source_events` / `v2_opportunities` | Closest live path and already filters synthetic scanner rows before persistence | Real external ingestion | Pulls public/provider signals such as Open311, OpenFEMA, USGS, incident pages, and other scanner-backed feeds. This is the fastest path to recent non-seeded candidates. |
| `v2` data-source runtime (`v2_data_sources`, `v2_connector_runs`, `v2_source_events`) | Real-source control plane exists, but operator visibility has been more proof-oriented than dispatch-oriented | Real external ingestion | Live-safe if source status, compliance, rollout, health, and freshness are all in good standing. |

### Manual operator entry

| Path | Current state | Classification | Notes |
| --- | --- | --- | --- |
| `POST /api/leads` | Creates legacy leads directly | Manual operator entry | Useful for operations, but not evidence of live ingestion. Excluded from Dispatchable Leads by default. |
| Pipeline add-lead forms / CSV import into legacy leads | Manual | Manual operator entry | Helpful for workflows, not proof of real inbound demand. |

### Seeded, demo, or test-only paths

| Path | Current state | Classification | Notes |
| --- | --- | --- | --- |
| Demo mode (`review-mode`, demo lead store, scanner demo rows) | Explicitly synthetic | Seeded/demo/test | Must stay excluded from Dispatchable Leads. |
| Integration validation rows (`integration_validation`, validation flags) | Safety and readiness records | Seeded/demo/test | Must stay excluded from real-lead counts and dispatch queue. |
| Seed scripts (`seed-*`, operator-test fallback rows, synthetic proofs) | Environment bootstrap | Seeded/demo/test | Useful for setup and QA, not operator dispatch. |

### Real path to prioritize

Prioritize the scanner -> v2 opportunity path first. It already:

- produces recent external candidates
- stores provenance and qualification metadata
- filters synthetic scanner rows before persistence
- can be made dispatch-ready by enforcing one shared live-safe predicate

## 2. What Counts As Dispatchable Now

A lead now counts as dispatchable only when all of the following are true:

1. It comes from a real source capture.
2. The underlying source is live-safe:
   active, approved, approved, pilot/live rollout, healthy, and fresh.
3. The candidate is recent:
   within the 72-hour dispatch window.
4. It has enough contact context to act:
   verified phone or email.
5. It has location and service context.
6. It is not still review-gated, already assigned, or terminal.

Blocked rows remain visible on the surface with the exact reason they are blocked.

## 3. Dispatchable Leads Surface

Dedicated operator surface:

- Route: `/dashboard/dispatchable-leads`
- API: `/api/dispatchable-leads`

The surface is intentionally narrow:

- dispatchable rows first
- blocked recent real candidates second
- no demo/manual/seed rows by default
- source, service signal, recency, trust status, and dispatch eligibility shown on every row

## 4. First Real Ingestion Path

The first confirmed path is:

`scanner run -> v2_data_sources / v2_source_events / v2_opportunities -> Dispatchable Leads`

Hardening added in this tranche:

- scanner-backed `v2_data_sources` rows are now stamped as approved, pilot, healthy, and fresh
- that keeps scanner-generated candidates eligible for the existing live-safe source-truth gate instead of falling out as stale or incomplete metadata

## 5. Validation Expectations

This tranche validates:

- synthetic, seeded, and integration-validation rows do not count as dispatchable
- recent live-safe rows with verified contact do count as dispatchable
- recent real rows without verified contact remain visible but blocked with a reason

## 6. Remaining Bottleneck

The next bottleneck is still contact acquisition quality at ingest time.

The system can now show a clean dispatch queue, but scale is still limited by how often real external events arrive with enough verified contact data to move straight into dispatch without SDR/manual qualification.
