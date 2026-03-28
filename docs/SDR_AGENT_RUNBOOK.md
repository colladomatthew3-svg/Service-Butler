# SDR Agent Runbook

This runbook executes the Service Butler SDR agent to find, verify, and create leads from live v2 opportunities.

## What the SDR agent does

1. Runs active connectors (optional).
2. Pulls v2 opportunities for the tenant.
3. Verifies each candidate for:
   - compliance approval
   - score thresholds (job likelihood, urgency, source reliability)
   - location completeness
   - signal quality/freshness
4. Creates `v2_leads` for qualified opportunities.
5. Optionally routes opportunities and sends outreach.
6. Writes an audit log of the run.

## Required environment

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

export SB_USE_V2_WRITES=true
export SB_USE_V2_READS=true
```

Optional targeting:

```bash
export OPERATOR_TENANT_ID="<tenant-uuid>"
# or, if ID is not set:
export OPERATOR_TENANT_NAME="NY Restoration Group"
```

## Run command

```bash
npm run sdr-agent
```

## Safety defaults

- Connector execution: enabled
- Auto routing: enabled
- Auto outreach: disabled
- Enrichment: enabled
- Legacy dual-write: enabled when a legacy account mapping exists

## Key toggles

```bash
export SB_SDR_DRY_RUN=true
export SB_SDR_AUTO_OUTREACH=true
export SB_SDR_RUN_CONNECTORS=true
export SB_SDR_AUTO_ROUTE=true
export SB_SDR_DISABLE_ENRICHMENT=false
export SB_SDR_DISABLE_LEGACY_DUAL_WRITE=false
```

Threshold tuning:

```bash
export SB_SDR_MIN_JOB_LIKELIHOOD=62
export SB_SDR_MIN_URGENCY=58
export SB_SDR_MIN_SOURCE_RELIABILITY=54
export SB_SDR_MIN_VERIFY_SCORE=64
export SB_SDR_MAX_LEADS=40
```

## API trigger (authenticated app user)

`POST /api/agents/sdr/run`

Example body:

```json
{
  "dryRun": true,
  "runConnectors": true,
  "autoRoute": true,
  "autoOutreach": false,
  "maxLeadsToCreate": 25
}
```

