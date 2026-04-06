# Service Butler Source Registry

This registry documents the real source families currently present in the repo, plus the near-term source roadmap that fits the existing stack.

## Evidence Base

The current source system is spread across:

- `src/lib/v2/connectors/registry.ts`
- `src/lib/v2/connectors/*.ts`
- `src/lib/v2/connectors/runner.ts`
- `src/lib/v2/data-sources.ts`
- `src/lib/control-plane/catalog.ts`
- `src/lib/control-plane/readiness.ts`
- `src/app/api/data-sources/*`
- `src/app/api/connectors/runs/route.ts`
- `src/app/api/webhooks/connectors/completed/route.ts`
- `src/app/api/scanner/run/route.ts`
- `supabase/migrations/20260314103000_franchise_v2_foundation.sql`
- `tests/v2-free-sources-connectors.spec.ts`
- `tests/control-plane-readiness.spec.ts`
- `tests/v2-firecrawl-incident-operator-flow.spec.ts`

## Status Legend

- `implemented/live` means the connector is real and can hit a live upstream when configured correctly.
- `implemented/partial` means the connector exists, but default config is blocked, provider-dependent, or only partially live.
- `enrichment-only` means the source is intended to improve scoring or routing, not to stand alone as direct lead evidence.
- `internal/derived` means the data is created by Service Butler itself, not pulled from an external source.
- `roadmap` means the source family is not yet in the registry but is the right next source class.

## Current Registry

