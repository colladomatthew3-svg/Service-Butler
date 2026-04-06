# 30-Day Execution Plan

Date window: April 6, 2026 to May 5, 2026

Objective: move Service Butler from mixed-mode intelligence to a production-grade, hands-off lead engine with live-source ingestion, explainable scoring, durable runtime controls, and clear convert-to-job workflows.

## Success Criteria (30-Day)

1. Canonical source intake and opportunity pipeline are documented and reflected in code paths.
2. Connector runtime has durable run-state behavior (`queued/running/completed/partial/failed/stale/replayed`) with heartbeat and idempotency controls.
3. Operator-facing opportunities expose clear pipeline stage and review/action state.
4. Lead qualification, routing, and conversion paths are measurable with pilot release gates.
5. Team can ship in small, reviewable PR slices with clear rollback steps.

## Baseline Snapshot (as of April 5, 2026)

- Strong v2 foundation exists (`v2_data_sources`, `v2_source_events`, `v2_opportunities`, `v2_leads`, `v2_jobs`, attribution, routing, qualification).
- Main architecture risk is split truth between legacy and v2 flows.
- Runtime hardening has begun with connector run heartbeat/idempotency/replay metadata and stale/replayed run states.
- Outreach is intentionally safe-mode + review-gated; this protects trust but reduces full hands-off execution.

## Milestones

### Week 1 (Apr 6 - Apr 12): Truth and Control Plane

Scope:
- Lock architecture docs and source registry as canonical planning artifacts.
- Finalize runtime run-state contract and stale-run watchdog invocation path.
- Add canonical opportunity pipeline-stage mapping in read APIs.

Acceptance criteria:
- `docs/LEAD_ENGINE_AUDIT.md`, `docs/CURRENT_STATE_MAP.md`, `docs/LEAD_ENGINE_ARCHITECTURE.md` published and consistent.
- Connector run runtime migration merged and validated in staging.
- Opportunities API returns canonical `pipeline_stage`.

PR slices:
1. Runtime hardening migration + runner updates.
2. Opportunity pipeline-stage helper + API exposure + tests.
3. Delivery docs + validation checklist updates.

### Week 2 (Apr 13 - Apr 19): Core Source Framework Stabilization

Scope:
- Normalize source adapter contract usage across connector entry points.
- Add source-run idempotency key generation at API/workflow trigger boundaries.
- Add stale-run watchdog trigger path (scheduled task or explicit ops endpoint/script).

Acceptance criteria:
- Duplicate trigger attempts do not create duplicate effective runs.
- Stale running runs are marked and visible within SLO window.
- Source health summary includes actionable failure detail.

PR slices:
1. Idempotent run-request plumbing.
2. Stale-run watchdog execution path.
3. Source health/reporting refinements.

### Week 3 (Apr 20 - Apr 26): Intelligence and Conversion Reliability

Scope:
- Tighten dedupe/classification/scoring explainability and make routing reasons explicit.
- Improve review queue and qualification-to-outreach handoff observability.
- Harden convert-to-job linkage from qualified opportunity to booked attribution.

Acceptance criteria:
- Every qualified opportunity has explainable source + scoring + next action metadata.
- Review queue states are visible and auditable.
- Booked-job linkage can be traced from source event to attribution row.

PR slices:
1. Scoring/routing explainability contract improvements.
2. Review queue UX + API visibility updates.
3. Conversion integrity and attribution guardrails.

### Week 4 (Apr 27 - May 5): Pilot Readiness and Operational Proof

Scope:
- Run full validation matrix and failure simulations.
- Close highest-severity defects.
- Lock pilot release gate and known-issues register.

Acceptance criteria:
- `docs/PILOT_RELEASE_GATE.md` criteria are executable and hard to bypass.
- `docs/KNOWN_ISSUES.md` is current with owner/mitigation/target date.
- `npm run check:production` + targeted validation suite are green in staging.

PR slices:
1. Validation/failure simulation improvements.
2. Pilot gate and risk closure patches.
3. Final operator workflow refinements.

## Operating Cadence

- Daily: connector run health check, top failure reasons, stale-run count, duplicate run suppressions.
- Twice weekly: source quality review (freshness, reliability, false positives, conversion contribution).
- Weekly: pilot readiness checkpoint against release gate.

## Delivery Governance

- Keep changes in small PRs with explicit rollout and rollback notes.
- Gate production-impacting changes behind readiness checks and safe mode where applicable.
- Prefer additive contracts and compatibility shims before deleting legacy paths.

## Key Metrics to Track Weekly

- Source freshness compliance rate.
- Opportunity qualification rate and quality mix (`qualified_contactable`, `queued_for_sdr`, `research_only`, `rejected`).
- Duplicate suppression rate.
- Mean connector run latency and stale-run count.
- Routing-to-contact conversion rate.
- Opportunity-to-booked-job conversion rate.
