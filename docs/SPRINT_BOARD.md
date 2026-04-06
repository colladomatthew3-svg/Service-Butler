# Sprint Board

Last updated: April 5, 2026
Sprint window: April 6, 2026 to April 19, 2026 (Weeks 1-2 execution focus)

## Status Legend

- `DONE`: merged or committed in current branch and validated.
- `IN_PROGRESS`: actively being implemented in current branch.
- `NEXT`: queued for next PR slice.
- `BLOCKED`: cannot proceed without external dependency.

## Active Workboard

| ID | Stream | Item | Status | Owner | Dependencies | Deliverable |
| --- | --- | --- | --- | --- | --- | --- |
| SB-001 | Architecture | Deep repo audit and current-state map | DONE | Codex + Audit agent | None | `docs/LEAD_ENGINE_AUDIT.md`, `docs/CURRENT_STATE_MAP.md`, `docs/LEAD_ENGINE_ARCHITECTURE.md` |
| SB-002 | Source framework | Canonical source registry and adapter framework documentation | DONE | Codex + Source Connector agent | SB-001 | `docs/SOURCE_REGISTRY.md`, `docs/SOURCE_CONNECTOR_FRAMEWORK.md` |
| SB-003 | Intelligence model | Canonical opportunity model and scoring/routing docs | DONE | Codex + Scanner/Intelligence agent | SB-001 | `docs/OPPORTUNITY_MODEL.md`, `docs/SCORING_AND_ROUTING.md` |
| SB-004 | Runtime | Connector run runtime hardening (`stale/replayed`, heartbeat, idempotency/replay metadata) | IN_PROGRESS | Codex | SB-001 | `supabase/migrations/20260405193000_connector_run_runtime_hardening.sql`, runner/data-source/status updates |
| SB-005 | Runtime | Stale-run watchdog invocation path (scheduled trigger or ops endpoint/script) | NEXT | Codex | SB-004 | code + runbook update + validation checks |
| SB-006 | API truth model | Canonical `pipeline_stage` in opportunities API | IN_PROGRESS | Codex | SB-003 | `src/lib/v2/opportunity-pipeline.ts`, `src/app/api/opportunities/route.ts`, tests |
| SB-007 | Operator UX | Source-aware queue and review state clarity in dashboard surfaces | NEXT | Product/UX agent + Codex | SB-006 | UI/read-model PR slice |
| SB-008 | Reliability | Runtime/ops and validation docs | DONE | Runtime + QA agents | SB-001 | `docs/RUNTIME_AND_OPERATIONS.md`, `docs/VALIDATION_CHECKLIST.md`, `docs/PILOT_RELEASE_GATE.md`, `docs/KNOWN_ISSUES.md` |
| SB-009 | Delivery | 30-day execution plan and sequencing | DONE | Delivery (Codex) | SB-001 to SB-008 | `docs/30_DAY_EXECUTION_PLAN.md`, `docs/SPRINT_BOARD.md` |
| SB-010 | Integrations | Live-source readiness verification by tier (incident/weather, permits/property first) | NEXT | Codex | SB-002, SB-004 | run results + source health evidence |

## PR Train (Small Reviewable Slices)

| PR Slice | Scope | Target Size | Status |
| --- | --- | --- | --- |
| PR-01 | Runtime hardening migration + runner state model updates | Small | IN_PROGRESS |
| PR-02 | Opportunity pipeline-stage helper + API + tests | Small | IN_PROGRESS |
| PR-03 | Delivery docs + runtime checklist alignment | Small | NEXT |
| PR-04 | Idempotent run triggers and stale-run watchdog execution path | Medium | NEXT |
| PR-05 | Operator queue/review UX updates using canonical stage + action states | Medium | NEXT |

## Dependency Notes

- SB-005 depends on SB-004 because stale detection requires heartbeat timestamps and new run states.
- SB-007 depends on SB-006 to avoid UI-level state inference drift.
- SB-010 depends on source registry normalization (SB-002) and stable runtime tracking (SB-004).

## Daily Execution Log

### April 5, 2026

- Completed multi-agent repo audit and architecture docs.
- Added connector runtime hardening migration and code-path updates for `stale/replayed` + heartbeat/idempotency/replay metadata.
- Added canonical opportunity pipeline-stage derivation and test coverage.
- Published 30-day plan and sprint board for PR sequencing.
