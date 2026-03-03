-- Seed data for local UI testing
-- credentials for local testing users:
-- owner@servicebutler.local / Password123!
-- dispatcher@servicebutler.local / Password123!
-- tech@servicebutler.local / Password123!

create extension if not exists pgcrypto;

do $$
declare
  v_account_id uuid := '11111111-1111-1111-1111-111111111111';
  v_contact_id uuid := '22222222-2222-2222-2222-222222222222';
  v_lead_id uuid := '33333333-3333-3333-3333-333333333333';
  v_template_id uuid := '44444444-4444-4444-4444-444444444444';

  v_owner_id uuid;
  v_dispatcher_id uuid;
  v_tech_id uuid;
begin
  select id into v_owner_id from auth.users where email = 'owner@servicebutler.local' limit 1;
  select id into v_dispatcher_id from auth.users where email = 'dispatcher@servicebutler.local' limit 1;
  select id into v_tech_id from auth.users where email = 'tech@servicebutler.local' limit 1;

  if v_owner_id is null or v_dispatcher_id is null or v_tech_id is null then
    raise exception 'Seed users are missing in auth.users. Run scripts/seed-users.mjs first.';
  end if;

  insert into public.accounts (id, name)
  values (v_account_id, 'Service Butler Demo')
  on conflict (id) do nothing;

  insert into public.account_settings (
    account_id,
    twilio_phone_number,
    review_link,
    quiet_hours_start,
    quiet_hours_end,
    business_hours
  ) values (
    v_account_id,
    '+15551234567',
    'https://g.page/r/demo/review',
    '21:00',
    '08:00',
    '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00"}'::jsonb
  )
  on conflict (account_id) do update
    set twilio_phone_number = excluded.twilio_phone_number,
        review_link = excluded.review_link,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        business_hours = excluded.business_hours;

  insert into public.users (id, account_id, email, full_name)
  values
    (v_owner_id, v_account_id, 'owner@servicebutler.local', 'Owner User'),
    (v_dispatcher_id, v_account_id, 'dispatcher@servicebutler.local', 'Dispatcher User'),
    (v_tech_id, v_account_id, 'tech@servicebutler.local', 'Tech User')
  on conflict (id) do update set
    account_id = excluded.account_id,
    email = excluded.email,
    full_name = excluded.full_name;

  insert into public.account_roles (account_id, user_id, role)
  values
    (v_account_id, v_owner_id, 'ACCOUNT_OWNER'),
    (v_account_id, v_dispatcher_id, 'DISPATCHER'),
    (v_account_id, v_tech_id, 'TECH')
  on conflict (account_id, user_id) do update set
    role = excluded.role,
    is_active = true;

  insert into public.contacts (id, account_id, first_name, last_name, phone_e164, email)
  values (v_contact_id, v_account_id, 'Alex', 'Customer', '+15557654321', 'alex.customer@example.com')
  on conflict (id) do nothing;

  insert into public.leads (id, account_id, contact_id, source, stage)
  values (v_lead_id, v_account_id, v_contact_id, 'WEB', 'NEW')
  on conflict (id) do nothing;

  insert into public.conversations (account_id, contact_id, lead_id, subject)
  values (v_account_id, v_contact_id, v_lead_id, 'Seed conversation')
  on conflict do nothing;

  insert into public.templates (id, account_id, name, channel, body)
  values (v_template_id, v_account_id, 'Default New Lead SMS', 'SMS', 'Thanks for reaching out. Reply with your preferred appointment time.')
  on conflict (id) do nothing;

  insert into public.sequences (account_id, type, name, status, stop_on_reply, stop_on_stage_change)
  values
    (v_account_id, 'MISSED_CALL_FOLLOWUP', 'Missed Call Follow-Up', 'ACTIVE', true, true),
    (v_account_id, 'NEW_LEAD_FOLLOWUP', 'New Lead Follow-Up', 'ACTIVE', true, true),
    (v_account_id, 'REVIEW_REQUEST', 'Review Request', 'ACTIVE', false, false)
  on conflict (account_id, type) do update set
    name = excluded.name,
    status = excluded.status,
    stop_on_reply = excluded.stop_on_reply,
    stop_on_stage_change = excluded.stop_on_stage_change;

  insert into public.stripe_customers (account_id, stripe_customer_id)
  values (v_account_id, 'cus_demo_123')
  on conflict (stripe_customer_id) do nothing;

  insert into public.stripe_subscriptions (account_id, stripe_subscription_id, stripe_customer_id, status, current_period_end)
  values (v_account_id, 'sub_demo_123', 'cus_demo_123', 'active', now() + interval '30 days')
  on conflict (stripe_subscription_id) do update set
    status = excluded.status,
    current_period_end = excluded.current_period_end;
end $$;
