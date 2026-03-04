create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'scanner_create_mode') then
    create type public.scanner_create_mode as enum ('lead', 'job');
  end if;
end $$;

create table if not exists public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  category text not null,
  default_assignee text,
  default_create_mode public.scanner_create_mode not null default 'lead',
  default_job_value_cents integer not null default 0,
  default_sla_minutes integer not null default 60,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, category)
);

create table if not exists public.scanner_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  source text not null,
  category text not null,
  title text not null,
  description text,
  location_text text,
  lat numeric,
  lon numeric,
  intent_score integer not null default 0 check (intent_score >= 0 and intent_score <= 100),
  confidence integer not null default 0 check (confidence >= 0 and confidence <= 100),
  tags text[] not null default '{}'::text[],
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists routing_rules_account_enabled_idx
  on public.routing_rules(account_id, enabled, category);
create index if not exists scanner_events_account_created_idx
  on public.scanner_events(account_id, created_at desc);
create index if not exists scanner_events_account_category_idx
  on public.scanner_events(account_id, category, created_at desc);

create trigger trg_routing_rules_updated_at before update on public.routing_rules
for each row execute function public.set_updated_at();

alter table public.routing_rules enable row level security;
alter table public.scanner_events enable row level security;

create policy member_select_routing_rules on public.routing_rules
for select using (public.is_account_member(account_id));

create policy owner_dispatcher_write_routing_rules on public.routing_rules
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_scanner_events on public.scanner_events
for select using (public.is_account_member(account_id));

create policy non_read_only_write_scanner_events on public.scanner_events
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));