| Source family | Connector key | Current repo status | Ingestion pattern | Freshness and confidence | Geography | Normalization and dedupe | Enrichment dependencies and routing implications | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NOAA weather alerts | `weather.noaa` | `implemented/live` | Poll NOAA active alerts by point query. See `src/lib/v2/connectors/weather/index.ts`. | Freshness from alert `sent`; confidence defaults to about `86`. | Point-based by lat/lon, with city/state/zip passed through from config. | Dedupe key is alert id plus timestamp. Normalizes to `weather_hail_alert`, `weather_wind_alert`, `weather_freeze_alert`, `weather_flood_alert`, or `weather_storm_alert`. | Routes to restoration, roofing, plumbing, and HVAC lanes. Strongest for storm response and emergency dispatch. No direct contactability on its own. | Missing coordinates returns no rows and healthcheck fails. Fetch failures return empty results. Default policy is approved in code. |
| Building permits | `permits.production` | `implemented/partial` | Provider pull through `resolvePermitsProvider()`. Uses remote provider when `provider_url` exists, otherwise static sample fallback. See `src/lib/v2/connectors/permits/index.ts` and `src/lib/v2/connectors/permits/providers.ts`. | Freshness from permit issue/occurred time; confidence defaults to about `74`. | Address, city, state, postal code, and optional lat/lon from permit record. | Dedupe key is id or permit number plus timestamp. Normalizes permit category and demand timing. | Supports contact-name/phone/email enrichment when records expose them. Routes to roofing, plumbing, HVAC, electrical, and restoration follow-up. | Without a provider URL it stays static/sample-backed. Healthcheck fails on static fallback, and terms approval is required before live ingestion. |
| Public distress signals | `social.intent.public` | `implemented/partial` | Reddit search JSON, Firecrawl-backed page scraping, or sample fallback. See `src/lib/v2/connectors/social/index.ts`. | Freshness from `published_at` or `created_at`; confidence defaults to about `58` for Reddit and `70` for Google-review style records. | City/state/postal can come from record or source config. | Dedupe key is platform, record id, and timestamp. Distress classification is keyword-based. | Supports author/contact enrichment when present. Routes to social, restoration, plumbing, HVAC, and fire/mold-related queues, but should stay SDR-first. | Missing terms approval blocks ingestion. Missing Firecrawl credentials blocks page scraping. With no live feed/page config, the source stays effectively blocked or sample-backed. |
| Public incident feeds | `incidents.generic` | `implemented/partial` | Structured feed pull or Firecrawl page scraping. See `src/lib/v2/connectors/incidents/index.ts`. | Freshness from `occurred_at`, `created_at`, or Firecrawl publish time; confidence defaults to about `66`. | City/state/postal and optional lat/lon from the incident record or scraped page. | Dedupe key is provider, record id, and timestamp. Classifies fire, water, infrastructure, and emergency-response incidents. | Routes to restoration, plumbing, electrical, and commercial queues. Firecrawl page provenance is the critical audit field. | Sample records keep the source simulated. Firecrawl page scraping fails closed when credentials or page URLs are missing. Citizen-like feeds are compliance-gated by default. |
| USGS water indicators | `water.usgs` | `implemented/live` | Poll USGS endpoint or use site codes. See `src/lib/v2/connectors/usgs-water/index.ts`. | Freshness from `observed_at`; confidence defaults to about `82`. | Site code plus optional lat/lon and site metadata. | Dedupe key is site code, timestamp, and water category. Maps to flood or high-water indicators. | Primary flood-prioritization source. Strong enrichment for restoration, but not direct lead contactability. | Empty config returns no rows. Sample-backed config is treated as simulated in health checks. |
| Open311 service requests | `open311.generic` | `implemented/live` | Poll municipal Open311 endpoint or the default NYC public endpoint. See `src/lib/v2/connectors/open311/index.ts`. | Freshness from request/update timestamps; confidence defaults to about `69`. | Address, borough/city, state, postal code, and optional lat/lon. | Dedupe key is service request id plus timestamp. Classifies water, fire, sewer, drainage, and outage-style complaints. | Useful for municipal restoration demand and mold/biohazard-adjacent classification. Can also expose contact fields for SDR enrichment. | Sample-backed input is simulated. Missing endpoint falls back to empty results. |
| OpenFEMA disaster declarations | `disaster.openfema` | `implemented/live` | Poll the FEMA open API. See `src/lib/v2/connectors/openfema/index.ts`. | Freshness from declaration date; confidence defaults to about `80`. | County/state context, optional lat/lon. | Dedupe key is disaster number or id plus timestamp. | Strong catastrophe context for territory planning and flood/restoration prioritization. Not contactable by itself. | Sample-backed input is simulated. Missing endpoint returns empty results. |
| Census market enrichment | `enrichment.census` | `implemented/enrichment-only` | Poll Census API. See `src/lib/v2/connectors/census/index.ts`. | Freshness is slow-moving market data, not event data; confidence defaults to about `72`. | County/state enrichment, often with census geoid / GEO_ID. | Dedupe key is geoid plus timestamp. | Feeds territory scoring and market-risk enrichment. Does not create stand-alone lead claims. | Always blocked for outbound in connector policy. Sample-backed input is simulated. |
| OpenStreetMap Overpass | `property.overpass` | `implemented/enrichment-only` | Poll Overpass API with a POST query. See `src/lib/v2/connectors/overpass/index.ts`. | Freshness from updated time or run time; confidence defaults to about `68`. | Point-based geometry plus address tags. | Dedupe key is element type, id, and name. | Useful for commercial-property and facility context. Should drive territory and facility targeting, not direct lead claims. | Query-less configs return no rows. Sample-backed input is simulated. |
| Utility outage signals | `utility.outages` | `implemented/partial` | Firecrawl search or sample fallback. See `src/lib/v2/connectors/utility/index.ts`. | Freshness from observed/created timestamps; confidence defaults to about `64`. | City/state/postal and broader region. | Dedupe key is source name, record id, and provenance. | Supports outage, electrical, and restoration routing. Should be treated as urgent but noisy. | Healthcheck fails when Firecrawl is requested without credentials. Search-less config falls back to empty or sample rows. |
| Scanner-generated internal feed | `scanner_signal` | `internal/derived` | Created by `src/app/api/scanner/run/route.ts` and backfilled into `scanner_events`, `source_events`, `v2_source_events`, and `v2_opportunities`. | Freshness is scanner-run time. Confidence is driven by scanner scoring and proof authenticity. | Whatever geography the scanner run used. | Dedupe is scanner-opportunity id plus timestamp, with synthetic rows filtered out by `src/lib/services/scanner-truth.ts`. | This is the bridge between the legacy scanner and the v2 lead engine. It should route to SDR or lead creation only after verified contact. | If persistence tables are missing, the live scan still returns a response and surfaces warnings instead of silently failing. |

