create extension if not exists pgcrypto;

create type public.account_role as enum ('ACCOUNT_OWNER', 'DISPATCHER', 'TECH', 'READ_ONLY');
create type public.lead_stage as enum ('NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'LOST');
create type public.job_status as enum ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');
create type public.channel_type as enum ('SMS', 'EMAIL', 'VOICE');
create type public.message_direction as enum ('INBOUND', 'OUTBOUND');
create type public.call_direction as enum ('INBOUND', 'OUTBOUND');
create type public.sequence_type as enum ('MISSED_CALL_FOLLOWUP', 'NEW_LEAD_FOLLOWUP', 'REVIEW_REQUEST');
create type public.sequence_status as enum ('ACTIVE', 'PAUSED', 'ARCHIVED');
create type public.campaign_status as enum ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  twilio_phone_number text,
  review_link text,
  quiet_hours_start time,
  quiet_hours_end time,
  business_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, email)
);

create table if not exists public.account_roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.account_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, user_id)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  first_name text,
  last_name text,
  phone_e164 text,
  email text,
  opted_out_sms boolean not null default false,
  opted_out_email boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  assigned_user_id uuid references auth.users(id),
  source text,
  stage public.lead_stage not null default 'NEW',
  stop_all_sequences boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status public.job_status not null default 'SCHEDULED',
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel public.channel_type not null,
  direction public.message_direction not null,
  body text,
  subject text,
  to_phone text,
  from_phone text,
  to_email text,
  from_email text,
  provider_message_id text,
  status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists messages_provider_message_id_key on public.messages(provider_message_id) where provider_message_id is not null;

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  direction public.call_direction not null,
  from_phone text,
  to_phone text,
  provider_call_id text,
  status text,
  duration_seconds integer,
  recording_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists calls_provider_call_id_key on public.calls(provider_call_id) where provider_call_id is not null;

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  channel public.channel_type not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  channel public.channel_type not null,
  status public.campaign_status not null default 'DRAFT',
  segment_filter jsonb not null default '{}'::jsonb,
  message_subject text,
  message_body text not null,
  scheduled_for timestamptz,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_deliveries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  channel public.channel_type not null,
  status text not null default 'PENDING',
  provider_message_id text,
  provider_call_id text,
  attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id, lead_id, contact_id)
);

create table if not exists public.sequences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  type public.sequence_type not null,
  name text not null,
  status public.sequence_status not null default 'ACTIVE',
  stop_on_reply boolean not null default true,
  stop_on_stage_change boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, type)
);

create table if not exists public.sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'ACTIVE',
  current_step integer not null default 0,
  next_run_at timestamptz,
  stopped_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, lead_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create table if not exists public.stripe_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, event_id)
);

create index if not exists users_account_id_idx on public.users(account_id);
create index if not exists account_roles_user_account_idx on public.account_roles(user_id, account_id) where is_active = true;
create index if not exists contacts_account_phone_idx on public.contacts(account_id, phone_e164);
create index if not exists leads_account_stage_idx on public.leads(account_id, stage);
create index if not exists jobs_account_status_idx on public.jobs(account_id, status);
create index if not exists conversations_account_lead_idx on public.conversations(account_id, lead_id);
create index if not exists messages_account_lead_created_idx on public.messages(account_id, lead_id, created_at desc);
create index if not exists calls_account_lead_created_idx on public.calls(account_id, lead_id, created_at desc);
create index if not exists campaigns_account_status_idx on public.campaigns(account_id, status);
create index if not exists campaign_deliveries_account_campaign_idx on public.campaign_deliveries(account_id, campaign_id);
create index if not exists sequence_enrollments_account_next_idx on public.sequence_enrollments(account_id, next_run_at) where status = 'ACTIVE';
create index if not exists audit_events_account_created_idx on public.audit_events(account_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles r
    where r.account_id = target_account_id
      and r.user_id = auth.uid()
      and r.is_active = true
  );
$$;

create or replace function public.has_account_role(target_account_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_roles r
    where r.account_id = target_account_id
      and r.user_id = auth.uid()
      and r.is_active = true
      and r.role::text = any(allowed_roles)
  );
$$;

