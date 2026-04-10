with ranked_leads as (
  select
    id,
    tenant_id,
    opportunity_id,
    row_number() over (
      partition by tenant_id, opportunity_id
      order by
        case lower(coalesce(lead_status, ''))
          when 'booked' then 0
          when 'won' then 1
          when 'qualified' then 2
          when 'hot' then 3
          when 'contacted' then 4
          when 'new' then 5
          else 6
        end,
        coalesce(updated_at, created_at) desc,
        created_at desc,
        id desc
    ) as rank_order
  from public.v2_leads
  where opportunity_id is not null
),
duplicate_leads as (
  select
    loser.id as loser_id,
    keeper.id as keeper_id
  from ranked_leads loser
  join ranked_leads keeper
    on keeper.tenant_id = loser.tenant_id
   and keeper.opportunity_id = loser.opportunity_id
   and keeper.rank_order = 1
  where loser.rank_order > 1
)
update public.v2_jobs jobs
set lead_id = duplicate_leads.keeper_id
from duplicate_leads
where jobs.lead_id = duplicate_leads.loser_id;

with ranked_leads as (
  select
    id,
    tenant_id,
    opportunity_id,
    row_number() over (
      partition by tenant_id, opportunity_id
      order by
        case lower(coalesce(lead_status, ''))
          when 'booked' then 0
          when 'won' then 1
          when 'qualified' then 2
          when 'hot' then 3
          when 'contacted' then 4
          when 'new' then 5
          else 6
        end,
        coalesce(updated_at, created_at) desc,
        created_at desc,
        id desc
    ) as rank_order
  from public.v2_leads
  where opportunity_id is not null
),
duplicate_leads as (
  select
    loser.id as loser_id,
    keeper.id as keeper_id
  from ranked_leads loser
  join ranked_leads keeper
    on keeper.tenant_id = loser.tenant_id
   and keeper.opportunity_id = loser.opportunity_id
   and keeper.rank_order = 1
  where loser.rank_order > 1
)
update public.v2_assignments assignments
set lead_id = duplicate_leads.keeper_id
from duplicate_leads
where assignments.lead_id = duplicate_leads.loser_id;

with ranked_leads as (
  select
    id,
    tenant_id,
    opportunity_id,
    row_number() over (
      partition by tenant_id, opportunity_id
      order by
        case lower(coalesce(lead_status, ''))
          when 'booked' then 0
          when 'won' then 1
          when 'qualified' then 2
          when 'hot' then 3
          when 'contacted' then 4
          when 'new' then 5
          else 6
        end,
        coalesce(updated_at, created_at) desc,
        created_at desc,
        id desc
    ) as rank_order
  from public.v2_leads
  where opportunity_id is not null
),
duplicate_leads as (
  select
    loser.id as loser_id,
    keeper.id as keeper_id
  from ranked_leads loser
  join ranked_leads keeper
    on keeper.tenant_id = loser.tenant_id
   and keeper.opportunity_id = loser.opportunity_id
   and keeper.rank_order = 1
  where loser.rank_order > 1
)
update public.v2_outreach_events outreach_events
set lead_id = duplicate_leads.keeper_id
from duplicate_leads
where outreach_events.lead_id = duplicate_leads.loser_id;

with ranked_leads as (
  select
    id,
    tenant_id,
    opportunity_id,
    row_number() over (
      partition by tenant_id, opportunity_id
      order by
        case lower(coalesce(lead_status, ''))
          when 'booked' then 0
          when 'won' then 1
          when 'qualified' then 2
          when 'hot' then 3
          when 'contacted' then 4
          when 'new' then 5
          else 6
        end,
        coalesce(updated_at, created_at) desc,
        created_at desc,
        id desc
    ) as rank_order
  from public.v2_leads
  where opportunity_id is not null
)
delete from public.v2_leads leads
using ranked_leads ranked
where leads.id = ranked.id
  and ranked.rank_order > 1;

create unique index if not exists v2_leads_tenant_opportunity_unique_idx
  on public.v2_leads(tenant_id, opportunity_id)
  where opportunity_id is not null;
