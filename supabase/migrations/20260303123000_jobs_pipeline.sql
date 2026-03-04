create type public.job_pipeline_status as enum ('NEW', 'CONTACTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'WON', 'LOST');

alter table public.jobs
  add column if not exists pipeline_status public.job_pipeline_status not null default 'NEW',
  add column if not exists service_type text,
  add column if not exists assigned_user_id uuid references auth.users(id),
  add column if not exists assigned_tech_name text,
  add column if not exists estimated_value numeric(10,2) not null default 0,
  add column if not exists notes text,
  add column if not exists intent_score integer not null default 0,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text;

alter table public.jobs
  add constraint jobs_intent_score_range check (intent_score >= 0 and intent_score <= 100);

alter table public.leads
  add column if not exists converted_job_id uuid references public.jobs(id) on delete set null;

create table if not exists public.lead_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, lead_id),
  unique(job_id)
);

create index if not exists jobs_account_pipeline_idx on public.jobs(account_id, pipeline_status);
create index if not exists jobs_account_scheduled_idx on public.jobs(account_id, scheduled_for);
create index if not exists lead_jobs_account_idx on public.lead_jobs(account_id, lead_id, job_id);

update public.jobs j
set
  service_type = coalesce(j.service_type, l.service_type),
  customer_name = coalesce(j.customer_name, l.name),
  customer_phone = coalesce(j.customer_phone, l.phone),
  address = coalesce(j.address, l.address),
  city = coalesce(j.city, l.city),
  state = coalesce(j.state, l.state),
  postal_code = coalesce(j.postal_code, l.postal_code),
  pipeline_status = case
    when j.status = 'SCHEDULED' then 'SCHEDULED'::public.job_pipeline_status
    when j.status = 'IN_PROGRESS' then 'IN_PROGRESS'::public.job_pipeline_status
    when j.status = 'COMPLETED' then 'COMPLETED'::public.job_pipeline_status
    else 'CONTACTED'::public.job_pipeline_status
  end
from public.leads l
where j.lead_id = l.id;

insert into public.lead_jobs(account_id, lead_id, job_id)
select j.account_id, j.lead_id, j.id
from public.jobs j
left join public.lead_jobs lj on lj.job_id = j.id
where lj.id is null;

update public.leads l
set converted_job_id = lj.job_id
from public.lead_jobs lj
where lj.lead_id = l.id
  and (l.converted_job_id is distinct from lj.job_id);

alter table public.lead_jobs enable row level security;

create policy member_select_lead_jobs on public.lead_jobs
for select using (public.is_account_member(account_id));

create policy non_read_only_write_lead_jobs on public.lead_jobs
for all using (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']))
with check (public.has_account_role(account_id, array['ACCOUNT_OWNER','DISPATCHER','TECH']));

create trigger trg_lead_jobs_updated_at before update on public.lead_jobs
for each row execute function public.set_updated_at();
