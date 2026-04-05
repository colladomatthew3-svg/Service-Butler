-- Runtime hardening for connector runs:
-- - Extend run status model with stale/replayed
-- - Add heartbeat/idempotency/replay metadata columns
-- - Add helper functions for heartbeat touches and stale-run watchdog updates

do $$
begin
  alter type public.v2_connector_run_status add value if not exists 'stale';
  alter type public.v2_connector_run_status add value if not exists 'replayed';
exception
  when undefined_object then
    -- v2 foundation migration has not been applied yet
    null;
end $$;

alter table public.v2_connector_runs
  add column if not exists heartbeat_at timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists replayed_from_run_id uuid references public.v2_connector_runs(id) on delete set null;

update public.v2_connector_runs
set heartbeat_at = coalesce(heartbeat_at, started_at)
where heartbeat_at is null;

create unique index if not exists v2_connector_runs_tenant_source_idempotency_ux
  on public.v2_connector_runs (tenant_id, source_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists v2_connector_runs_status_heartbeat_idx
  on public.v2_connector_runs (status, heartbeat_at desc nulls last);

create or replace function public.touch_connector_run_heartbeat(
  p_run_id uuid,
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  update public.v2_connector_runs
  set
    heartbeat_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_heartbeat_at', now())
  where id = p_run_id
    and tenant_id = p_tenant_id;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function public.touch_connector_run_heartbeat(uuid, uuid) to authenticated;
grant execute on function public.touch_connector_run_heartbeat(uuid, uuid) to service_role;

create or replace function public.mark_stale_connector_runs(
  p_stale_after_minutes integer default 45
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_after integer := greatest(5, coalesce(p_stale_after_minutes, 45));
  stale_cutoff timestamptz := now() - make_interval(mins => stale_after);
  updated_count integer := 0;
begin
  update public.v2_connector_runs
  set
    status = 'stale'::public.v2_connector_run_status,
    completed_at = coalesce(completed_at, now()),
    heartbeat_at = coalesce(heartbeat_at, now()),
    error_summary = coalesce(nullif(error_summary, ''), 'Run marked stale by watchdog'),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'stale_marked_at', now(),
      'stale_after_minutes', stale_after,
      'stale_reference_at', coalesce(heartbeat_at, started_at)
    )
  where status in ('queued'::public.v2_connector_run_status, 'running'::public.v2_connector_run_status)
    and coalesce(heartbeat_at, started_at) < stale_cutoff;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.mark_stale_connector_runs(integer) to authenticated;
grant execute on function public.mark_stale_connector_runs(integer) to service_role;