## What The Registry Means In Practice

- `v2_data_sources.runtimeMode` is the first honest gate: `fully-live`, `live-partial`, or `simulated`.
- `v2_data_sources.captureStatus` is stricter: `capturing_live`, `live_safe_partial`, `blocked`, or `simulated`.
- `sample_records` is useful for review, but it must never count as buyer-proof capture.
- `terms_status` and `compliance_status` are hard gates, not cosmetic labels.
- `source_events` and `v2_source_events` are the audit trail; `v2_opportunities` is the operator queue.

## Near-Term Roadmap Tiers

These are the next source classes that fit the current product direction. They are not all implemented yet, but they are the right expansion order.

| Tier | Source families | Why it matters | Expected quality | False-positive expectation | Compliance posture | Best ingestion pattern | Recommended routing weight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tier 1 | Incident / storm / weather / emergency signals; property records; permits | These are the highest-value near-term signals for immediate restoration and home-service demand. | Highest signal density and strongest urgency. | Low to medium, depending on source specificity. | Usually public-data friendly, but some pages and permit providers need approval or legal review. | Polling first, then structured feeds, then page scraping when no API exists. | Highest |
| Tier 1 | Open municipal complaints and 311-style requests | Strong public complaint-to-dispatch signal for leak, sewer, mold, odor, fire, and infrastructure issues. | High when the endpoint is municipal and structured. | Medium. Complaint language is noisy but actionable. | Usually public, but privacy and local policy still matter. | Polling structured JSON. | Highest |
| Tier 2 | Job postings and hiring signals | Great for detecting service expansion, local demand, and facility activity. | Medium. Strong when tied to local employers and service-role hiring. | Medium to high. Many postings are generic or stale. | Public, but scraping and terms should be checked carefully. | Polling feeds, search, or scraper-based acquisition. | Medium |
| Tier 2 | Public community and forum signals | Can expose distress faster than formal data sources. | Medium. Best for emergency complaints and local chatter. | High. Forum posts are often anecdotal or duplicated. | Terms and content policy matter a lot here. | Feed pull, search, or Firecrawl-style page capture. | Medium |
| Tier 3 | Marketplace, directory, and review / complaint signals | Helpful for demand discovery, reputation issues, and service gaps. | Medium to low. Often useful only after enrichment. | High. Many records do not represent active jobs. | Usually public but governed by terms and platform rules. | Search plus scrape, with aggressive dedupe. | Low to medium |
| Tier 3 | Civic/news/local-business demand indicators | Good for slower-moving market context and territory planning. | Low to medium. Often support context more than immediate revenue. | Medium. News and civic data can be broad. | Generally public, but attribution matters. | Polling feeds and structured news APIs where available. | Low |

## Recommended Tier Weights

These weights are a planning heuristic, not a hard scoring rule.

- Tier 1: `0.35` to `0.45`
- Tier 2: `0.15` to `0.25`
- Tier 3: `0.05` to `0.15`

The actual opportunity score should still come from source reliability, freshness, geography precision, service-line fit, and signal agreement. The source tier only sets the default trust posture.

## What Not To Claim

- Do not claim a source is buyer-proof just because it is in the registry.
- Do not treat enrichment-only sources as direct lead generators.
- Do not count sample-backed or simulated rows in operator throughput.
- Do not treat public distress content as contactable until a verified-contact path exists.

