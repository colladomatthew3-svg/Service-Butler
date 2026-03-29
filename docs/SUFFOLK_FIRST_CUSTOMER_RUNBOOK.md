# Suffolk First Customer Runbook (Restoration)

This runbook is for the first live operator customer: **Suffolk Restoration Group** (Suffolk County, Long Island).

Related customer-ops artifacts:

- [Suffolk Customer Story](./SUFFOLK_CUSTOMER_STORY.md)
- [Suffolk Lead Quality Operations](./SUFFOLK_LEAD_QUALITY_OPERATIONS.md)
- [Suffolk Verified Lead Criteria](./SUFFOLK_VERIFIED_LEAD_CRITERIA.md)
- [Real Operator Activation Runbook](./REAL_OPERATOR_ACTIVATION_RUNBOOK.md)

## 1) Prereqs

- Docker Desktop running
- Local Supabase running
- `.env.local` contains:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
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

If Suffolk is already seeded, you can skip the reseed step:

```bash
SB_SUFFOLK_SKIP_SEED=true npm run suffolk:lead-proof
```

## 3.5) Weekly Lead Quality Report

Run:

```bash
npm run suffolk:quality-report
```

If the Suffolk tenant has not been seeded in the current environment, use the scaffold mode:

```bash
npm run suffolk:quality-report -- --template
```

What it does:
- ranks Suffolk sources by a simple keep/tune/pause rubric
- emits a verified-lead evidence pack
- writes artifacts under `artifacts/suffolk-quality/`
- gives RevOps a weekly QA artifact for customer review

Use this report together with:

- [Suffolk Lead Quality Operations](./SUFFOLK_LEAD_QUALITY_OPERATIONS.md)
- [Suffolk Weekly Proof of Value Template](./SUFFOLK_WEEKLY_PROOF_OF_VALUE_TEMPLATE.md)

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

1. Open with the Suffolk customer story and the week-one promise.
2. Show active Suffolk territories and routing rules.
3. Run `npm run suffolk:lead-proof`.
4. Run `npm run suffolk:quality-report`.
5. Show output lead IDs, source provenance, and ranked source actions.
6. Show opportunities, assignments, outreach events, and attribution records in DB-backed dashboard APIs.
