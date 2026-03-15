create or replace function public.match_territory_by_point(
  p_lat double precision,
  p_lng double precision
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
security invoker
set search_path = public
as $$
  with point_input as (
    select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as g
  ),
  latest_versions as (
    select distinct on (tv.territory_id)
      tv.territory_id,
      tv.version_no,
      tv.geometry
    from public.v2_territory_versions tv
    join public.v2_territories t on t.id = tv.territory_id
    where t.active = true
    order by tv.territory_id, tv.version_no desc
  ),
  candidates as (
    select
      t.id as territory_id,
      t.name as territory_name,
      t.tenant_id as territory_tenant_id,
      lv.version_no as matched_version_no,
      coalesce(lv.geometry, t.geometry) as geometry
    from public.v2_territories t
    left join latest_versions lv on lv.territory_id = t.id
    where t.active = true
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
  order by
    coalesce(c.matched_version_no, 0) desc,
    c.territory_id
  limit 1;
$$;

grant execute on function public.match_territory_by_point(double precision, double precision) to authenticated;
grant execute on function public.match_territory_by_point(double precision, double precision) to service_role;
