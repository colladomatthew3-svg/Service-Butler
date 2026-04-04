# Overnight Release Memo - 2026-04-03

Status: archived.

Use [docs/PRODUCTION_CHECKLIST.md](/Users/matthewcollado/Downloads/Service%20Butler/docs/PRODUCTION_CHECKLIST.md) and [docs/PRODUCTION_READINESS_SUMMARY_TEMPLATE.md](/Users/matthewcollado/Downloads/Service%20Butler/docs/PRODUCTION_READINESS_SUMMARY_TEMPLATE.md) for the current production push gate and summary format.

## Recommendation

**ARCHIVED MEMO**

Reason:
- This memo is preserved for historical context only.
- The active readiness gate now lives in `docs/PRODUCTION_CHECKLIST.md`.
- The active release summary format now lives in `docs/PRODUCTION_READINESS_SUMMARY_TEMPLATE.md`.

## Morning-Ready Status Matrix

| Status | Command rule | Blocker taxonomy |
| --- | --- | --- |
| `GO` | all of `typecheck`, `build`, `check:production`, `operator-healthcheck`, `validate-integrations`, and `proof:servpro` pass | none |
| `GO FOR INTERNAL REVIEW ONLY` | `typecheck`, `build`, `check:production`, `operator-healthcheck`, and `validate-integrations` pass, but `proof:servpro` still fails on incomplete proof | `proof_gate`, `throughput_gate` |
| `NO-GO` | any of `typecheck`, `build`, `check:production`, `operator-healthcheck`, or `validate-integrations` fails | `code_gate`, `runtime_gate`, `operator_gate`, `integration_gate` |

Blocker taxonomy:
- `code_gate`: `npm run typecheck` or `npm run build`
- `runtime_gate`: `npm run check:production`
- `operator_gate`: `npm run operator-healthcheck`
- `integration_gate`: `npm run validate-integrations`
- `proof_gate`: `npm run proof:servpro`
- `throughput_gate`: scanner KPI route is unavailable, synthetic, or still fully `research_only`

## Checks Run

Passed:
- `npm run typecheck`
- `npm run build`
- `npm test -- tests/source-lanes.spec.ts tests/control-plane-readiness.spec.ts tests/control-plane-network.spec.ts tests/opportunities-view-behavior.spec.ts tests/smoke-dashboard-entry.spec.ts tests/smoke-opportunities-page.spec.ts`

Required for a true morning `GO`, but not claimed by this memo unless explicitly re-run:
- `npm run check:production`
- `npm run operator-healthcheck`
- `npm run validate-integrations`
- `npm run proof:servpro`

## Key Outcomes

- Operator trust lockdown:
  - `/dashboard` no longer relies on synthetic opportunity/lead/job data in demo mode.
  - Settings/opportunities/scanner/network remain fail-closed for buyer/operator trust.
- Scanner throughput posture:
  - Scanner burst mode is covered for live runs above the legacy 50-result ceiling.
  - The 24-hour KPI view is exposed through `/api/scanner/throughput` and mirrors the scanner command summary counters.
- Connector depth documentation:
  - NYC + Long Island connector eligibility matrix is documented and linked from the activation runbook.
  - Mold/biohazard posture is documented as classification-first sourced from real public signals.
- Tier 1 QA/proof regression:
  - Source-lane and routing coverage includes `mold_biohazard`.
  - Network smoke now asserts synthetic proof sample strings do not render on normal operator routes.

## Scanner Throughput And Verification Gate

- Burst mode:
  - Live scanner throughput coverage now includes requested limits above 50 and verifies the scanner can safely return a high-volume, deduped result set without silently truncating to the old ceiling.
  - Overnight expectation: burst mode is for signal capture only; it does not relax qualification or dispatch rules.
- 24h throughput KPI route:
  - The authoritative overnight KPI endpoint is `/api/scanner/throughput`.
  - This route reports:
    - `captured_real_signals`
    - `qualified_contactable_signals`
    - `research_only_signals`
    - `scanner_verified_leads_created`
  - These values feed the scanner command-summary metrics labeled `24h captured`, `24h verified-ready`, and `24h leads created`.
- Verification gating:
  - Scanner volume does not count as buyer-grade throughput unless a signal has verified contactability.
  - `qualified_contactable_signals` requires verified contact evidence with a real phone or email.
  - Research-only scanner rows stay blocked from lead/job creation and should remain in scanner or SDR follow-up until verification is complete.
- Morning GO / NO-GO check for real verified leads:
  - GO only if `/api/scanner/throughput` shows non-synthetic `captured_real_signals`, non-zero `qualified_contactable_signals`, and non-zero `scanner_verified_leads_created` for the last 24 hours.
  - GO only if the verified-ready rows correspond to real contact evidence, not demo/sample/synthetic records.
  - NO-GO if throughput is present but all signals remain `research_only`.
  - NO-GO if scanner capture is active but verified-ready and verified-lead counts are still zero.
  - NO-GO if the KPI route is unavailable or returns the limited-metrics warning caused by missing `scanner_events` access.

