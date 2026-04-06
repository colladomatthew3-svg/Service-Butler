-- Source registry activation and Tier-1 controls:
-- - Persist rollout/readiness/health state on v2_data_sources
-- - Align compliance_status with source-level policy state
-- - Add freshness SLA controls for source-specific readiness checks

alter table public.v2_data_sources
  add column if not exists compliance_status public.v2_terms_status not null default 'pending_review',
  add column if not exists rollout_state text not null default 'pilot',
  add column if not exists readiness_status text not null default 'unknown',
  add column if not exists readiness_checked_at timestamptz,
  add column if not exists readiness_reasons jsonb not null default '[]'::jsonb,
  add column if not exists freshness_sla_minutes integer not null default 360,
  add column if not exists health_status text not null default 'unknown',
  add column if not exists health_detail text,
  add column if not exists last_health_checked_at timestamptz,
  add column if not exists last_health_latency_ms integer;

update public.v2_data_sources
set
  compliance_status = coalesce(compliance_status, terms_status),
  rollout_state = case
    when lower(coalesce(rollout_state, '')) in ('shadow', 'pilot', 'live', 'disabled') then lower(rollout_state)
    else 'pilot'
  end,
  readiness_status = case
    when lower(coalesce(readiness_status, '')) in ('pass', 'warn', 'fail', 'unknown') then lower(readiness_status)
    else 'unknown'
  end,
  freshness_sla_minutes = greatest(30, coalesce(freshness_sla_minutes, 360)),
  health_status = case
    when lower(coalesce(health_status, '')) in ('ok', 'degraded', 'failed', 'unknown') then lower(health_status)
    else 'unknown'
  end
where true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'v2_data_sources_rollout_state_check') then
    alter table public.v2_data_sources
      add constraint v2_data_sources_rollout_state_check
      check (rollout_state in ('shadow', 'pilot', 'live', 'disabled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'v2_data_sources_readiness_status_check') then
    alter table public.v2_data_sources
      add constraint v2_data_sources_readiness_status_check
      check (readiness_status in ('pass', 'warn', 'fail', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'v2_data_sources_health_status_check') then
    alter table public.v2_data_sources
      add constraint v2_data_sources_health_status_check
      check (health_status in ('ok', 'degraded', 'failed', 'unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'v2_data_sources_freshness_sla_minutes_check') then
    alter table public.v2_data_sources
      add constraint v2_data_sources_freshness_sla_minutes_check
      check (freshness_sla_minutes >= 30 and freshness_sla_minutes <= 10080);
  end if;
end $$;

create index if not exists v2_data_sources_tenant_rollout_idx
  on public.v2_data_sources (tenant_id, rollout_state, status);

create index if not exists v2_data_sources_tenant_compliance_idx
  on public.v2_data_sources (tenant_id, compliance_status, status);
