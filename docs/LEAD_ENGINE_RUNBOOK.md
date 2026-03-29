# Service Butler Lead Engine Runbook

This runbook is for generating **verified leads** (not just raw opportunities) for a local operator account.

## 1) Required Environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SB_USE_V2_WRITES=true`
- `SB_USE_V2_READS=true`
- `OPERATOR_TENANT_NAME` (or `OPERATOR_TENANT_ID`)

Recommended for live sourcing:
- `PERMITS_PROVIDER_URL`
- `OPEN311_ENDPOINT`
- `OPENFEMA_API_URL`
- `USGS_WATER_ENDPOINT` or `USGS_SITE_CODES`
- `OVERPASS_ENDPOINT` + `OVERPASS_QUERY`

## 2) Generate Leads

Run end-to-end:

```bash
npm run lead-engine
```

What this does:
- runs operator ingestion flow (`operator-test`)
- runs SDR qualification (`sdr-agent`)
- exports verified leads CSV (`verified-leads:export`)

## 3) Verification Rules Used

A lead is marked `verified` only when:
- contact compliance is approved
- at least one usable contact channel exists (phone or email)
- contact does not look like placeholder data (`555`, `example.com`, etc.)
- contact is not a duplicate against existing leads
- verification score is above threshold

Leads that have partial contact quality are marked `review` and can be worked manually.
Leads that fail checks are rejected and not created.

## 4) Output

CSV output is written to:

`artifacts/verified-leads/verified-leads-<timestamp>.csv`

Each row includes:
- lead contact channels
- source provenance
- opportunity/service-line context
- verification status + score + reasons

## 5) Tuning (Optional)

Use existing SDR env vars to tighten or loosen qualification:
- `SB_SDR_MIN_JOB_LIKELIHOOD`
- `SB_SDR_MIN_URGENCY`
- `SB_SDR_MIN_SOURCE_RELIABILITY`
- `SB_SDR_MIN_VERIFY_SCORE`
- `SB_SDR_MAX_LEADS`

For Suffolk weekly QA and source ranking, also run:

```bash
npm run suffolk:quality-report
```

If Suffolk has not been seeded in the current environment, use:

```bash
npm run suffolk:quality-report -- --template
```