## Overnight Execution Matrix - Scanner Lead Engine

### Current scanner KPI baseline

- Current memo baseline remains `GO FOR INTERNAL REVIEW ONLY`.
- Reason:
  - this cut does not attach a fresh live-tenant `/api/scanner/throughput` snapshot
  - this cut does not claim a fresh morning proof that `qualified_contactable_signals` and `scanner_verified_leads_created` are both non-zero
- Treat the current buyer-grade baseline as unproven until the morning KPI pull confirms:
  - `captured_real_signals > 0`
  - `qualified_contactable_signals > 0`
  - `scanner_verified_leads_created > 0`
  - `research_only_signals` is not equal to all captured signals

### Required checks

- `npm run typecheck`
- `npm run build`
- `npm run operator-healthcheck`
- `npm run validate-integrations`

### Morning decision matrix

| Status | Use when |
| --- | --- |
| `GO` | All four required checks pass, `/api/scanner/throughput` shows real capture, `qualified_contactable_signals > 0`, `scanner_verified_leads_created > 0`, and the captured window is not entirely `research_only`. |
| `GO FOR INTERNAL REVIEW ONLY` | All four required checks pass, real capture exists, but the morning KPI pull still shows `qualified_contactable_signals = 0` or `scanner_verified_leads_created = 0`, or the fresh KPI snapshot is not yet attached to the morning cut. |
| `NO-GO` | Any required check fails, throughput is synthetic/sample/demo only, the KPI route is unavailable, or all captured scanner volume remains `research_only`. |

### Qualified-contactable throughput blockers and remediations

- Blocker: `captured_real_signals > 0`, but `qualified_contactable_signals = 0`.
  - Meaning: scanner is finding real pressure, but none of the rows have verified contact evidence.
  - Remediation: move the relevant scanner rows through SDR qualification, add a real phone or email, require `verification_status=verified`, then rerun the KPI pull.
- Blocker: all captured signals remain `research_only`.
  - Meaning: overnight volume is not converting into buyer-grade lead flow.
  - Remediation: do not count burst volume as proof; review the scanner queue, route candidates to SDR, and confirm at least one signal clears verification gating before morning review.
- Blocker: `qualified_contactable_signals > 0`, but `scanner_verified_leads_created = 0`.
  - Meaning: qualification is happening, but verified scanner leads are not being created or persisted downstream.
  - Remediation: confirm lead creation from qualified rows, verify the resulting lead source is `scanner_verified_contact`, and rerun the 24-hour KPI read.
- Blocker: `/api/scanner/throughput` is unavailable or returns the limited-metrics warning.
  - Meaning: the morning KPI cannot be trusted because scanner throughput data is incomplete.
  - Remediation: restore `scanner_events` access/persistence and rerun the throughput route before making any external claim.
- Blocker: captured rows are demo, sample-backed, or synthetic.
  - Meaning: overnight throughput is not valid for buyer-facing proof.
  - Remediation: disable sample-backed sources for the counted window, confirm live-safe sources only, and rerun the scanner/KPI pass.

## Current Blockers / Risks

1. Live-market verification is not included in this check set.
   - Need a fresh tenant run for live source-event -> opportunity -> qualification -> lead -> booked-job proof in the target environment before external buyer claims.
2. Worktree hygiene is still mixed outside intended product scope.
   - Unrelated/local artifacts remain under `.tmp/`, `output/proof/`, `output/live-source-snapshots/`, and `.claude/worktrees/gifted-babbage`.
3. Connector depth remains uneven by design.
   - Permits still require a real provider.
   - Incident/social coverage still depends on approved terms and real feed/Firecrawl configuration.

## Rollback Posture

If we need an immediate safety rollback:

1. `SB_USE_V2_READS=false`
2. `SB_USE_V2_WRITES=false`
3. Optional: `SB_USE_POLYGON_ROUTING=false`

Then rerun health/readiness checks before re-enabling.

## PR Slice Mapping

### Slice 1 - Operator trust cleanup
Scope:
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/network/page.tsx`
- `src/app/api/proof/capture-summary/route.ts`
- `src/lib/control-plane/data-sources.ts`
- `tests/smoke-dashboard-entry.spec.ts`
- `tests/control-plane-network.spec.ts`

### Slice 2 - Connector eligibility/docs
Scope:
- `docs/REAL_OPERATOR_ACTIVATION_RUNBOOK.md`
- `docs/NYC_LONG_ISLAND_CONNECTOR_MATRIX.md`
- `docs/NYC_LI_RESTORATION_SPRINT.md`
- `docs/OVERNIGHT_RELEASE_MEMO_2026-04-03.md`

### Slice 3 - Tier 1 QA/proof regression
Scope:
- `src/lib/v2/source-lanes.ts`
- `src/app/api/opportunities/route.ts`
- `src/components/dashboard/opportunities-view.tsx`
- `tests/source-lanes.spec.ts`
- `tests/control-plane-readiness.spec.ts`
- `tests/opportunities-view-behavior.spec.ts`
