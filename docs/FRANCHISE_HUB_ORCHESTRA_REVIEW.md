# Franchise Hub Orchestra Review (April 3, 2026)

## Scope Reviewed

- Repo: `colladomatthew3-svg/franchise-hub-orchestra`
- Focus areas:
  - data-source and ingestion model
  - Firecrawl setup and scraping/search behavior
  - UI/UX surfaces for operators
  - marketing-page structure

## Findings (highest severity first)

1. **P0 - Tenant isolation is not first-class in orchestra ingestion surfaces**
   - Evidence: ingestion functions and source tables in `supabase/functions/*` and `data_sources` schema are single-plane and do not enforce Service Butler style tenant scoping.
   - Risk: cross-tenant leakage and unsafe operator claims if transplanted directly.
   - Action taken: did not import any raw Supabase function code from orchestra; only ported patterns into Service Butler's v2 connector model.

2. **P0 - Firecrawl usage in orchestra is broad and permissive by default**
   - Evidence: `scrape-sources` and utility ingestion functions rely on open search + scrape runs without Service Butler live-safe gating.
   - Risk: uncontrolled source expansion, lower explainability, and potential compliance drift.
   - Action taken: integrated query-search support behind existing Service Butler terms/compliance/runtime controls, including explicit credential checks.

3. **P1 - Marketing claims in orchestra overstate operational maturity**
   - Evidence: page copy references automation outcomes without buyer-proof gating language.
   - Risk: trust and demo risk in real customer conversations.
   - Action taken: adapted marketing pages to Service Butler tone, with operator and readiness framing instead of unqualified claims.

4. **P1 - Orchestra UI patterns are strong but not aligned to Next.js app router**
   - Evidence: React Router + Vite page composition differs from current Service Butler architecture.
   - Risk: brittle migrations and duplicated UI systems.
   - Action taken: rebuilt the useful page structures natively in `src/app/*` with existing Service Butler components.

## Repurpose Outcome

- Reused and adapted:
  - product/solutions/pricing information architecture
  - Firecrawl query-search ingestion concept for outage-style signals
  - utility-outage source family pattern
- Intentionally not reused:
  - direct Supabase edge-function ingestion logic
  - single-plane data-source table assumptions
  - generic marketing copy that bypasses trust safeguards
