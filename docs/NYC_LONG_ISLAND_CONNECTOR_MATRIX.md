# NYC + Long Island Connector Eligibility Matrix

This matrix documents the current repo truth for seeded operator profiles, runtime gates, qualification throughput, and buyer-proof eligibility.

Scope:
- seeded operator profiles in [`scripts/seed-operator.ts`](../scripts/seed-operator.ts)
- runtime and capture status in [`src/lib/control-plane/data-sources.ts`](../src/lib/control-plane/data-sources.ts)
- readiness gates in [`src/lib/control-plane/readiness.ts`](../src/lib/control-plane/readiness.ts)
- buyer-proof authenticity and qualification in [`src/lib/v2/proof-authenticity.ts`](../src/lib/v2/proof-authenticity.ts) and [`src/lib/v2/opportunity-qualification.ts`](../src/lib/v2/opportunity-qualification.ts)

Terminology:
- `eligible` means the source can legitimately create real source events and scanner opportunities if it is active, sample-free, approved, healthy, and actually run.
- `live-safe partial` means the source can stay visible in settings, but it should not create trusted operator demand rows until configuration is complete.
- `needs provider` means the repo supports the source family, but the seed does not provide a real upstream source, so operator throughput is zero until a provider is added.
- `blocked` means the current posture should fail closed: visible in settings, not sold as live capture, and not used to fabricate scanner or opportunity volume.

## Trust And Throughput Rules

- No synthetic or demo records on operator routes.
- No source with `sample_records`, synthetic fallback, or simulated runtime mode can count toward operator throughput or buyer proof.
- Scanner does not invent opportunities to fill empty lanes.
- Public-signal opportunities are research-only until a verified contact path exists.
- Verified contact is required before any opportunity becomes a lead.
- Buyer proof only counts qualified, traceable, non-synthetic chains from source event to booked job.

## What Counts As Real Capture And Throughput

For a source to count as real capture in the current codebase, all of the following must be true:

1. `v2_data_sources.status = active`
2. No `sample_records` are present
3. `terms_status` and compliance are approved
4. The source is not `simulated` or `live-partial`
5. Connector health is `ok`
6. The latest connector run writes `metadata.connector_input_mode = "live_provider"` and `metadata.counts_as_real_capture = true`
7. The run writes real rows into `v2_source_events` and `v2_opportunities`

For a source to count toward throughput and buyer-proof lead and job reporting, the above is not enough. The opportunity must also become `qualified_contactable`, and any lead counted in proof must be verified and contactable.

Operational rule:

- If a source is `live-safe partial`, `needs provider`, or `blocked`, it may remain visible in settings and readiness surfaces, but it should not create trusted scanner throughput until it becomes fully live.

## Matrix

| Source family | NYC seeded posture | Long Island seeded posture | Current classification | Contactability yield expectation | Qualification path | Proof eligibility | Fail-closed behavior | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NOAA weather | Seeded with Manhattan coordinates | Seeded with Suffolk coordinates | `eligible` | Low direct contactability; strong opportunity volume. | `sdr` | Source-event and opportunity proof only by default. Lead/job proof only after verified contact. | If simulated, sample-backed, or partial, keep it out of trusted scanner throughput and buyer proof. | Free public API for storm, flood, freeze, and outage-adjacent restoration demand. |
| Open311 | Seeded against NYC 311 endpoint | Suffolk profile still points at a filtered NYC endpoint, not a true LI municipal source | NYC: `eligible`. Long Island: `blocked`. | Medium for NYC research queues; low direct contactability without SDR enrichment. | `sdr` | NYC source-event and opportunity proof yes after live run. Long Island proof no with current seed. | If endpoint is missing, off-market, partial, or sample-backed, keep blocked and do not present as LI municipal coverage. | Strongest public municipal signal source for NYC leak, flooding, plumbing, fire-adjacent, mold, IAQ, and sewage complaints. |
| USGS water | Seeded with NYC-area site codes | Seeded with Suffolk-area site codes | `eligible` | Low direct contactability; high flood-prioritization value. | `sdr` | Source-event and opportunity proof yes after live run. Lead/job proof only through verified downstream contact. | If site codes or provider response fail, mark partial or blocked and do not auto-promote to leads. | Best public flood and water-context signal. |
| OpenFEMA | Seeded with national disaster declaration endpoint | Seeded with Suffolk-filtered NY declaration endpoint | `eligible` | Low direct contactability; good catastrophe context. | `sdr` | Opportunity-context proof yes after live run. Not sufficient alone for lead/job proof. | If only macro declaration context is present, keep it as support context and not contactable demand. | Good catastrophe and surge-prioritization layer. |
| Incidents / Firecrawl public pages | Seeded active, but without `page_urls`, feed endpoint, or Firecrawl credentials | Same | `blocked` in current seeded posture | Medium opportunity yield when configured; contactability still usually SDR-mediated. | `sdr` | Proof-eligible only after real page URLs or real feed config plus live run. Lead/job proof still requires verified contact. | If `page_urls`, terms, or Firecrawl credentials are missing, fail closed as blocked and do not fabricate incident rows or scanner demand. | Legitimate for fire, smoke, flood, outage, and municipal incident pages when configured with real public pages. |
| Permits | Seeded active, but `provider_url` and `provider_token` depend on env | Same | `needs provider` | Zero trusted throughput until a real provider exists. | `sdr` | No proof tonight unless a real provider is configured and live. | If provider URL is missing or synthetic fallback is used, fail closed and keep permits out of trusted scanner throughput. | The repo does not include a free public permits provider. |
| Overpass | Seeded with Manhattan query | Seeded with Suffolk query | `eligible` | Very low direct contactability; context and targeting only. | `sdr` | Can support opportunity proof and enrichment context. Not sufficient alone for lead/job proof. | If query fails or returns generic enrichment only, keep as context and do not promote to bookable demand. | Useful for facility and property context around emergency demand. |
| Census | Seeded with NY ACS query | Same | `eligible` | Very low direct contactability; market context only. | `sdr` | Enrichment-context proof only. Not sufficient alone for lead/job proof. | If only enrichment is present, keep as context and do not create operator-facing lead-ready claims. | Useful for housing age, renter rate, vacancy, and propensity context. |
| Social / public distress | Seeded active, but without feed URL, search terms, subreddits, or Firecrawl page URLs | Same | `blocked` in current seeded posture | Medium research yield; low direct contactability unless the post exposes a real usable path. | `sdr` | Proof-eligible only after approved terms plus real Reddit or public-page config. Lead/job proof requires verified contact. | If feed/search/page config is missing, fail closed as blocked and do not invent posts, contacts, or scanner demand. | Useful as supplemental signal discovery, not the primary proof story tonight. |

