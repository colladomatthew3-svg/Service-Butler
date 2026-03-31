-- =============================================================================
-- Franchise Vertical Support + Outreach Queue
-- =============================================================================
-- Adds:
--   1. v2_outreach_queue   — pending-review outreach items (safe mode)
--   2. Index on v2_opportunities(explainability_json) for dedup key lookups
--   3. Comment on v2_tenants.settings_json documenting the 'vertical' key
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Outreach queue (safe mode pending-review items)
-- ---------------------------------------------------------------------------
create table if not exists public.v2_outreach_queue (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.v2_tenants(id) on delete cascade,
  opportunity_id   uuid references public.v2_opportunities(id) on delete set null,
  channel          public.v2_outreach_channel not null,
  to_address       text not null,
  body             text not null,
  subject          text,
  status           text not null default 'pending_review'
                     check (status in ('pending_review', 'approved', 'rejected', 'sent', 'failed')),
  vertical_key     text,
  qualified_at     timestamptz not null default now(),
  queued_by        uuid references auth.users(id) on delete set null,
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,
  sent_at          timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists v2_outreach_queue_tenant_status_idx
  on public.v2_outreach_queue(tenant_id, status, created_at desc);

create index if not exists v2_outreach_queue_opportunity_idx
  on public.v2_outreach_queue(opportunity_id)
  where opportunity_id is not null;

-- RLS: tenant isolation
alter table public.v2_outreach_queue enable row level security;

create policy "v2_outreach_queue_tenant_isolation" on public.v2_outreach_queue
  for all using (
    tenant_id in (
      select franchise_tenant_id from public.v2_account_tenant_map
      where account_id = (
        select id from public.accounts where id = auth.uid()
      )
      union
      select franchise_tenant_id from public.v2_account_tenant_map
      where account_id in (
        select account_id from public.users where id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. GIN index on v2_opportunities.explainability_json for dedup key lookups
--    This makes checkOpportunityDuplicate() fast at scale.
-- ---------------------------------------------------------------------------
create index if not exists v2_opportunities_explainability_gin_idx
  on public.v2_opportunities using gin (explainability_json);

-- ---------------------------------------------------------------------------
-- 3. Document the 'vertical' settings key
-- ---------------------------------------------------------------------------
comment on column public.v2_tenants.settings_json is
  'JSONB configuration for this tenant. Supported keys:
   - vertical (text): franchise vertical key — one of "restoration", "pest_control", "home_services", "multi_line"
   - quiet_hours_start (text): HH:MM local time to stop outreach (e.g. "21:00")
   - quiet_hours_end (text): HH:MM local time to resume outreach (e.g. "08:00")
   - timezone (text): IANA timezone for this franchise (e.g. "America/New_York")
   - safe_mode (bool): if true, outreach requires manual approval before sending';
