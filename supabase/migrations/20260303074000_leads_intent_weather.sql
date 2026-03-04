-- Leads + Intent Signals + Weather settings (MVP)
create extension if not exists pgcrypto;

alter table public.leads
  alter column account_id drop not null;

alter table public.leads
  add column if not exists status text default 'new',
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists service_type text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists requested_timeframe text,
  add column if not exists notes text,
  add column if not exists scheduled_for timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_status_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_status_check
      check (status in ('new', 'contacted', 'scheduled', 'won', 'lost'));
  end if;
end
$$;

update public.leads
set status = case stage
  when 'NEW' then 'new'
  when 'CONTACTED' then 'contacted'
  when 'QUALIFIED' then 'contacted'
  when 'BOOKED' then 'scheduled'
  when 'COMPLETED' then 'won'
  when 'LOST' then 'lost'
  else 'new'
end
where status is null;

update public.leads
set
  name = coalesce(name, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
  phone = coalesce(phone, c.phone_e164)
from public.contacts c
where c.id = public.leads.contact_id
  and (public.leads.name is null or public.leads.phone is null);

alter table public.account_settings
  alter column account_id drop not null;

alter table public.account_settings
  add column if not exists home_base_city text,
  add column if not exists home_base_state text,
  add column if not exists home_base_postal_code text,
  add column if not exists weather_location_label text,
  add column if not exists weather_lat numeric,
  add column if not exists weather_lng numeric;

create table if not exists public.lead_intent_signals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  signal_type text not null,
  title text not null,
  detail text not null,
  score integer not null check (score between 0 and 100),
  payload jsonb not null default '{}'::jsonb
);

create index if not exists lead_intent_signals_lead_id_idx on public.lead_intent_signals(lead_id);
create index if not exists leads_status_created_idx on public.leads(status, created_at desc);
create index if not exists leads_service_type_idx on public.leads(service_type);
create index if not exists leads_scheduled_for_idx on public.leads(scheduled_for);

alter table public.lead_intent_signals enable row level security;

drop policy if exists member_select_lead_intent_signals on public.lead_intent_signals;
create policy member_select_lead_intent_signals on public.lead_intent_signals
for select
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_account_member(l.account_id)
  )
);

drop policy if exists non_read_only_write_lead_intent_signals on public.lead_intent_signals;
create policy non_read_only_write_lead_intent_signals on public.lead_intent_signals
for all
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.has_account_role(l.account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH'])
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.has_account_role(l.account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH'])
  )
);