## NYC vs Long Island Summary

Current honest posture for seeded operator profiles:

- NYC:
  - Legitimately closest to trusted scanner throughput tonight: NOAA, Open311, USGS, OpenFEMA
  - Overpass and Census remain supportive context, not primary throughput drivers
  - Not buyer-proof ready without added config: incidents/Firecrawl, social/distress
  - Not live without external provider: permits
- Long Island:
  - Legitimately closest to trusted scanner throughput tonight: NOAA, USGS, OpenFEMA
  - Overpass and Census remain supportive context, not primary throughput drivers
  - Do not pitch current Open311 seed as Long Island municipal coverage
  - Not buyer-proof ready without added config: incidents/Firecrawl, social/distress
  - Not live without external provider: permits

## Mold / Biohazard Sourcing Reality

Current repo reality:

- There is no dedicated free public mold, biohazard, sewage-cleanup, or asbestos-contact provider wired into Service Butler.
- The strongest free public mold or biohazard signal path in NYC is Open311 complaint data, especially complaint families such as:
  - `Mold`
  - `Indoor Air Quality`
  - `PLUMBING`
  - sewage-odor or sewage-backup style complaints
- The strongest free public mold or biohazard signal path outside NYC is public-page ingestion:
  - incident pages scraped with Firecrawl
  - public distress posts mentioning `mold`, `sewer backup`, `smoke damage`, or similar remediation signals
- Overpass and Census help target buildings and markets, but they do not provide live incident confirmation.
- Permits can support remediation or abatement intelligence only if a real provider exposes that permit data. The repo does not include a free abatement permit provider.

What not to claim:

- Do not claim direct homeowner mold/biohazard lead capture from free sources.
- Do not claim Long Island 311 mold/biohazard coverage from the current seed.
- Do not claim a live mold/biohazard source if it is powered by `sample_records`, placeholder review copy, or an unconfigured Firecrawl source.

What is defensible:

- Public mold, smoke, sewage, and indoor-air-quality signals can create real source events and opportunities.
- Those opportunities still require SDR qualification or a curated network/prospect path before they become verified contactable leads.

## Throughput Recommendation

If the goal is verified-lead throughput, rank connector families in this order:

1. Open311 in NYC:
   strongest public complaint-to-SDR queue source for restoration demand.
2. NOAA + USGS:
   strongest emergency prioritization and flood amplification layer.
3. Incident pages via Firecrawl:
   strongest free-form fire, smoke, outage, and municipal incident depth once real pages are configured.
4. OpenFEMA:
   strong catastrophe context and surge prioritization, but weak direct contactability.
5. Overpass + Census:
   supporting context only; do not anchor throughput claims on them.
6. Permits:
   treat as inactive for throughput until a real provider exists.

Operational truth:

- Source-event throughput is not lead throughput.
- Opportunity throughput is not verified-lead throughput.
- Scanner throughput is trusted only when it comes from live, non-synthetic source events.
- Verified-lead throughput requires SDR or another explicit verified-contact path for every public-source opportunity.

## Operational Recommendation

If the goal is the fastest honest buyer-proof path:

1. NYC first:
   use NOAA + Open311 + USGS + OpenFEMA as the primary live-provider stack.
2. Add Firecrawl only for approved public incident pages:
   use it to deepen fire, smoke, flood, outage, and mold-adjacent incident coverage where no structured API exists.
3. Treat permits as optional and provider-dependent:
   do not anchor the buyer story on permits unless a real provider is already available.
4. Treat social/distress as supplemental:
   useful for signal discovery, but not the main proof story until real Reddit or public-page config is in place.
