# Real Operator Activation Runbook

This runbook activates Service Butler v2 for a real standalone operator deployment (no enterprise parent required).

Target operator example: **NY Restoration Group**

## 0) Required environment variables

Set these before activation:

```bash
# Supabase (required)
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export SUPABASE_DB_URL="postgresql://..."
export NEXT_PUBLIC_APP_URL="https://<your-app-origin>"

# Feature flags (required for v2 live path)
export SB_USE_V2_WRITES=true
export SB_USE_V2_READS=true
# Optional: polygon routing path
export SB_USE_POLYGON_ROUTING=true

# Webhook auth (required)
export WEBHOOK_SHARED_SECRET="<strong-shared-secret>"

# Inngest (required for workflow-backed operations)
export INNGEST_EVENT_KEY="<inngest-event-key>"
export INNGEST_SIGNING_KEY="<inngest-signing-key>"

# Twilio (required unless explicitly disabled)
# If disabled, set SB_DISABLE_TWILIO=true
export TWILIO_ACCOUNT_SID="<sid>"
export TWILIO_AUTH_TOKEN="<token>"
export TWILIO_PHONE_NUMBER="+1..."

# HubSpot (required unless explicitly disabled)
# If disabled, set SB_DISABLE_HUBSPOT=true
export HUBSPOT_ACCESS_TOKEN="<token>"

# Safety toggles for pilot validation (recommended defaults)
export SB_TWILIO_SAFE_MODE=true
export SB_HUBSPOT_SAFE_MODE=true

# Optional explicit disables
# export SB_DISABLE_TWILIO=true
# export SB_DISABLE_HUBSPOT=true
```

## 1) Apply Supabase migrations

```bash
npm run db:push
```

Optional verification:

```bash
psql "$SUPABASE_DB_URL" -c "select to_regclass('public.v2_tenants') as v2_tenants, to_regclass('public.v2_opportunities') as v2_opportunities, to_regclass('public.v2_assignments') as v2_assignments;"
psql "$SUPABASE_DB_URL" -c "select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname like 'v2_%' order by relname;"
```

## 2) Seed operator baseline

```bash
npm run operator:seed
```

Expected seed output includes:
- `Operator seed complete.`
- `account_id=...`
- `tenant_id=...`

This seed sets up:
- standalone operator tenant
- territories + territory versions
- routing rules
- outreach sequences
- baseline data sources
- tenant membership map

## 3) Run preflight health check

```bash
npm run operator-healthcheck
```

Healthcheck must report pass for:
- Supabase connectivity
- required v2 tables
- v2 feature flags loaded
- operator tenant and territory records
- active data source config
- webhook secret configured
- Inngest config
- Twilio/HubSpot configured or explicitly disabled

## 4) Configure connector sources for live ingestion

Before changing source settings, read the current source-depth and buyer-proof posture here:

- [NYC + Long Island Connector Eligibility Matrix](./NYC_LONG_ISLAND_CONNECTOR_MATRIX.md)

Current seeded operator truth:

- NYC is strongest on free public data through NOAA, Open311, USGS, OpenFEMA, Overpass, and Census.
- Long Island is strongest on NOAA, USGS, OpenFEMA, Overpass, and Census.
- Long Island Open311 is not legitimately covered by the current seed and should not be sold as Long Island municipal coverage.
- Public incidents and social/distress are supported in code, but the seed does not configure real Firecrawl page URLs, feeds, or Reddit search terms.
- Permits require a real provider and are not live just because the source row exists.
- Mold and biohazard sourcing is currently indirect: strongest through NYC Open311 plus approved public incident pages, not a dedicated homeowner-contact provider.

### Tier 1 / Tier 2 Operator Matrix

| Tier | Source families | Operator role | Qualification path | Buyer-proof posture | Fail-closed rule |
| --- | --- | --- | --- | --- | --- |
| Tier 1 | NOAA weather, NYC Open311, USGS water, OpenFEMA, approved public incidents via Firecrawl or feed | Primary restoration signal intake for flood, fire, outage, weather, and municipal demand | `sdr` by default for public-signal opportunities | Source events and opportunities can count only when live, approved, sample-free, and healthy. Lead and job proof still requires verified contact. | If runtime mode is simulated, partial, blocked, missing terms, or missing Firecrawl page config, keep the source blocked or research-only and do not count it in operator throughput or buyer proof. |
| Tier 2 | Overpass, Census, social or public distress, permits | Supplemental context, enrichment, or provider-dependent signal depth | `sdr` | Context and enrichment may support scoring and prioritization. They do not become buyer-proof lead volume without verified contact, and permits are not live until a real provider exists. | If the source is enrichment-only, provider-missing, or unconfigured, do not present it as lead-ready or live-capturing on operator routes. |

### Fail-Closed Operator Semantics

- No synthetic or demo rows on operator routes in live mode.
- No public-signal opportunity becomes a lead until verified phone or email plus qualification provenance exists.
- Sources missing terms approval, provider config, page URLs, or required credentials must remain visibly blocked or partial.
- Simulated script records can be useful for local validation, but they are never eligible for buyer proof and must not be used to claim pilot readiness.

### Mold / Biohazard Classification-First Truth

- Mold and biohazard are classifications, not dedicated connector families with their own free public homeowner-contact source.
- The strongest real public classification paths are:
  - NYC Open311 complaints such as mold, indoor air quality, plumbing, sewage, flooding, and related municipal categories
  - approved public incident pages or public distress pages mentioning mold, sewage backup, smoke damage, or similar remediation conditions
  - provider-backed permits only if a real permit source exposes those records
