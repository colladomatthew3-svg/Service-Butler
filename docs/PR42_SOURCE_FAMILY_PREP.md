# PR #42 Source Family Prep

## Recommendation
- **Next source family:** `permits` (building + restoration permit signals)
- **Why this wins now:**
  - Strong existing connector footprint (`permits`, `open311`, permit intelligence tests already in repo)
  - Low compliance ambiguity versus social/community scraping sources
  - High restoration relevance (roofing, water mitigation follow-up, fire restoration rebuild, mold remediation remediation permits)
  - Existing lane model and operator queue already recognize permit lane behavior

## Evidence Snapshot
- Existing connectors and tests indicate mature partial implementation:
  - `src/lib/v2/connectors/permits`
  - `tests/v2-permits-ingestion.spec.ts`
  - `tests/v2-permits-intelligence.spec.ts`
  - `tests/v2-free-sources-connectors.spec.ts`
- Proof and readiness logic already includes permit-oriented provenance and synthetic safety controls.

## PR #42 Scope Draft (Do Not Implement Yet)
- Activate permit-family runtime path end-to-end with the same discipline used for incidents:
  - source freshness + rollout/readiness enforcement
  - false-positive suppression for weak permit records
  - permit-specific scoring/routing adjustments
  - operator-facing provenance and next-action quality for permit opportunities
- Keep scope constrained to permit family only; no third source family in the same slice.

## Branch + Test Setup
- Planned branch: `codex/pr42-permits-family-activation`
- Required test focus:
  - stale vs fresh permit handling
  - permit dedupe and duplicate-priority suppression
  - permit actionability output shape
  - routing relevance for permit service-line/territory fit
  - safe degraded behavior when permit provider config is incomplete
