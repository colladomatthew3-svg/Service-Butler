create unique index if not exists v2_leads_tenant_opportunity_unique_idx
  on public.v2_leads(tenant_id, opportunity_id)
  where opportunity_id is not null;
