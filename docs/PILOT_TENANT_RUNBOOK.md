# Pilot Tenant Deployment Runbook

This runbook launches one pilot enterprise and two pilot franchise tenants using the existing v2 foundation.

## One-Command Path

```bash
npm run pilot:deploy
```

`pilot:deploy` executes this sequence: migrations, pilot seeding, v2 flag guidance, parity check, and pilot flow smoke.

## Prerequisites

Set these environment variables before running:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export SUPABASE_DB_URL="postgresql://..."
```

Optional:

```bash
export PILOT_MEMBER_USER_IDS="<uuid1>,<uuid2>"
export SB_USE_POLYGON_ROUTING=true
```

## Step 1 - Apply Migrations

Run:

```bash
supabase db push
```

Or via npm script:

```bash
npm run db:push
```

Verify v2 schema exists:

```bash
psql "$SUPABASE_DB_URL" -c "select table_name from information_schema.tables where table_schema='public' and table_name like 'v2_%' order by table_name;"
```

Verify RLS is active on v2 tables:

```bash
psql "$SUPABASE_DB_URL" -c "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'v2_%' order by tablename;"
```

## Step 2 - Seed Tenants

Create:
- `SERVPRO_CORP` (enterprise)
- `SERVPRO_NY_001` (franchise)
- `SERVPRO_NY_002` (franchise)

Seed:
- territories
- territory versions
- tenant memberships
- routing rules
- baseline data sources

Run:

```bash
node scripts/seed-pilot-tenants.mjs
```

## Step 3 - Enable v2 Writes

Set:

```bash
export SB_USE_V2_WRITES=true
```

Verify scanner writes v2 opportunities (with app running):

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/scanner/run"
```

Then check:

```bash
psql "$SUPABASE_DB_URL" -c "select tenant_id, count(*) from public.v2_opportunities group by tenant_id order by count desc;"
```

## Step 4 - Dual-Write Verification

Parity script:
- `scripts/v2-parity-check.ts`

Run:

```bash
npm run pilot:parity
```

Output includes:
- row counts
- legacy-to-v2 matched counts
- checksum comparisons
- pass/fail parity summary

## Step 5 - Enable v2 Reads

Set:

```bash
export SB_USE_V2_READS=true
```

Validate dashboard endpoints return v2 results:

```bash
curl "$NEXT_PUBLIC_APP_URL/api/dashboard/corporate"
curl "$NEXT_PUBLIC_APP_URL/api/dashboard/franchise"
```

## Step 6 - Pilot Routing Test

Trigger end-to-end pilot smoke:

```bash
npm run pilot-test
```

Verify:
- territory match
- assignment creation
- SLA due timestamp

Manual DB checks:

```bash
psql "$SUPABASE_DB_URL" -c "select id, assignment_reason, status, sla_due_at from public.v2_assignments order by created_at desc limit 5;"
```

## Step 7 - Outreach Test

Trigger:

```bash
curl -X POST "$NEXT_PUBLIC_APP_URL/api/leads/<LEAD_ID>/outreach" \
  -H "content-type: application/json" \
  -d '{"channel":"sms","to":"+15555550123","message":"Pilot outreach test"}'
```

Verify:
- Twilio message send recorded in `v2_outreach_events`
- HubSpot task/event recorded in `v2_outreach_events` (`crm_task` channel)

DB check:

```bash
psql "$SUPABASE_DB_URL" -c "select channel, event_type, outcome, provider_message_id, created_at from public.v2_outreach_events order by created_at desc limit 10;"
```

## Step 8 - Rollback Plan

Disable reads first:

```bash
export SB_USE_V2_READS=false
```

Disable writes second:

```bash
export SB_USE_V2_WRITES=false
```

Rollback sequence:
1. Freeze v2 reads.
2. Keep dual-write running briefly if data capture is still desired.
3. Disable v2 writes.
4. Confirm legacy endpoints and dashboards are stable.
5. Re-run parity script to capture final state.

## Pilot Command Reference

```bash
npm run pilot:deploy
npm run pilot:seed
npm run pilot:parity
npm run pilot-test
```
