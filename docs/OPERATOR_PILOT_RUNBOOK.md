# Operator Pilot Runbook

This runbook boots Service Butler v2 for an independent operator deployment (no corporate parent required).

Target example: **NY Restoration Group**

## Prerequisites

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
export SUPABASE_DB_URL="postgresql://..."
export SB_USE_V2_WRITES=true
export SB_USE_V2_READS=true
# Optional
export SB_USE_POLYGON_ROUTING=true
```

## 1. Apply DB migrations

```bash
npm run db:push
```

## 2. Seed operator tenant

```bash
npm run operator:seed
```

This seeds:
- operator account (`NY Restoration Group`)
- standalone operator tenant (no `parent_tenant_id` required)
- tenant/account compatibility map (`enterprise_tenant_id == franchise_tenant_id`)
- multiple territories
- routing rules
- default outreach sequences
- production-ready baseline data sources

## 3. Verify flags are enabled

```bash
echo "$SB_USE_V2_WRITES"
echo "$SB_USE_V2_READS"
```

Expected:
- `true`
- `true`

## 4. Optional polygon routing toggle

```bash
export SB_USE_POLYGON_ROUTING=true
```

When enabled, routing uses polygon lookup first and zip fallback second.

## 5. Run end-to-end operator flow

```bash
npm run operator-test
```

Expected output lines:
- connector run
- opportunity created
- opportunity scored
- territory matched
- assignment created
- outreach sent
- webhook booked job received
- dashboard updated

## 6. Operational checks

```bash
psql "$SUPABASE_DB_URL" -c "select id, status, records_seen, records_created from public.v2_connector_runs order by started_at desc limit 5;"
psql "$SUPABASE_DB_URL" -c "select id, routing_status, lifecycle_status from public.v2_opportunities order by created_at desc limit 5;"
psql "$SUPABASE_DB_URL" -c "select id, status, assignment_reason, sla_due_at from public.v2_assignments order by created_at desc limit 5;"
psql "$SUPABASE_DB_URL" -c "select channel, event_type, outcome, created_at from public.v2_outreach_events order by created_at desc limit 10;"
psql "$SUPABASE_DB_URL" -c "select id, primary_opportunity_id, attribution_confidence from public.v2_job_attributions order by created_at desc limit 5;"
```

## Rollback

```bash
export SB_USE_V2_READS=false
export SB_USE_V2_WRITES=false
```

Rollback order:
1. Disable reads.
2. Disable writes.
3. Confirm legacy flows are healthy.