create trigger trg_accounts_updated_at before update on public.accounts
for each row execute function public.set_updated_at();
create trigger trg_account_settings_updated_at before update on public.account_settings
for each row execute function public.set_updated_at();
create trigger trg_users_updated_at before update on public.users
for each row execute function public.set_updated_at();
create trigger trg_account_roles_updated_at before update on public.account_roles
for each row execute function public.set_updated_at();
create trigger trg_contacts_updated_at before update on public.contacts
for each row execute function public.set_updated_at();
create trigger trg_leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();
create trigger trg_jobs_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger trg_conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
create trigger trg_messages_updated_at before update on public.messages
for each row execute function public.set_updated_at();
create trigger trg_calls_updated_at before update on public.calls
for each row execute function public.set_updated_at();
create trigger trg_templates_updated_at before update on public.templates
for each row execute function public.set_updated_at();
create trigger trg_campaigns_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();
create trigger trg_campaign_deliveries_updated_at before update on public.campaign_deliveries
for each row execute function public.set_updated_at();
create trigger trg_sequences_updated_at before update on public.sequences
for each row execute function public.set_updated_at();
create trigger trg_sequence_enrollments_updated_at before update on public.sequence_enrollments
for each row execute function public.set_updated_at();
create trigger trg_audit_events_updated_at before update on public.audit_events
for each row execute function public.set_updated_at();
create trigger trg_stripe_customers_updated_at before update on public.stripe_customers
for each row execute function public.set_updated_at();
create trigger trg_stripe_subscriptions_updated_at before update on public.stripe_subscriptions
for each row execute function public.set_updated_at();
create trigger trg_webhook_events_updated_at before update on public.webhook_events
for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.account_settings enable row level security;
alter table public.users enable row level security;
alter table public.account_roles enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.jobs enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.calls enable row level security;
alter table public.templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_deliveries enable row level security;
alter table public.sequences enable row level security;
alter table public.sequence_enrollments enable row level security;
alter table public.audit_events enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.webhook_events enable row level security;

create policy accounts_select_member on public.accounts
for select using (public.is_account_member(id));

create policy accounts_owner_update on public.accounts
for update using (public.has_account_role(id, array['ACCOUNT_OWNER']))
with check (public.has_account_role(id, array['ACCOUNT_OWNER']));

create policy member_select_account_id on public.account_settings
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_account_settings on public.account_settings
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_users on public.users
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_users on public.users
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_account_roles on public.account_roles
for select using (public.is_account_member(account_id));
create policy owner_write_account_roles on public.account_roles
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER']));

create policy member_select_contacts on public.contacts
for select using (public.is_account_member(account_id));
create policy non_read_only_write_contacts on public.contacts
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_leads on public.leads
for select using (public.is_account_member(account_id));
create policy non_read_only_write_leads on public.leads
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_jobs on public.jobs
for select using (public.is_account_member(account_id));
create policy non_read_only_write_jobs on public.jobs
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_conversations on public.conversations
for select using (public.is_account_member(account_id));
create policy non_read_only_write_conversations on public.conversations
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_messages on public.messages
for select using (public.is_account_member(account_id));
create policy non_read_only_write_messages on public.messages
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_calls on public.calls
for select using (public.is_account_member(account_id));
create policy non_read_only_write_calls on public.calls
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_templates on public.templates
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_templates on public.templates
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_campaigns on public.campaigns
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_campaigns on public.campaigns
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_campaign_deliveries on public.campaign_deliveries
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_campaign_deliveries on public.campaign_deliveries
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_sequences on public.sequences
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_sequences on public.sequences
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_sequence_enrollments on public.sequence_enrollments
for select using (public.is_account_member(account_id));
create policy non_read_only_write_sequence_enrollments on public.sequence_enrollments
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_audit_events on public.audit_events
for select using (public.is_account_member(account_id));
create policy non_read_only_insert_audit_events on public.audit_events
for insert with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create policy member_select_stripe_customers on public.stripe_customers
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_stripe_customers on public.stripe_customers
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_stripe_subscriptions on public.stripe_subscriptions
for select using (public.is_account_member(account_id));
create policy owner_dispatcher_write_stripe_subscriptions on public.stripe_subscriptions
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER']));

create policy member_select_webhook_events on public.webhook_events
for select using (account_id is null or public.is_account_member(account_id));
