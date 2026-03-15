create extension if not exists pgcrypto;
create extension if not exists postgis;

-- ===== Enums =====
do $$ begin
  if not exists (select 1 from pg_type where typname = 'v2_tenant_type') then
    create type public.v2_tenant_type as enum ('platform', 'enterprise', 'franchise');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_membership_role') then
    create type public.v2_membership_role as enum (
      'PLATFORM_ADMIN',
      'ENTERPRISE_ADMIN',
      'REGIONAL_MANAGER',
      'FRANCHISE_OWNER',
      'DISPATCHER',
      'SDR',
      'TECH',
      'READ_ONLY'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_data_source_status') then
    create type public.v2_data_source_status as enum ('active', 'paused', 'disabled');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_terms_status') then
    create type public.v2_terms_status as enum ('approved', 'restricted', 'pending_review', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_connector_run_status') then
    create type public.v2_connector_run_status as enum ('queued', 'running', 'completed', 'failed', 'partial');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_contact_status') then
    create type public.v2_contact_status as enum ('unknown', 'identified', 'contacted', 'do_not_contact');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_routing_status') then
    create type public.v2_routing_status as enum ('pending', 'routed', 'escalated', 'complete', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_lifecycle_status') then
    create type public.v2_lifecycle_status as enum (
      'new',
      'qualified',
      'assigned',
      'contacted',
      'booked_job',
      'closed_lost'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_assignment_status') then
    create type public.v2_assignment_status as enum ('pending_acceptance', 'accepted', 'escalated', 'complete', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_outreach_channel') then
    create type public.v2_outreach_channel as enum ('sms', 'email', 'voice', 'crm_task', 'slack', 'teams');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_outreach_event_type') then
    create type public.v2_outreach_event_type as enum ('queued', 'sent', 'delivered', 'replied', 'failed', 'skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'v2_revenue_band') then
    create type public.v2_revenue_band as enum ('low', 'medium', 'high', 'enterprise');
  end if;
end $$;

-- ===== Core tenant model =====
create table if not exists public.v2_tenants (
  id uuid primary key default gen_random_uuid(),
  parent_tenant_id uuid references public.v2_tenants(id) on delete set null,
  type public.v2_tenant_type not null,
  name text not null,
  brand text,
  status text not null default 'active',
  legacy_account_id uuid references public.accounts(id) on delete set null,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (legacy_account_id)
);

create unique index if not exists v2_tenants_type_name_ux on public.v2_tenants(type, name);
create index if not exists v2_tenants_parent_idx on public.v2_tenants(parent_tenant_id);

create table if not exists public.v2_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.v2_membership_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists v2_tenant_memberships_user_idx on public.v2_tenant_memberships(user_id, is_active);
create index if not exists v2_tenant_memberships_tenant_idx on public.v2_tenant_memberships(tenant_id, is_active);

create table if not exists public.v2_account_tenant_map (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  enterprise_tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  franchise_tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ===== Territories =====
create table if not exists public.v2_territories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  external_id text,
  name text not null,
  geometry geography(MultiPolygon, 4326),
  zip_codes text[] not null default '{}'::text[],
  service_lines text[] not null default '{}'::text[],
  capacity_json jsonb not null default '{}'::jsonb,
  hours_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_territories_tenant_active_idx on public.v2_territories(tenant_id, active);
create index if not exists v2_territories_zip_gin_idx on public.v2_territories using gin(zip_codes);
create index if not exists v2_territories_service_lines_gin_idx on public.v2_territories using gin(service_lines);
create index if not exists v2_territories_geometry_gix on public.v2_territories using gist(geometry);

create table if not exists public.v2_territory_versions (
  id uuid primary key default gen_random_uuid(),
  territory_id uuid not null references public.v2_territories(id) on delete cascade,
  version_no integer not null,
  geometry geography(MultiPolygon, 4326),
  zip_codes text[] not null default '{}'::text[],
  service_lines text[] not null default '{}'::text[],
  changed_by_user_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (territory_id, version_no)
);

-- ===== Sources + ingestion =====
create table if not exists public.v2_data_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.v2_tenants(id) on delete cascade,
  source_type text not null,
  name text not null,
  status public.v2_data_source_status not null default 'active',
  terms_status public.v2_terms_status not null default 'pending_review',
  rate_limit_policy jsonb not null default '{}'::jsonb,
  config_encrypted text,
  reliability_score integer not null default 50 check (reliability_score between 0 and 100),
  compliance_flags jsonb not null default '{}'::jsonb,
  freshness_timestamp timestamptz,
  provenance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_data_sources_tenant_status_idx on public.v2_data_sources(tenant_id, status);

create table if not exists public.v2_connector_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.v2_data_sources(id) on delete cascade,
  tenant_id uuid references public.v2_tenants(id) on delete cascade,
  status public.v2_connector_run_status not null default 'queued',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  records_seen integer not null default 0,
  records_created integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v2_connector_runs_source_status_idx on public.v2_connector_runs(source_id, status, started_at desc);

create table if not exists public.v2_source_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.v2_data_sources(id) on delete cascade,
  tenant_id uuid references public.v2_tenants(id) on delete cascade,
  connector_run_id uuid references public.v2_connector_runs(id) on delete set null,
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  location_text text,
  location geography(Point, 4326),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  source_reliability_score integer not null default 0 check (source_reliability_score between 0 and 100),
  compliance_status text not null default 'pending',
  dedupe_key text not null,
  event_type text not null,
  created_at timestamptz not null default now(),
  unique (source_id, dedupe_key)
);

create index if not exists v2_source_events_tenant_created_idx on public.v2_source_events(tenant_id, created_at desc);
create index if not exists v2_source_events_location_gix on public.v2_source_events using gist(location);

create table if not exists public.v2_incident_clusters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  cluster_type text not null,
  center_point geography(Point, 4326),
  radius_meters integer not null default 5000,
  severity_score integer not null default 0 check (severity_score between 0 and 100),
  signal_count integer not null default 0,
  first_seen timestamptz not null,
  last_seen timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_incident_clusters_tenant_status_idx on public.v2_incident_clusters(tenant_id, status);
create index if not exists v2_incident_clusters_center_gix on public.v2_incident_clusters using gist(center_point);

-- ===== Opportunity + funnel =====
create table if not exists public.v2_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  source_event_id uuid references public.v2_source_events(id) on delete set null,
  incident_cluster_id uuid references public.v2_incident_clusters(id) on delete set null,
  opportunity_type text not null,
  service_line text,
  title text not null,
  description text,
  urgency_score integer not null default 0 check (urgency_score between 0 and 100),
  job_likelihood_score integer not null default 0 check (job_likelihood_score between 0 and 100),
  contactability_score integer not null default 0 check (contactability_score between 0 and 100),
  source_reliability_score integer not null default 0 check (source_reliability_score between 0 and 100),
  revenue_band public.v2_revenue_band not null default 'medium',
  catastrophe_linkage_score integer not null default 0 check (catastrophe_linkage_score between 0 and 100),
  location_text text,
  location geography(Point, 4326),
  postal_code text,
  contact_status public.v2_contact_status not null default 'unknown',
  routing_status public.v2_routing_status not null default 'pending',
  lifecycle_status public.v2_lifecycle_status not null default 'new',
  explainability_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_opportunities_tenant_created_idx on public.v2_opportunities(tenant_id, created_at desc);
create index if not exists v2_opportunities_status_idx on public.v2_opportunities(tenant_id, routing_status, lifecycle_status);
create index if not exists v2_opportunities_location_gix on public.v2_opportunities using gist(location);

create table if not exists public.v2_opportunity_signals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  opportunity_id uuid not null references public.v2_opportunities(id) on delete cascade,
  signal_key text not null,
  signal_value numeric,
  signal_weight numeric,
  explanation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v2_opportunity_signals_opportunity_idx on public.v2_opportunity_signals(opportunity_id, created_at desc);

create table if not exists public.v2_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  opportunity_id uuid references public.v2_opportunities(id) on delete set null,
  contact_name text,
  business_name text,
  contact_channels_json jsonb not null default '{}'::jsonb,
  property_address text,
  city text,
  state text,
  postal_code text,
  lead_status text not null default 'new',
  owner_user_id uuid references auth.users(id) on delete set null,
  crm_sync_status text not null default 'not_synced',
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_leads_tenant_status_idx on public.v2_leads(tenant_id, lead_status, created_at desc);

create table if not exists public.v2_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  lead_id uuid references public.v2_leads(id) on delete set null,
  external_crm_id text,
  job_type text,
  booked_at timestamptz,
  scheduled_at timestamptz,
  revenue_amount numeric(12, 2),
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_jobs_tenant_status_idx on public.v2_jobs(tenant_id, status, booked_at desc);

-- ===== Routing + assignment =====
create table if not exists public.v2_routing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  territory_id uuid references public.v2_territories(id) on delete cascade,
  service_line text,
  priority integer not null default 100,
  rule_json jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_routing_rules_tenant_active_idx on public.v2_routing_rules(tenant_id, active, priority);

create table if not exists public.v2_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  opportunity_id uuid not null references public.v2_opportunities(id) on delete cascade,
  lead_id uuid references public.v2_leads(id) on delete set null,
  assigned_tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  assigned_user_id uuid references auth.users(id) on delete set null,
  backup_tenant_id uuid references public.v2_tenants(id) on delete set null,
  escalation_tenant_id uuid references public.v2_tenants(id) on delete set null,
  assignment_reason text not null,
  status public.v2_assignment_status not null default 'pending_acceptance',
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  escalated_at timestamptz,
  completed_at timestamptz,
  sla_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_assignments_tenant_status_idx on public.v2_assignments(tenant_id, status, sla_due_at);
create index if not exists v2_assignments_assigned_tenant_idx on public.v2_assignments(assigned_tenant_id, status);

-- ===== Outreach + campaigns =====
create table if not exists public.v2_outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  name text not null,
  channel_mix jsonb not null default '[]'::jsonb,
  trigger_conditions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  name text not null,
  purpose text,
  source_scope jsonb not null default '{}'::jsonb,
  sequence_id uuid references public.v2_outreach_sequences(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_outreach_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  lead_id uuid references public.v2_leads(id) on delete set null,
  sequence_id uuid references public.v2_outreach_sequences(id) on delete set null,
  assignment_id uuid references public.v2_assignments(id) on delete set null,
  channel public.v2_outreach_channel not null,
  event_type public.v2_outreach_event_type not null,
  sent_at timestamptz,
  response_at timestamptz,
  provider_message_id text,
  outcome text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v2_outreach_events_tenant_created_idx on public.v2_outreach_events(tenant_id, created_at desc);

create table if not exists public.v2_suppression_list (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  channel public.v2_outreach_channel not null,
  value text not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, channel, value)
);

-- ===== Audit + attribution =====
create table if not exists public.v2_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  entity_type text not null,
  entity_id text,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v2_audit_logs_tenant_created_idx on public.v2_audit_logs(tenant_id, created_at desc);

create table if not exists public.v2_job_attributions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.v2_tenants(id) on delete cascade,
  job_id uuid not null references public.v2_jobs(id) on delete cascade,
  primary_opportunity_id uuid references public.v2_opportunities(id) on delete set null,
  source_event_id uuid references public.v2_source_events(id) on delete set null,
  campaign_id uuid references public.v2_campaigns(id) on delete set null,
  attribution_confidence integer not null default 0 check (attribution_confidence between 0 and 100),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id)
);

-- ===== Triggers =====
create trigger trg_v2_tenants_updated_at before update on public.v2_tenants
for each row execute function public.set_updated_at();
create trigger trg_v2_tenant_memberships_updated_at before update on public.v2_tenant_memberships
for each row execute function public.set_updated_at();
create trigger trg_v2_territories_updated_at before update on public.v2_territories
for each row execute function public.set_updated_at();
create trigger trg_v2_data_sources_updated_at before update on public.v2_data_sources
for each row execute function public.set_updated_at();
create trigger trg_v2_opportunities_updated_at before update on public.v2_opportunities
for each row execute function public.set_updated_at();
create trigger trg_v2_leads_updated_at before update on public.v2_leads
for each row execute function public.set_updated_at();
create trigger trg_v2_jobs_updated_at before update on public.v2_jobs
for each row execute function public.set_updated_at();
create trigger trg_v2_routing_rules_updated_at before update on public.v2_routing_rules
for each row execute function public.set_updated_at();
create trigger trg_v2_assignments_updated_at before update on public.v2_assignments
for each row execute function public.set_updated_at();
create trigger trg_v2_outreach_sequences_updated_at before update on public.v2_outreach_sequences
for each row execute function public.set_updated_at();
create trigger trg_v2_campaigns_updated_at before update on public.v2_campaigns
for each row execute function public.set_updated_at();
create trigger trg_v2_incident_clusters_updated_at before update on public.v2_incident_clusters
for each row execute function public.set_updated_at();
create trigger trg_v2_job_attributions_updated_at before update on public.v2_job_attributions
for each row execute function public.set_updated_at();

-- ===== Auth helpers =====
create or replace function public.v2_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.v2_tenant_memberships m
    join public.v2_tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.is_active = true
      and m.role = 'PLATFORM_ADMIN'
      and t.type = 'platform'
  );
$$;

create or replace function public.v2_tenant_is_parent_of(parent_tenant uuid, child_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive lineage as (
    select id, parent_tenant_id
    from public.v2_tenants
    where id = child_tenant

    union all

    select t.id, t.parent_tenant_id
    from public.v2_tenants t
    join lineage l on t.id = l.parent_tenant_id
  )
  select exists (
    select 1
    from lineage
    where id = parent_tenant
  );
$$;

create or replace function public.v2_tenant_can_read(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.v2_tenant_memberships m
    where m.user_id = auth.uid()
      and m.is_active = true
      and (
        m.tenant_id = target_tenant_id
        or public.v2_tenant_is_parent_of(m.tenant_id, target_tenant_id)
      )
  );
$$;

create or replace function public.v2_tenant_can_write(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.v2_tenant_memberships m
    where m.user_id = auth.uid()
      and m.is_active = true
      and (
        m.tenant_id = target_tenant_id
        or (
          m.role in ('PLATFORM_ADMIN', 'ENTERPRISE_ADMIN', 'REGIONAL_MANAGER')
          and public.v2_tenant_is_parent_of(m.tenant_id, target_tenant_id)
        )
      )
  );
$$;

-- ===== RLS enable =====
alter table public.v2_tenants enable row level security;
alter table public.v2_tenant_memberships enable row level security;
alter table public.v2_territories enable row level security;
alter table public.v2_territory_versions enable row level security;
alter table public.v2_data_sources enable row level security;
alter table public.v2_connector_runs enable row level security;
alter table public.v2_source_events enable row level security;
alter table public.v2_incident_clusters enable row level security;
alter table public.v2_opportunities enable row level security;
alter table public.v2_opportunity_signals enable row level security;
alter table public.v2_leads enable row level security;
alter table public.v2_jobs enable row level security;
alter table public.v2_routing_rules enable row level security;
alter table public.v2_assignments enable row level security;
alter table public.v2_outreach_sequences enable row level security;
alter table public.v2_outreach_events enable row level security;
alter table public.v2_campaigns enable row level security;
alter table public.v2_suppression_list enable row level security;
alter table public.v2_audit_logs enable row level security;
alter table public.v2_job_attributions enable row level security;
alter table public.v2_account_tenant_map enable row level security;

-- ===== RLS policies =====
create policy v2_tenants_select on public.v2_tenants
for select using (public.v2_tenant_can_read(id));
create policy v2_tenants_write on public.v2_tenants
for all using (public.v2_tenant_can_write(id))
with check (public.v2_tenant_can_write(id));

create policy v2_tenant_memberships_select on public.v2_tenant_memberships
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_tenant_memberships_write on public.v2_tenant_memberships
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_territories_select on public.v2_territories
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_territories_write on public.v2_territories
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_territory_versions_select on public.v2_territory_versions
for select using (
  exists (
    select 1
    from public.v2_territories t
    where t.id = territory_id
      and public.v2_tenant_can_read(t.tenant_id)
  )
);
create policy v2_territory_versions_write on public.v2_territory_versions
for all using (
  exists (
    select 1
    from public.v2_territories t
    where t.id = territory_id
      and public.v2_tenant_can_write(t.tenant_id)
  )
)
with check (
  exists (
    select 1
    from public.v2_territories t
    where t.id = territory_id
      and public.v2_tenant_can_write(t.tenant_id)
  )
);

create policy v2_data_sources_select on public.v2_data_sources
for select using (tenant_id is null or public.v2_tenant_can_read(tenant_id));
create policy v2_data_sources_write on public.v2_data_sources
for all using (
  (tenant_id is not null and public.v2_tenant_can_write(tenant_id))
  or (tenant_id is null and public.v2_user_is_platform_admin())
)
with check (
  (tenant_id is not null and public.v2_tenant_can_write(tenant_id))
  or (tenant_id is null and public.v2_user_is_platform_admin())
);

create policy v2_connector_runs_select on public.v2_connector_runs
for select using (tenant_id is null or public.v2_tenant_can_read(tenant_id));
create policy v2_connector_runs_write on public.v2_connector_runs
for all using (tenant_id is null or public.v2_tenant_can_write(tenant_id))
with check (tenant_id is null or public.v2_tenant_can_write(tenant_id));

create policy v2_source_events_select on public.v2_source_events
for select using (tenant_id is null or public.v2_tenant_can_read(tenant_id));
create policy v2_source_events_write on public.v2_source_events
for all using (tenant_id is null or public.v2_tenant_can_write(tenant_id))
with check (tenant_id is null or public.v2_tenant_can_write(tenant_id));

create policy v2_incident_clusters_select on public.v2_incident_clusters
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_incident_clusters_write on public.v2_incident_clusters
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_opportunities_select on public.v2_opportunities
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_opportunities_write on public.v2_opportunities
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_opportunity_signals_select on public.v2_opportunity_signals
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_opportunity_signals_write on public.v2_opportunity_signals
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_leads_select on public.v2_leads
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_leads_write on public.v2_leads
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_jobs_select on public.v2_jobs
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_jobs_write on public.v2_jobs
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_routing_rules_select on public.v2_routing_rules
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_routing_rules_write on public.v2_routing_rules
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_assignments_select on public.v2_assignments
for select using (public.v2_tenant_can_read(tenant_id) or public.v2_tenant_can_read(assigned_tenant_id));
create policy v2_assignments_write on public.v2_assignments
for all using (public.v2_tenant_can_write(tenant_id) or public.v2_tenant_can_write(assigned_tenant_id))
with check (public.v2_tenant_can_write(tenant_id) or public.v2_tenant_can_write(assigned_tenant_id));

create policy v2_outreach_sequences_select on public.v2_outreach_sequences
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_outreach_sequences_write on public.v2_outreach_sequences
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_outreach_events_select on public.v2_outreach_events
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_outreach_events_write on public.v2_outreach_events
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_campaigns_select on public.v2_campaigns
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_campaigns_write on public.v2_campaigns
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_suppression_list_select on public.v2_suppression_list
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_suppression_list_write on public.v2_suppression_list
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_audit_logs_select on public.v2_audit_logs
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_audit_logs_insert on public.v2_audit_logs
for insert with check (public.v2_tenant_can_write(tenant_id));

create policy v2_job_attributions_select on public.v2_job_attributions
for select using (public.v2_tenant_can_read(tenant_id));
create policy v2_job_attributions_write on public.v2_job_attributions
for all using (public.v2_tenant_can_write(tenant_id))
with check (public.v2_tenant_can_write(tenant_id));

create policy v2_account_tenant_map_select on public.v2_account_tenant_map
for select using (
  exists (
    select 1
    from public.v2_tenant_memberships m
    where m.user_id = auth.uid()
      and m.is_active = true
      and m.tenant_id in (enterprise_tenant_id, franchise_tenant_id)
  )
);
create policy v2_account_tenant_map_write on public.v2_account_tenant_map
for all using (public.v2_user_is_platform_admin())
with check (public.v2_user_is_platform_admin());

-- ===== Backfill =====
do $$
declare
  platform_tenant uuid;
  rec record;
  enterprise_id uuid;
  franchise_id uuid;
begin
  insert into public.v2_tenants(type, name, brand, status, settings_json)
  values ('platform', 'Service Butler Platform', 'Service Butler', 'active', '{}'::jsonb)
  on conflict (type, name) do update set brand = excluded.brand
  returning id into platform_tenant;

  if platform_tenant is null then
    select id into platform_tenant
    from public.v2_tenants
    where type = 'platform' and name = 'Service Butler Platform'
    limit 1;
  end if;

  for rec in
    select a.id as account_id, a.name as account_name
    from public.accounts a
  loop
    if not exists (select 1 from public.v2_account_tenant_map m where m.account_id = rec.account_id) then
      enterprise_id := gen_random_uuid();
      franchise_id := gen_random_uuid();

      insert into public.v2_tenants(id, parent_tenant_id, type, name, brand, status, settings_json)
      values (
        enterprise_id,
        platform_tenant,
        'enterprise',
        rec.account_name || ' Enterprise',
        rec.account_name,
        'active',
        jsonb_build_object('source', 'backfill')
      );

      insert into public.v2_tenants(id, parent_tenant_id, type, name, brand, status, legacy_account_id, settings_json)
      values (
        franchise_id,
        enterprise_id,
        'franchise',
        rec.account_name,
        rec.account_name,
        'active',
        rec.account_id,
        jsonb_build_object('source', 'backfill')
      );

      insert into public.v2_account_tenant_map(account_id, enterprise_tenant_id, franchise_tenant_id)
      values (rec.account_id, enterprise_id, franchise_id)
      on conflict (account_id) do update
      set enterprise_tenant_id = excluded.enterprise_tenant_id,
          franchise_tenant_id = excluded.franchise_tenant_id;
    end if;
  end loop;
end $$;

insert into public.v2_tenant_memberships(tenant_id, user_id, role, is_active)
select
  map.franchise_tenant_id,
  ar.user_id,
  case ar.role
    when 'ACCOUNT_OWNER' then 'FRANCHISE_OWNER'::public.v2_membership_role
    when 'DISPATCHER' then 'DISPATCHER'::public.v2_membership_role
    when 'TECH' then 'TECH'::public.v2_membership_role
    else 'READ_ONLY'::public.v2_membership_role
  end,
  ar.is_active
from public.account_roles ar
join public.v2_account_tenant_map map on map.account_id = ar.account_id
on conflict (tenant_id, user_id) do update
set role = excluded.role,
    is_active = excluded.is_active;

insert into public.v2_tenant_memberships(tenant_id, user_id, role, is_active)
select distinct
  map.enterprise_tenant_id,
  ar.user_id,
  case ar.role
    when 'ACCOUNT_OWNER' then 'ENTERPRISE_ADMIN'::public.v2_membership_role
    else 'REGIONAL_MANAGER'::public.v2_membership_role
  end,
  ar.is_active
from public.account_roles ar
join public.v2_account_tenant_map map on map.account_id = ar.account_id
where ar.role in ('ACCOUNT_OWNER', 'DISPATCHER')
on conflict (tenant_id, user_id) do nothing;

insert into public.v2_data_sources(id, tenant_id, source_type, name, status, terms_status, reliability_score, compliance_flags, provenance, freshness_timestamp)
select
  s.id,
  map.franchise_tenant_id,
  s.source_type,
  s.name,
  case when s.source_type = 'demo' then 'paused'::public.v2_data_source_status else 'active'::public.v2_data_source_status end,
  'pending_review'::public.v2_terms_status,
  60,
  jsonb_build_object('legacy_source_key', s.source_key),
  'legacy.sources',
  now()
from public.sources s
join public.v2_account_tenant_map map on map.account_id = s.account_id
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    source_type = excluded.source_type,
    name = excluded.name,
    provenance = excluded.provenance;

insert into public.v2_data_sources(tenant_id, source_type, name, status, terms_status, reliability_score, compliance_flags, provenance, freshness_timestamp)
select
  map.franchise_tenant_id,
  'scanner_signal',
  'Legacy Scanner Source Events',
  'active'::public.v2_data_source_status,
  'approved'::public.v2_terms_status,
  65,
  '{}'::jsonb,
  'legacy.source_events',
  now()
from public.v2_account_tenant_map map
where not exists (
  select 1
  from public.v2_data_sources ds
  where ds.tenant_id = map.franchise_tenant_id
    and ds.source_type = 'scanner_signal'
);

insert into public.v2_source_events(id, source_id, tenant_id, occurred_at, ingested_at, raw_payload, normalized_payload, location_text, location, confidence_score, source_reliability_score, compliance_status, dedupe_key, event_type)
select
  se.id,
  ds.id,
  map.franchise_tenant_id,
  coalesce(se.published_at, se.created_at, now()),
  now(),
  se.raw_payload_json,
  jsonb_build_object(
    'headline', se.headline,
    'body_text', se.body_text,
    'signal_category', se.signal_category,
    'service_category_candidate', se.service_category_candidate,
    'platform', se.platform
  ),
  se.raw_location_text,
  null,
  55,
  55,
  'pending',
  md5(coalesce(se.headline, '') || '|' || coalesce(se.source_url, '') || '|' || coalesce(se.published_at::text, se.created_at::text, '')),
  coalesce(se.signal_category, 'signal')
from public.source_events se
join public.v2_account_tenant_map map on map.account_id = se.account_id
join lateral (
  select id
  from public.v2_data_sources ds
  where ds.tenant_id = map.franchise_tenant_id
    and ds.source_type = 'scanner_signal'
  order by ds.created_at asc
  limit 1
) ds on true
on conflict (id) do nothing;

insert into public.v2_opportunities(
  id,
  tenant_id,
  source_event_id,
  opportunity_type,
  service_line,
  title,
  description,
  urgency_score,
  job_likelihood_score,
  contactability_score,
  source_reliability_score,
  revenue_band,
  catastrophe_linkage_score,
  location_text,
  location,
  postal_code,
  contact_status,
  routing_status,
  lifecycle_status,
  explainability_json,
  created_at,
  updated_at
)
select
  o.id,
  map.franchise_tenant_id,
  case when array_length(o.source_event_ids, 1) > 0 then o.source_event_ids[1] else null end,
  coalesce(o.service_category, o.category, 'general'),
  coalesce(o.service_category, o.category, 'general'),
  o.title,
  o.description,
  coalesce(o.urgency_score, 0),
  coalesce(o.intent_score, 0),
  case when o.raw ? 'owner_contact' then 80 else 45 end,
  coalesce(o.confidence, 0),
  case
    when o.intent_score >= 85 then 'enterprise'::public.v2_revenue_band
    when o.intent_score >= 70 then 'high'::public.v2_revenue_band
    when o.intent_score >= 50 then 'medium'::public.v2_revenue_band
    else 'low'::public.v2_revenue_band
  end,
  case when o.tags && array['storm-response','flood','fire'] then 85 else 25 end,
  o.location_text,
  case
    when o.lat is not null and o.lon is not null
      then ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography
    else null
  end,
  o.zip,
  'identified'::public.v2_contact_status,
  case when o.status = 'claimed' then 'routed'::public.v2_routing_status else 'pending'::public.v2_routing_status end,
  case
    when o.status = 'closed' then 'closed_lost'::public.v2_lifecycle_status
    else 'new'::public.v2_lifecycle_status
  end,
  jsonb_build_object('legacy', true, 'legacy_raw', o.raw),
  o.created_at,
  o.updated_at
from public.opportunities o
join public.v2_account_tenant_map map on map.account_id = o.account_id
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    source_event_id = excluded.source_event_id,
    title = excluded.title,
    description = excluded.description,
    updated_at = excluded.updated_at;

insert into public.v2_leads(
  id,
  tenant_id,
  opportunity_id,
  contact_name,
  business_name,
  contact_channels_json,
  property_address,
  city,
  state,
  postal_code,
  lead_status,
  owner_user_id,
  crm_sync_status,
  do_not_contact,
  created_at,
  updated_at
)
select
  l.id,
  map.franchise_tenant_id,
  null,
  l.name,
  null,
  jsonb_build_object('phone', l.phone),
  l.address,
  l.city,
  l.state,
  l.postal_code,
  coalesce(l.status, 'new'),
  l.assigned_user_id,
  'not_synced',
  coalesce(l.stop_all_sequences, false),
  l.created_at,
  l.updated_at
from public.leads l
join public.v2_account_tenant_map map on map.account_id = l.account_id
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    contact_name = excluded.contact_name,
    lead_status = excluded.lead_status,
    updated_at = excluded.updated_at;

insert into public.v2_jobs(
  id,
  tenant_id,
  lead_id,
  external_crm_id,
  job_type,
  booked_at,
  scheduled_at,
  revenue_amount,
  status,
  created_at,
  updated_at
)
select
  j.id,
  map.franchise_tenant_id,
  j.lead_id,
  null,
  j.service_type,
  case when j.pipeline_status in ('WON', 'COMPLETED') then coalesce(j.completed_at, j.updated_at, j.created_at) else null end,
  j.scheduled_for,
  coalesce(j.estimated_value, 0),
  lower(coalesce(j.pipeline_status::text, j.status::text, 'scheduled')),
  j.created_at,
  j.updated_at
from public.jobs j
join public.v2_account_tenant_map map on map.account_id = j.account_id
on conflict (id) do update
set tenant_id = excluded.tenant_id,
    lead_id = excluded.lead_id,
    scheduled_at = excluded.scheduled_at,
    status = excluded.status,
    updated_at = excluded.updated_at;

insert into public.v2_routing_rules(tenant_id, service_line, priority, rule_json, active)
select
  map.franchise_tenant_id,
  rr.category,
  100,
  jsonb_build_object(
    'default_assignee', rr.default_assignee,
    'default_create_mode', rr.default_create_mode,
    'default_job_value_cents', rr.default_job_value_cents,
    'default_sla_minutes', rr.default_sla_minutes
  ),
  rr.enabled
from public.routing_rules rr
join public.v2_account_tenant_map map on map.account_id = rr.account_id
where not exists (
  select 1
  from public.v2_routing_rules existing
  where existing.tenant_id = map.franchise_tenant_id
    and existing.service_line is not distinct from rr.category
);

insert into public.v2_job_attributions(tenant_id, job_id, primary_opportunity_id, source_event_id, attribution_confidence, locked)
select
  j.tenant_id,
  j.id,
  o.id,
  o.source_event_id,
  greatest(20, o.job_likelihood_score),
  false
from public.v2_jobs j
left join public.v2_leads l on l.id = j.lead_id
left join public.v2_opportunities o on o.id = l.opportunity_id
where not exists (
  select 1 from public.v2_job_attributions a where a.job_id = j.id
);
