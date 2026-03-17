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

# Feature flags (required for v2 live path)
export SB_USE_V2_WRITES=true
export SB_USE_V2_READS=true
# Optional: polygon routing path
export SB_USE_POLYGON_ROUTING=true

# Webhook auth (recommended required for production)
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
- Inngest config
- Twilio/HubSpot configured or explicitly disabled

## 4) Configure connector sources for live ingestion

Minimum required for permits live path:

```bash
export PERMITS_PROVIDER_URL="https://<permits-provider-endpoint>"
export PERMITS_PROVIDER_TOKEN="<permits-provider-token>"
export PERMITS_TERMS_STATUS="approved"
```

If provider endpoint is not available, operator test remains runnable in simulated connector mode while still writing real DB records.

Recommended source config for the high-value intelligence categories:

- Weather damage intelligence:
  - `source_type=weather`
  - connector key: `weather.noaa`
  - include `latitude`, `longitude`, optional `city/state/postal_code`
- Building permits:
  - `source_type=permits`
  - connector key: `permits.production`
  - set `terms_status=approved` before live ingestion
- Public incidents:
  - `source_type=incident`
  - connector key: `incidents.generic`
  - keep Citizen-like feeds disabled by default unless explicitly approved:
    - `SB_ENABLE_CITIZEN_CONNECTOR=false` (default)
- Consumer distress (Reddit + Google reviews normalized path):
  - `source_type=social`
  - connector key: `social.intent.placeholder`
  - set `terms_status=approved` before live ingestion

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
```
