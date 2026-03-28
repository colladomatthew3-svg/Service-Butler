# Suffolk First Customer Runbook (Restoration)

This runbook is for the first live operator customer: **Suffolk Restoration Group** (Suffolk County, Long Island).

## 1) Prereqs

- Docker Desktop running
- Local Supabase running
- `.env.local` contains:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Feature flags for v2:
  - `SB_USE_V2_WRITES=true`
  - `SB_USE_V2_READS=true`

## 2) Migrate + Seed

```bash
npm run db:start
npm run db:push
OPERATOR_PROFILE=suffolk_restoration npm run operator:seed
```

Expected:
- tenant `Suffolk Restoration Group` created
- Suffolk territories, routing rules, sequences, and sources seeded

## 3) Live Lead Proof (Suffolk)

Run:

```bash
npm run suffolk:lead-proof
```

What it does:
- reseeds Suffolk operator profile
- runs live provider pulls using:
  - FEMA Suffolk County declarations
  - USGS Suffolk-area water signals (optional/non-blocking if provider format does not map cleanly)
- processes full pipeline:
  - connector run
  - opportunity creation/scoring
  - territory match/assignment
  - outreach path (safe disabled mode)
  - webhook booked-job simulation path
- prints lead IDs + source provenance

## 4) Health + Integration Checks

```bash
OPERATOR_TENANT_NAME="Suffolk Restoration Group" npm run operator-healthcheck
SB_DISABLE_TWILIO=true SB_DISABLE_HUBSPOT=true npm run validate-integrations
```

For production outbound, replace disabled flags with live credentials:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `HUBSPOT_ACCESS_TOKEN`

## 5) Go/No-Go Checklist

- `operator-healthcheck` has no FAIL rows
- `suffolk:lead-proof` prints `Live leads generated: N` with `N > 0`
- source provenance is visible on generated leads
- routing + assignment records exist for generated opportunities
- booked-job webhook path updates attribution records

## 6) Demo Script for Customer Call

1. Show active Suffolk territories and routing rules.
2. Run `npm run suffolk:lead-proof`.
3. Show output lead IDs and source provenance.
4. Show opportunities, assignments, outreach events, and attribution records in DB-backed dashboard APIs.
