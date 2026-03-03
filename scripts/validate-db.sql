-- quick validation checks
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'accounts','account_settings','users','account_roles','contacts','leads','jobs','conversations',
    'messages','calls','templates','campaigns','campaign_deliveries','sequences',
    'sequence_enrollments','audit_events','stripe_customers','stripe_subscriptions','webhook_events'
)
order by table_name;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'accounts','account_settings','users','account_roles','contacts','leads','jobs','conversations',
    'messages','calls','templates','campaigns','campaign_deliveries','sequences',
    'sequence_enrollments','audit_events','stripe_customers','stripe_subscriptions','webhook_events'
)
order by tablename;

select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
