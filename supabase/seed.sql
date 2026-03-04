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
    business_hours,
    home_base_city,
    home_base_state,
    home_base_postal_code,
    weather_location_label,
    weather_lat,
    weather_lng
  ) values (
    v_account_id,
    '+15551234567',
    'https://g.page/r/demo/review',
    '21:00',
    '08:00',
    '{"mon":"08:00-17:00","tue":"08:00-17:00","wed":"08:00-17:00","thu":"08:00-17:00","fri":"08:00-17:00"}'::jsonb,
    'Brentwood',
    'NY',
    '11717',
    'Brentwood, NY',
    40.7812,
    -73.2462
  )
  on conflict (account_id) do update
    set twilio_phone_number = excluded.twilio_phone_number,
        review_link = excluded.review_link,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        business_hours = excluded.business_hours,
        home_base_city = excluded.home_base_city,
        home_base_state = excluded.home_base_state,
        home_base_postal_code = excluded.home_base_postal_code,
        weather_location_label = excluded.weather_location_label,
        weather_lat = excluded.weather_lat,
        weather_lng = excluded.weather_lng;

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

  delete from public.lead_intent_signals
  where lead_id in (select id from public.leads where account_id = v_account_id and source in ('web_form', 'manual', 'import'));

  delete from public.lead_jobs where account_id = v_account_id;
  delete from public.jobs where account_id = v_account_id;

  delete from public.leads
  where account_id = v_account_id
    and source in ('web_form', 'manual', 'import');

  insert into public.leads (
    id, account_id, source, stage, status, name, phone, service_type, address, city, state, postal_code,
    requested_timeframe, notes, scheduled_for
  ) values
    ('30000000-0000-0000-0000-000000000001', v_account_id, 'web_form', 'NEW', 'new', 'James Roper', '+18135550182', 'HVAC', '124 Maple Ave', 'Brentwood', 'NY', '11717', 'Today PM', 'AC blowing warm air', null),
    ('30000000-0000-0000-0000-000000000002', v_account_id, 'manual', 'CONTACTED', 'contacted', 'Maria Fernandez', '+14075550150', 'Plumbing', '88 Cedar St', 'Islip', 'NY', '11751', 'Tomorrow AM', 'Kitchen sink backing up', null),
    ('30000000-0000-0000-0000-000000000003', v_account_id, 'web_form', 'BOOKED', 'scheduled', 'Chris Parker', '+19045550134', 'Roofing', '19 Harbor Rd', 'Bay Shore', 'NY', '11706', 'Tomorrow 9am', 'Storm leak by chimney', now() + interval '1 day'),
    ('30000000-0000-0000-0000-000000000004', v_account_id, 'import', 'CONTACTED', 'contacted', 'Lana Brooks', '+17275550198', 'Electrical', '55 Oak Ln', 'Brentwood', 'NY', '11717', 'This week', 'EV charger install quote', null),
    ('30000000-0000-0000-0000-000000000005', v_account_id, 'manual', 'NEW', 'new', 'Ethan Miles', '+16315550111', 'Plumbing', '320 Elm Dr', 'Deer Park', 'NY', '11729', 'ASAP', 'Burst pipe in laundry room', null),
    ('30000000-0000-0000-0000-000000000006', v_account_id, 'web_form', 'QUALIFIED', 'contacted', 'Sophie Diaz', '+16315550112', 'HVAC', '44 W 2nd St', 'Huntington', 'NY', '11743', 'This weekend', 'Noisy furnace', null),
    ('30000000-0000-0000-0000-000000000007', v_account_id, 'manual', 'BOOKED', 'scheduled', 'Noah Bennett', '+16315550113', 'Electrical', '9 Forest Ct', 'Commack', 'NY', '11725', 'Today 2pm', 'Breaker trips when dryer runs', now() + interval '6 hours'),
    ('30000000-0000-0000-0000-000000000008', v_account_id, 'import', 'NEW', 'new', 'Ava Stone', '+16315550114', 'Roofing', '711 Pine St', 'Patchogue', 'NY', '11772', 'Next 48h', 'Missing shingles after wind', null),
    ('30000000-0000-0000-0000-000000000009', v_account_id, 'web_form', 'COMPLETED', 'won', 'Mia Carter', '+16315550115', 'Plumbing', '88 Park Dr', 'Brentwood', 'NY', '11717', 'Completed', 'Water heater replacement done', now() - interval '2 days'),
    ('30000000-0000-0000-0000-000000000010', v_account_id, 'manual', 'LOST', 'lost', 'Liam Ortiz', '+16315550116', 'HVAC', '20 Hillview Rd', 'Ronkonkoma', 'NY', '11779', 'No rush', 'Comparing quotes', null),
    ('30000000-0000-0000-0000-000000000011', v_account_id, 'web_form', 'CONTACTED', 'contacted', 'Olivia White', '+16315550117', 'Electrical', '17 Lake Ave', 'Babylon', 'NY', '11702', 'Today', 'Outlet sparking in kitchen', null),
    ('30000000-0000-0000-0000-000000000012', v_account_id, 'import', 'BOOKED', 'scheduled', 'Elijah Green', '+16315550118', 'Roofing', '201 Meadow Ln', 'Brentwood', 'NY', '11717', 'Tomorrow 1pm', 'Flat roof pooling water', now() + interval '1 day 4 hours'),
    ('30000000-0000-0000-0000-000000000013', v_account_id, 'manual', 'NEW', 'new', 'Charlotte Hall', '+16315550119', 'HVAC', '75 Birch Rd', 'Islip Terrace', 'NY', '11752', 'Tonight', 'No heat on 2nd floor', null),
    ('30000000-0000-0000-0000-000000000014', v_account_id, 'web_form', 'CONTACTED', 'contacted', 'Mason Price', '+16315550120', 'Plumbing', '501 South St', 'Brentwood', 'NY', '11717', 'This afternoon', 'Sewer smell in basement', null),
    ('30000000-0000-0000-0000-000000000015', v_account_id, 'manual', 'BOOKED', 'scheduled', 'Amelia Shaw', '+16315550121', 'Electrical', '42 Pearl St', 'Bay Shore', 'NY', '11706', 'Friday 9am', 'Panel upgrade consult', now() + interval '3 days')
  on conflict (id) do update set
    status = excluded.status,
    stage = excluded.stage,
    name = excluded.name,
    phone = excluded.phone,
    service_type = excluded.service_type,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    requested_timeframe = excluded.requested_timeframe,
    notes = excluded.notes,
    scheduled_for = excluded.scheduled_for,
    source = excluded.source;

  insert into public.jobs (
    id, account_id, lead_id, status, pipeline_status, scheduled_for,
    service_type, assigned_user_id, assigned_tech_name, estimated_value, notes, intent_score,
    customer_name, customer_phone, address, city, state, postal_code
  ) values
    (
      '70000000-0000-0000-0000-000000000001', v_account_id, '30000000-0000-0000-0000-000000000003',
      'SCHEDULED', 'SCHEDULED', now() + interval '1 day',
      'Roofing', v_tech_id, 'Nate (Roof Crew)', 2450.00, 'Storm leak inspection and patch', 84,
      'Chris Parker', '+19045550134', '19 Harbor Rd', 'Bay Shore', 'NY', '11706'
    ),
    (
      '70000000-0000-0000-0000-000000000002', v_account_id, '30000000-0000-0000-0000-000000000007',
      'IN_PROGRESS', 'IN_PROGRESS', now() + interval '6 hours',
      'Electrical', v_dispatcher_id, 'Kim (Electrical)', 980.00, 'Breaker and outlet diagnostic in progress', 73,
      'Noah Bennett', '+16315550113', '9 Forest Ct', 'Commack', 'NY', '11725'
    ),
    (
      '70000000-0000-0000-0000-000000000003', v_account_id, '30000000-0000-0000-0000-000000000009',
      'COMPLETED', 'WON', now() - interval '2 days',
      'Plumbing', v_tech_id, 'Ari (Plumbing)', 1850.00, 'Water heater replaced, customer requested review link', 79,
      'Mia Carter', '+16315550115', '88 Park Dr', 'Brentwood', 'NY', '11717'
    ),
    (
      '70000000-0000-0000-0000-000000000004', v_account_id, '30000000-0000-0000-0000-000000000012',
      'SCHEDULED', 'CONTACTED', now() + interval '1 day 4 hours',
      'Roofing', v_dispatcher_id, 'Nate (Roof Crew)', 3200.00, 'Flat roof pooling water, estimate sent', 88,
      'Elijah Green', '+16315550118', '201 Meadow Ln', 'Brentwood', 'NY', '11717'
    ),
    (
      '70000000-0000-0000-0000-000000000005', v_account_id, '30000000-0000-0000-0000-000000000015',
      'SCHEDULED', 'SCHEDULED', now() + interval '3 days',
      'Electrical', v_dispatcher_id, 'Kim (Electrical)', 2100.00, 'Panel upgrade consult and permit planning', 69,
      'Amelia Shaw', '+16315550121', '42 Pearl St', 'Bay Shore', 'NY', '11706'
    ),
    (
      '70000000-0000-0000-0000-000000000006', v_account_id, '30000000-0000-0000-0000-000000000002',
      'SCHEDULED', 'NEW', now() + interval '18 hours',
      'Plumbing', v_tech_id, 'Ari (Plumbing)', 540.00, 'Kitchen backup, emergency snaking quote', 82,
      'Maria Fernandez', '+14075550150', '88 Cedar St', 'Islip', 'NY', '11751'
    )
  on conflict (id) do update set
    status = excluded.status,
    pipeline_status = excluded.pipeline_status,
    scheduled_for = excluded.scheduled_for,
    service_type = excluded.service_type,
    assigned_user_id = excluded.assigned_user_id,
    assigned_tech_name = excluded.assigned_tech_name,
    estimated_value = excluded.estimated_value,
    notes = excluded.notes,
    intent_score = excluded.intent_score,
    customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code;

  insert into public.lead_jobs (account_id, lead_id, job_id)
  values
    (v_account_id, '30000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001'),
    (v_account_id, '30000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000002'),
    (v_account_id, '30000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000003'),
    (v_account_id, '30000000-0000-0000-0000-000000000012', '70000000-0000-0000-0000-000000000004'),
    (v_account_id, '30000000-0000-0000-0000-000000000015', '70000000-0000-0000-0000-000000000005'),
    (v_account_id, '30000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000006')
  on conflict (account_id, lead_id) do update set
    job_id = excluded.job_id;

  update public.leads l
  set converted_job_id = lj.job_id
  from public.lead_jobs lj
  where lj.account_id = v_account_id
    and lj.lead_id = l.id;

  insert into public.conversations (account_id, contact_id, lead_id, subject)
  select v_account_id, null, l.id, 'Lead thread: ' || l.name
  from public.leads l
  where l.account_id = v_account_id
    and l.source in ('web_form', 'manual', 'import')
  on conflict do nothing;

  insert into public.lead_intent_signals (lead_id, signal_type, title, detail, score, payload)
  select
    l.id,
    s.signal_type,
    s.title,
    s.detail,
    s.score,
    s.payload
  from public.leads l
  cross join lateral (
    values
      (
        'urgency',
        case
          when l.requested_timeframe ilike '%asap%' or l.requested_timeframe ilike '%today%' then 'Urgent timeline request'
          else 'Response window is manageable'
        end,
        case
          when l.requested_timeframe ilike '%asap%' or l.requested_timeframe ilike '%today%' then 'Customer asked for immediate service. Fast callback improves close rate.'
          else 'Lead requested a standard timeframe; follow-up within the same day is still recommended.'
        end,
        case
          when l.requested_timeframe ilike '%asap%' or l.requested_timeframe ilike '%today%' then 88
          else 58
        end,
        jsonb_build_object('requested_timeframe', l.requested_timeframe)
      ),
      (
        'weather',
        case
          when l.service_type = 'Roofing' then 'Recent weather increases roof demand'
          when l.service_type = 'HVAC' then 'Temperature swings drive HVAC calls'
          else 'Weather impact is moderate'
        end,
        case
          when l.service_type = 'Roofing' then 'Forecast suggests wind/rain patterns that often trigger roofing inspections.'
          when l.service_type = 'HVAC' then 'Expected temperature changes typically increase no-cool/no-heat calls.'
          else 'Current weather likely has secondary impact on this request type.'
        end,
        case
          when l.service_type = 'Roofing' then 84
          when l.service_type = 'HVAC' then 74
          else 51
        end,
        jsonb_build_object('service_type', l.service_type)
      ),
      (
        'local_demand',
        'Local service demand trend',
        'Similar jobs in this area are trending up this week; prioritize quick first response.',
        case
          when l.city = 'Brentwood' then 72
          else 63
        end,
        jsonb_build_object('city', l.city, 'state', l.state)
      )
  ) as s(signal_type, title, detail, score, payload)
  where l.account_id = v_account_id
    and l.source in ('web_form', 'manual', 'import');

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

  insert into public.routing_rules (
    account_id, category, default_assignee, default_create_mode, default_job_value_cents, default_sla_minutes, enabled
  ) values
    (v_account_id, 'plumbing', 'Ari (Plumbing)', 'job', 85000, 45, true),
    (v_account_id, 'electrical', 'Kim (Electrical)', 'lead', 65000, 60, true),
    (v_account_id, 'landscaping', 'Field Team B', 'lead', 42000, 180, true),
    (v_account_id, 'restoration', 'Storm Crew A', 'job', 220000, 30, true),
    (v_account_id, 'general', 'Dispatch Queue', 'lead', 35000, 90, true)
  on conflict (account_id, category) do update set
    default_assignee = excluded.default_assignee,
    default_create_mode = excluded.default_create_mode,
    default_job_value_cents = excluded.default_job_value_cents,
    default_sla_minutes = excluded.default_sla_minutes,
    enabled = excluded.enabled;

  delete from public.scanner_events where account_id = v_account_id and source in ('demo', 'weather', 'public_feed');

  insert into public.scanner_events (
    account_id, source, category, title, description, location_text, lat, lon, intent_score, confidence, tags, raw
  ) values
    (
      v_account_id, 'weather', 'restoration',
      'Flash flood advisory near Brentwood',
      'NWS alert indicates localized flood risk in low-lying streets. Sump and water extraction demand likely to spike.',
      'Brentwood, NY', 40.7812, -73.2462, 89, 85,
      array['flood', 'urgent', 'weather'],
      jsonb_build_object('source_id', 'seed-weather-1', 'severity', 'moderate')
    ),
    (
      v_account_id, 'public_feed', 'electrical',
      'Grid disturbance report',
      'Regional outage chatter suggests follow-up demand for panel checks and surge diagnostics.',
      'Bay Shore, NY', 40.7251, -73.2454, 72, 67,
      array['outage', 'panel', 'diagnostic'],
      jsonb_build_object('source_id', 'seed-feed-1', 'confidence_reason', 'incident-density')
    ),
    (
      v_account_id, 'demo', 'plumbing',
      'Burst pipe keyword spike in Islip',
      'Multiple homeowner posts mention basement water and frozen lines in the last 2 hours.',
      'Islip, NY', 40.7304, -73.2109, 83, 74,
      array['burst-pipe', 'asap', 'local-demand'],
      jsonb_build_object('source_id', 'seed-demo-1', 'keywords', array['burst pipe', 'water in basement'])
    ),
    (
      v_account_id, 'demo', 'landscaping',
      'Tree limb cleanup demand after wind gusts',
      'High-wind burst likely created short-term cleanup jobs in residential zones.',
      'Huntington, NY', 40.8682, -73.4260, 64, 62,
      array['wind', 'cleanup', 'same-day'],
      jsonb_build_object('source_id', 'seed-demo-2', 'gust_kph', 46)
    ),
    (
      v_account_id, 'demo', 'general',
      'Weekend handyman demand lift',
      'Search and review volume suggests homeowners are booking miscellaneous repair visits.',
      'Patchogue, NY', 40.7657, -73.0151, 58, 59,
      array['weekend', 'general-repair'],
      jsonb_build_object('source_id', 'seed-demo-3', 'pattern', 'review-spike')
    );
end $$;
