create index if not exists v2_territory_versions_geometry_gix on public.v2_territory_versions using gist(geometry);

create or replace function public.match_territory_by_point(
  p_tenant_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_service_line text default null
)
returns table (
  territory_id uuid,
  territory_name text,
  territory_tenant_id uuid,
  matched_version_no integer,
  match_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with point_input as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  latest_versions as (
    select distinct on (tv.territory_id)
      tv.territory_id,
      tv.version_no,
      tv.geometry,
      tv.service_lines
    from public.v2_territory_versions tv
    join public.v2_territories t on t.id = tv.territory_id
    where t.tenant_id = p_tenant_id
      and t.active = true
    order by tv.territory_id, tv.version_no desc
  ),
  candidates as (
    select
      t.id as territory_id,
      t.name as territory_name,
      t.tenant_id as territory_tenant_id,
      lv.version_no as matched_version_no,
      coalesce(lv.geometry, t.geometry) as geometry,
      coalesce(lv.service_lines, t.service_lines) as service_lines
    from public.v2_territories t
    left join latest_versions lv on lv.territory_id = t.id
    where t.tenant_id = p_tenant_id
      and t.active = true
  )
  select
    c.territory_id,
    c.territory_name,
    c.territory_tenant_id,
    c.matched_version_no,
    case when c.matched_version_no is null then 'territory_base' else 'territory_version' end as match_source
  from candidates c
  cross join point_input p
  where c.geometry is not null
    and ST_Intersects(c.geometry, p.g)
    and (
      p_service_line is null
      or coalesce(array_length(c.service_lines, 1), 0) = 0
      or p_service_line = any(c.service_lines)
      or 'general' = any(c.service_lines)
    )
  order by
    coalesce(c.matched_version_no, 0) desc,
    c.territory_id
  limit 1;
$$;

grant execute on function public.match_territory_by_point(uuid, double precision, double precision, text) to authenticated;
grant execute on function public.match_territory_by_point(uuid, double precision, double precision, text) to service_role;
