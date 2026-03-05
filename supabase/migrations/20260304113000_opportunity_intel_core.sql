create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_key text not null,
  name text not null,
  source_type text not null default 'public_feed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, source_key)
);

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  service_types text[] not null default '{}'::text[],
  territory_zips text[] not null default '{}'::text[],
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  category text not null,
  title text not null,
  description text,
  location_text text,
  lat numeric,
  lon numeric,
  intent_score integer not null default 0 check (intent_score >= 0 and intent_score <= 100),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  tags text[] not null default '{}'::text[],
  suggested_action text,
  status text not null default 'new',
  claimed_by_contractor_id uuid references public.contractors(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  service_type text,
  city text,
  state text,
  postal_code text,
  tags text[] not null default '{}'::text[],
  source text not null default 'csv',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_account_created_idx on public.opportunities(account_id, created_at desc);
create index if not exists opportunities_account_category_idx on public.opportunities(account_id, category, created_at desc);
create index if not exists contractors_account_active_idx on public.contractors(account_id, active);
create index if not exists outbound_contacts_account_created_idx on public.outbound_contacts(account_id, created_at desc);

create trigger trg_sources_updated_at before update on public.sources
for each row execute function public.set_updated_at();
create trigger trg_contractors_updated_at before update on public.contractors
for each row execute function public.set_updated_at();
create trigger trg_opportunities_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();
create trigger trg_outbound_contacts_updated_at before update on public.outbound_contacts
for each row execute function public.set_updated_at();

alter table public.sources enable row level security;
alter table public.contractors enable row level security;
alter table public.opportunities enable row level security;
alter table public.outbound_contacts enable row level security;

create policy member_select_sources on public.sources
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_sources on public.sources
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_contractors on public.contractors
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_contractors on public.contractors
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_opportunities on public.opportunities
for select using (public.is_account_member(account_id));
create policy non_read_only_write_opportunities on public.opportunities
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_outbound_contacts on public.outbound_contacts
for select using (public.is_account_member(account_id));
create policy non_read_only_write_outbound_contacts on public.outbound_contacts
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));