- Do not claim direct mold or biohazard homeowner lead capture from free public data alone.

Minimum required for permits live path:

```bash
export PERMITS_PROVIDER_URL="https://<permits-provider-endpoint>"
export PERMITS_PROVIDER_TOKEN="<permits-provider-token>"
export PERMITS_TERMS_STATUS="approved"
export USGS_SITE_CODES="01358000,01371500"
# Optional override (otherwise defaults to public endpoint)
export USGS_WATER_ENDPOINT=""

# Optional Open311 endpoint override (defaults to NYC 311 endpoint)
export OPEN311_ENDPOINT=""

# Optional OpenFEMA endpoint override
export OPENFEMA_API_URL=""

# Optional Census endpoint override (defaults to ACS county query for NY state code 36)
export CENSUS_API_ENDPOINT=""
export CENSUS_API_STATE="36"
export CENSUS_API_KEY=""

# Optional Overpass endpoint/query override (seed provides a default Manhattan-area query)
export OVERPASS_ENDPOINT="https://overpass-api.de/api/interpreter"
export OVERPASS_QUERY=""
```

If provider endpoint is not available, operator test remains runnable in simulated connector mode for local validation, but those simulated rows do not count as live capture, operator throughput, or buyer-proof evidence.

Recommended source config for the high-value intelligence categories:

- Weather damage intelligence:
  - `source_type=weather`
  - connector key: `weather.noaa`
  - include `latitude`, `longitude`, optional `city/state/postal_code`
- USGS water intelligence:
  - `source_type=usgs_water`
  - connector key: `water.usgs`
  - include `site_codes` or explicit `endpoint`
- Building permits:
  - `source_type=permits`
  - connector key: `permits.production`
  - set `terms_status=approved` before live ingestion
- Open311 service requests:
  - `source_type=open311`
  - connector key: `open311.generic`
  - include `endpoint` for your municipal feed
- Public incidents:
  - `source_type=incident`
  - connector key: `incidents.generic`
  - keep Citizen-like feeds disabled by default unless explicitly approved:
    - `SB_ENABLE_CITIZEN_CONNECTOR=false` (default)
- OpenFEMA catastrophe context:
  - `source_type=openfema`
  - connector key: `disaster.openfema`
- Consumer distress (Reddit + Google reviews normalized path):
  - `source_type=social`
  - connector key: `social.intent.public`
  - set `terms_status=approved` before live ingestion
- Census enrichment:
  - `source_type=census`
  - connector key: `enrichment.census`
  - use for propensity/risk enrichment signals
- OpenStreetMap Overpass:
  - `source_type=overpass`
  - connector key: `property.overpass`
  - include Overpass query for target geography/asset types

Source event compliance guardrail:
- If connector `compliancePolicy()` denies ingestion, events are logged but no opportunities are created.
- Each source event is expected to carry normalized metadata for:
  - provenance (`source_provenance`)
  - terms/compliance status (`terms_status`, `compliance_status`)
  - freshness/reliability (`data_freshness_score`, `source_reliability_score`)
  - connector build (`connector_version`)
  - signal metadata (`event_category`, `service_line_candidates`, `severity_hint`, `urgency_hint`)

## 5) Validate outbound integrations in safe mode

```bash
npm run validate-integrations
```

Default behavior is safe:
- no unsafe live outbound traffic by default
- records integration outcomes in `v2_outreach_events`
- returns clear provider pass/warn/fail output

## 6) Execute real operator pilot flow

```bash
npm run operator-test
```

Expected steps:
- connector run
- opportunity created
- opportunity scored
- territory matched
- assignment created
- outreach sent
- webhook booked job received
- dashboard updated

## 7) Validate live data path

```bash
psql "$SUPABASE_DB_URL" -c "select id,status,records_seen,records_created,metadata from public.v2_connector_runs order by started_at desc limit 5;"
psql "$SUPABASE_DB_URL" -c "select id,opportunity_type,routing_status,lifecycle_status,created_at from public.v2_opportunities order by created_at desc limit 10;"
psql "$SUPABASE_DB_URL" -c "select id,status,assignment_reason,sla_due_at,metadata from public.v2_assignments order by created_at desc limit 10;"
psql "$SUPABASE_DB_URL" -c "select channel,event_type,outcome,provider_message_id,created_at from public.v2_outreach_events order by created_at desc limit 20;"
psql "$SUPABASE_DB_URL" -c "select job_id,primary_opportunity_id,source_event_id,attribution_confidence,locked,updated_at from public.v2_job_attributions order by updated_at desc limit 10;"
```

## 8) Rollback sequence

If pilot must be halted quickly:

```bash
# 1) Disable v2 reads first
export SB_USE_V2_READS=false

# 2) Disable v2 writes second
export SB_USE_V2_WRITES=false

# 3) Optional: disable polygon routing
export SB_USE_POLYGON_ROUTING=false
```

Then re-run health checks and confirm compatibility mode responses on v2 endpoints.

## 9) Operator activation command sequence (copy/paste)

```bash
npm run db:push
npm run operator:seed
npm run operator-healthcheck
npm run validate-integrations
npm run operator-test
npm run proof:servpro
```

The proof bundle will land under `output/proof/<timestamp>/` with markdown and JSON summaries you can hand to a buyer or use in a demo review.
