create extension if not exists pgcrypto;

create table if not exists public.source_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_type text not null,
  platform text,
  source_url text,
  headline text not null,
  body_text text,
  author_name text,
  author_handle text,
  published_at timestamptz,
  raw_location_text text,
  signal_category text,
  service_category_candidate text,
  damage_keywords text[] not null default '{}'::text[],
  urgency_keywords text[] not null default '{}'::text[],
  media_count integer not null default 0,
  raw_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.opportunities
  add column if not exists lead_type text not null default 'direct',
  add column if not exists service_category text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text,
  add column if not exists urgency_score integer not null default 0 check (urgency_score >= 0 and urgency_score <= 100),
  add column if not exists recommended_action text,
  add column if not exists territory text,
  add column if not exists source_event_ids uuid[] not null default '{}'::uuid[];

update public.opportunities
set
  service_category = coalesce(service_category, category),
  recommended_action = coalesce(recommended_action, suggested_action)
where service_category is null or recommended_action is null;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  company_name text not null,
  contact_name text,
  title text,
  email text,
  phone text,
  website text,
  city text,
  state text,
  zip text,
  territory text,
  prospect_type text not null,
  property_type text,
  building_count integer,
  priority_tier text not null default 'standard',
  strategic_value integer not null default 50 check (strategic_value >= 0 and strategic_value <= 100),
  near_active_incident boolean not null default false,
  last_outbound_at timestamptz,
  notes text,
  tags text[] not null default '{}'::text[],
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  company_name text not null,
  contact_name text,
  title text,
  email text,
  phone text,
  website text,
  city text,
  state text,
  zip text,
  partner_type text not null,
  territory text,
  priority_tier text not null default 'standard',
  strategic_value integer not null default 50 check (strategic_value >= 0 and strategic_value <= 100),
  near_active_incident boolean not null default false,
  last_outbound_at timestamptz,
  notes text,
  tags text[] not null default '{}'::text[],
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_lists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  list_type text not null,
  segment_definition_json jsonb not null default '{}'::jsonb,
  territory text,
  source_trigger text,
  campaign_name text,
  smartlead_campaign_id text,
  export_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_list_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  outbound_list_id uuid not null references public.outbound_lists(id) on delete cascade,
  record_type text not null,
  record_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.smartlead_sync_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  outbound_list_id uuid references public.outbound_lists(id) on delete set null,
  smartlead_campaign_id text,
  action_type text not null,
  status text not null,
  request_payload_json jsonb not null default '{}'::jsonb,
  response_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.smartlead_webhook_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  webhook_type text not null,
  smartlead_campaign_id text,
  payload_json jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists source_events_account_created_idx
  on public.source_events(account_id, created_at desc);
create index if not exists source_events_account_signal_idx
  on public.source_events(account_id, signal_category, created_at desc);
create index if not exists opportunities_account_lead_type_idx
  on public.opportunities(account_id, lead_type, created_at desc);
create index if not exists prospects_account_type_idx
  on public.prospects(account_id, prospect_type, created_at desc);
create index if not exists prospects_account_territory_idx
  on public.prospects(account_id, territory, created_at desc);
create index if not exists referral_partners_account_type_idx
  on public.referral_partners(account_id, partner_type, created_at desc);
create index if not exists referral_partners_account_territory_idx
  on public.referral_partners(account_id, territory, created_at desc);
create index if not exists outbound_lists_account_created_idx
  on public.outbound_lists(account_id, created_at desc);
create index if not exists outbound_list_members_list_idx
  on public.outbound_list_members(outbound_list_id, record_type);
create index if not exists smartlead_sync_logs_account_created_idx
  on public.smartlead_sync_logs(account_id, created_at desc);
create unique index if not exists outbound_list_members_unique_member_idx
  on public.outbound_list_members(outbound_list_id, record_type, record_id);

create trigger trg_prospects_updated_at before update on public.prospects
for each row execute function public.set_updated_at();
create trigger trg_referral_partners_updated_at before update on public.referral_partners
for each row execute function public.set_updated_at();
create trigger trg_outbound_lists_updated_at before update on public.outbound_lists
for each row execute function public.set_updated_at();

alter table public.source_events enable row level security;
alter table public.prospects enable row level security;
alter table public.referral_partners enable row level security;
alter table public.outbound_lists enable row level security;
alter table public.outbound_list_members enable row level security;
alter table public.smartlead_sync_logs enable row level security;
alter table public.smartlead_webhook_events enable row level security;

create policy member_select_source_events on public.source_events
for select using (public.is_account_member(account_id));
create policy non_read_only_write_source_events on public.source_events
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_prospects on public.prospects
for select using (public.is_account_member(account_id));
create policy non_read_only_write_prospects on public.prospects
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_referral_partners on public.referral_partners
for select using (public.is_account_member(account_id));
create policy non_read_only_write_referral_partners on public.referral_partners
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_outbound_lists on public.outbound_lists
for select using (public.is_account_member(account_id));
create policy non_read_only_write_outbound_lists on public.outbound_lists
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_outbound_list_members on public.outbound_list_members
for select using (public.is_account_member(account_id));
create policy non_read_only_write_outbound_list_members on public.outbound_list_members
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_smartlead_sync_logs on public.smartlead_sync_logs
for select using (public.is_account_member(account_id));
create policy non_read_only_write_smartlead_sync_logs on public.smartlead_sync_logs
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_smartlead_webhook_events on public.smartlead_webhook_events
for select using (account_id is null or public.is_account_member(account_id));
create policy owner_dispatcher_write_smartlead_webhook_events on public.smartlead_webhook_events
for all using (
  account_id is null
  or public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER'])
)
with check (
  account_id is null
  or public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER'])
);

insert into public.prospects (
  account_id,
  company_name,
  contact_name,
  email,
  phone,
  city,
  state,
  zip,
  territory,
  prospect_type,
  notes,
  tags,
  source
)
select
  account_id,
  name,
  name,
  email,
  phone,
  city,
  state,
  postal_code,
  trim(concat_ws(', ', city, state)),
  coalesce(service_type, 'property_manager'),
  null,
  tags,
  source
from public.outbound_contacts
where not exists (
  select 1
  from public.prospects
  where prospects.account_id = outbound_contacts.account_id
    and prospects.company_name = outbound_contacts.name
    and coalesce(prospects.email, '') = coalesce(outbound_contacts.email, '')
    and coalesce(prospects.phone, '') = coalesce(outbound_contacts.phone, '')
);

insert into public.source_events (
  account_id,
  source_type,
  platform,
  headline,
  body_text,
  published_at,
  raw_location_text,
  signal_category,
  service_category_candidate,
  urgency_keywords,
  raw_payload_json,
  created_at
)
select
  account_id,
  'scanner_event',
  source,
  title,
  description,
  created_at,
  location_text,
  category,
  category,
  tags,
  raw,
  created_at
from public.scanner_events
where not exists (
  select 1
  from public.source_events
  where source_events.account_id = scanner_events.account_id
    and source_events.headline = scanner_events.title
    and coalesce(source_events.published_at, source_events.created_at) = scanner_events.created_at
);
