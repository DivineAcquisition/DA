-- Prompt 9B: live GHL activity, exact attribution, human versus automated, and
-- speed-to-lead routing, exercised against the real functions. Self-contained:
-- it builds its own clients, VAs and GHL users, and every block asserts.
--
-- Events enter through public.ghl_ingest_polled(), the same door the
-- conversation poller uses, and through ingest_receive() for the webhook door.
\set ON_ERROR_STOP on
set search_path = public;

-- Everything below runs in one transaction that is rolled back, so the suite can
-- be repeated against the same database and leaves nothing behind.
begin;

-- Fixture helpers --------------------------------------------------------------
create or replace function pg_temp.mk_va(p_n int, p_name text) returns uuid language plpgsql as $$
declare v_uid uuid := ('b9000000-0000-0000-0000-00000000000' || p_n)::uuid; v_op uuid := ('11111111-9000-0000-0000-00000000000' || p_n)::uuid;
begin
  insert into auth.users (id, email) values (v_uid, 'va' || p_n || '@example.com');
  update public.profile set role = 'operator', state = 'active', full_name = p_name where id = v_uid;
  insert into public.operator (id, name, email, status, base_monthly, profile_id) values (v_op, p_name, 'va' || p_n || '@example.com', 'placed', 600, v_uid);
  return v_op;
end $$;

create or replace function pg_temp.place(p_n int, p_op uuid, p_case uuid, p_start text, p_end text) returns uuid language plpgsql as $$
declare v_id uuid := ('22222222-9000-0000-0000-00000000000' || p_n)::uuid;
begin
  insert into public.placement (id, operator_id, case_file_id, start_date, end_date, status, monthly_booking_quota, commission_per_booking,
    client_rate_per_booking, response_standard_minutes, shift_start, shift_end, time_zone, working_days)
  values (v_id, p_op, p_case, current_date - 30, current_date + 30, 'active', 20, 15, 60, 5, p_start, p_end, 'UTC', '{1,2,3,4,5,6,7}');
  return v_id;
end $$;

create or replace function pg_temp.feed(p_case uuid, p_events jsonb) returns jsonb language sql as $$
  select public.ghl_ingest_polled(p_case, p_events, null);
$$;

\echo '== fixtures =='
do $$
declare
  v_x uuid := 'cccccccc-9000-0000-0000-000000000001';
  v_y uuid := 'cccccccc-9000-0000-0000-000000000002';
  v_op1 uuid; v_op2 uuid; v_op3 uuid;
  v_off_start text := to_char((now() at time zone 'UTC') + interval '3 hours', 'HH24:MI');
  v_off_end text := to_char((now() at time zone 'UTC') + interval '5 hours', 'HH24:MI');
begin
  insert into auth.users (id, email) values ('aaaaaaaa-9000-0000-0000-000000000001', 'ghl-admin@divineacquisition.io');
  update public.profile set role = 'admin', state = 'active', full_name = 'GHL Admin' where id = 'aaaaaaaa-9000-0000-0000-000000000001';

  insert into public.client_case_file (id, name, slug, status) values
    (v_x, 'Novara Cleaning', 'novara-cleaning-9b', 'active'),
    (v_y, 'Harbor Dental', 'harbor-dental-9b', 'active');

  v_op1 := pg_temp.mk_va(1, 'Joy Mensah');
  v_op2 := pg_temp.mk_va(2, 'Ana Cruz');
  v_op3 := pg_temp.mk_va(3, 'Night Owl');
  perform pg_temp.place(1, v_op1, v_x, '00:00', '23:59');
  perform pg_temp.place(2, v_op2, v_x, '00:00', '23:59');
  perform pg_temp.place(3, v_op3, v_y, v_off_start, v_off_end);

  insert into public.ghl_location (case_file_id, location_id, location_name, location_time_zone, is_test) values
    (v_x, 'LOC-X', 'Novara Cleaning', 'UTC', true), (v_y, 'LOC-Y', 'Harbor Dental', 'UTC', true);

  -- GHL users: two VAs, DA staff (the admin), the client's front desk. 'g-unknown' is deliberately absent.
  insert into public.ghl_user (ghl_user_id, profile_id, name) values
    ('g-va1', 'b9000000-0000-0000-0000-000000000001', 'Joy Mensah'),
    ('g-va2', 'b9000000-0000-0000-0000-000000000002', 'Ana Cruz'),
    ('g-va3', 'b9000000-0000-0000-0000-000000000003', 'Night Owl'),
    ('g-admin', 'aaaaaaaa-9000-0000-0000-000000000001', 'GHL Admin');
  insert into public.ghl_user (ghl_user_id, name, known_kind, known_case_file_id) values ('g-front-desk', 'Front Desk', 'client_staff', v_x);
end $$;

do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false); end $$;

\echo '== the readiness guard still stops a placement on a sub-account that is not ready =='
alter table public.placement enable trigger placement_ghl_ready;
do $$
begin
  begin
    update public.placement set status = 'draft' where id = '22222222-9000-0000-0000-000000000001';
    update public.placement set status = 'active' where id = '22222222-9000-0000-0000-000000000001';
    raise exception 'guard did not fire';
  exception when check_violation then null; end;
  update public.placement set status = 'active' where id = '22222222-9000-0000-0000-000000000001';
end $$;
alter table public.placement disable trigger placement_ghl_ready;

\echo '== a per-client door: bad signature refused and logged, good one logged first, duplicate recognised, replay works =='
do $$
declare
  v jsonb; v_key text; v_secret text; r jsonb; r2 jsonb; v_event uuid;
begin
  -- The admin has just confirmed their password (step-up), as the screen asks.
  insert into public.step_up_verification (profile_id, purpose, expires_at)
  values ('aaaaaaaa-9000-0000-0000-000000000001', 'set up GHL live activity', now() + interval '10 minutes');
  v := public.ghl_setup_activity_endpoint('cccccccc-9000-0000-0000-000000000001');
  v_key := regexp_replace(v ->> 'path', '^/api/webhooks/ghl/', '');
  v_secret := v ->> 'secret';
  assert v ->> 'path' like '/api/webhooks/ghl/%' and length(v_secret) = 64, 'the admin is shown the address and the secret once';
  assert (select ingest_endpoint_id from public.ghl_location where case_file_id = 'cccccccc-9000-0000-0000-000000000001') is not null;

  assert (public.ingest_receive(v_key, '{"type":"ContactCreate"}', 'wrong') ->> 'ok')::boolean = false, 'a bad secret is refused';
  assert exists (select 1 from public.ingest_auth_failure where endpoint_key = v_key and reason = 'bad_secret'), 'and logged as an auth failure';

  r := public.ingest_receive(v_key, '{"type":"ContactCreate","contactId":"hook-1","locationId":"LOC-X","dateAdded":"2026-10-01T10:00:00Z"}', v_secret);
  assert (r ->> 'ok')::boolean and not (r ->> 'duplicate')::boolean, 'a good delivery is accepted';
  v_event := (r ->> 'event_id')::uuid;
  assert (select raw_body from public.ingest_event where id = v_event) like '%hook-1%', 'the raw body is on record before anything else';
  r2 := public.ingest_receive(v_key, '{"type":"ContactCreate","contactId":"hook-1","locationId":"LOC-X","dateAdded":"2026-10-01T10:00:00Z"}', v_secret);
  assert (r2 ->> 'duplicate')::boolean, 'the same delivery again is recognised';
  assert (select count(*) from public.ingest_event where case_file_id = 'cccccccc-9000-0000-0000-000000000001' and external_event_id is null
          and raw_body like '%hook-1%') <= 1, 'and never stored twice';
end $$;

\echo '== routing 10, 11: one VA gets it; with two on shift, leads alternate =='
do $$
declare
  a text; b text; c text;
begin
  -- Only the first VA is available at first.
  update public.placement set status = 'draft' where id = '22222222-9000-0000-0000-000000000002';
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-r1','contactId','c-r1','direction','inbound','dateAdded', now() - interval '1 minute')));
  assert (select p.operator_id from public.lead_routing lr join public.placement p on p.id = lr.placement_id
          join public.lead l on l.id = lr.lead_id where l.external_id = 'c-r1') = '11111111-9000-0000-0000-000000000001',
    'with one VA on shift the lead is theirs';
  assert exists (select 1 from public.lead_routing_decision d join public.lead l on l.id = d.lead_id
                 where l.external_id = 'c-r1' and d.reason like '%only eligible VA%' and jsonb_array_length(d.candidates) = 1), 'the decision is logged with who was eligible and why (15)';
  assert exists (select 1 from public.ghl_job where kind = 'assign_owner' and payload ->> 'lead_id' = (select id::text from public.lead where external_id = 'c-r1')),
    'setting the owner in GHL is queued for the poller';
  -- The ping: in the app, with a respond-by time, no customer detail.
  assert exists (select 1 from public.operator_notification n where n.operator_id = '11111111-9000-0000-0000-000000000001'
                   and n.title ~ '^New lead for Novara Cleaning, respond by \d{1,2}:\d{2} [AP]M$'), 'the ping names the client and the respond-by time';
  assert not exists (select 1 from public.operator_notification n where n.kind = 'lead_routed' and (n.body ilike '%c-r1%' or n.title ilike '%c-r1%')), 'and no customer detail';

  update public.placement set status = 'active' where id = '22222222-9000-0000-0000-000000000002';
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-r2','contactId','c-r2','direction','inbound','dateAdded', now() - interval '1 minute'),
                      jsonb_build_object('type','InboundMessage','messageId','m-r3','contactId','c-r3','direction','inbound','dateAdded', now() - interval '1 minute')));
  select string_agg(p.operator_id::text, ',' order by l.external_id) into a
  from public.lead_routing lr join public.placement p on p.id = lr.placement_id join public.lead l on l.id = lr.lead_id where l.external_id in ('c-r2', 'c-r3');
  assert (select count(distinct p.operator_id) from public.lead_routing lr join public.placement p on p.id = lr.placement_id
          join public.lead l on l.id = lr.lead_id where l.external_id in ('c-r2', 'c-r3')) = 2, 'two leads, two VAs on shift: they alternate';
end $$;

\echo '== routing 12: a notified absence is skipped =='
do $$
declare v_lead uuid;
begin
  insert into public.shift_attendance (placement_id, operator_id, shift_date, status, notice_at)
  values ('22222222-9000-0000-0000-000000000002', '11111111-9000-0000-0000-000000000002', (now() at time zone 'UTC')::date, 'notified_absence', now());
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-r4','contactId','c-r4','direction','inbound','dateAdded', now() - interval '1 minute'),
                      jsonb_build_object('type','InboundMessage','messageId','m-r5','contactId','c-r5','direction','inbound','dateAdded', now() - interval '1 minute')));
  assert (select count(*) from public.lead_routing lr join public.placement p on p.id = lr.placement_id join public.lead l on l.id = lr.lead_id
          where l.external_id in ('c-r4', 'c-r5') and p.operator_id = '11111111-9000-0000-0000-000000000001') = 2, 'both go to the VA who is not absent';
  select id into v_lead from public.lead where external_id = 'c-r4';
  assert exists (select 1 from public.lead_routing_decision d, jsonb_array_elements(d.candidates) c
                 where d.lead_id = v_lead and c ->> 'skipped' like 'away%'), 'the log says why the other VA was skipped';
  delete from public.shift_attendance where placement_id = '22222222-9000-0000-0000-000000000002';
end $$;

\echo '== routing 13: nobody on shift goes to the after-hours queue, is assigned at shift start, and counts against no one =='
do $$
declare v_lead public.lead;
begin
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-ah1','contactId','c-ah1','direction','inbound','dateAdded', now() - interval '30 minutes')));
  select * into v_lead from public.lead where external_id = 'c-ah1';
  assert (select state from public.lead_routing where lead_id = v_lead.id) = 'after_hours', 'queued, not assigned';
  assert (select operator_id from public.lead_routing where lead_id = v_lead.id) is null, 'no VA owns it yet';
  assert not v_lead.counts_toward_response, 'it never counts toward response time';
  assert not exists (select 1 from public.operator_notification where operator_id = '11111111-9000-0000-0000-000000000003'), 'nobody was pinged';

  -- The shift starts: the minute sweep assigns it.
  update public.placement set shift_start = '00:00', shift_end = '23:59' where id = '22222222-9000-0000-0000-000000000003';
  perform set_config('request.jwt.claim.sub', '', false);
  perform app.ghl_minute_sweep();
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false);
  assert (select state from public.lead_routing where lead_id = v_lead.id) = 'assigned', 'assigned at the next shift start';
  assert (select operator_id from public.lead_routing where lead_id = v_lead.id) = '11111111-9000-0000-0000-000000000003', 'to the first VA on shift';
  assert not (select counts_toward_response from public.lead where id = v_lead.id), 'and still not counted against them';
  assert (select coalesce(sum(conversations), 0) from public.response_day where placement_id = '22222222-9000-0000-0000-000000000003') = 0, 'the daily response figures exclude it';
end $$;

\echo '== routing 14: reminder, then manager alert, at the configured times =='
do $$
declare v_lead uuid;
begin
  select id into v_lead from public.lead where external_id = 'c-r1';
  perform set_config('request.jwt.claim.sub', '', false);
  update public.lead_routing set assigned_at = now() - interval '3 minutes', reminded_at = null, manager_alerted_at = null where lead_id = v_lead;
  perform app.ghl_minute_sweep();
  assert (select reminded_at from public.lead_routing where lead_id = v_lead) is null, 'nothing before the reminder time (4 min)';
  update public.lead_routing set assigned_at = now() - interval '5 minutes' where lead_id = v_lead;
  perform app.ghl_minute_sweep();
  assert (select reminded_at from public.lead_routing where lead_id = v_lead) is not null, 'the VA is reminded after 4 minutes';
  assert (select manager_alerted_at from public.lead_routing where lead_id = v_lead) is null, 'the manager is not alerted yet';
  assert exists (select 1 from public.operator_notification where kind = 'lead_reminder' and operator_id = '11111111-9000-0000-0000-000000000001'), 'the reminder is in the VA''s app';
  update public.lead_routing set assigned_at = now() - interval '9 minutes' where lead_id = v_lead;
  perform app.ghl_minute_sweep();
  assert (select manager_alerted_at from public.lead_routing where lead_id = v_lead) is not null, 'then the manager is alerted';
  assert exists (select 1 from public.staff_notification where kind = 'lead_unanswered'), 'in the app';
  assert (select placement_id from public.lead_routing where lead_id = v_lead) = '22222222-9000-0000-0000-000000000001', 'and nothing was reassigned without a rule an admin turned on';
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false);
end $$;

\echo '== attribution 4, 5, 6: exact by GHL user; automated recorded and never counted; client staff apart from VAs =='
do $$
declare
  v_lead public.lead; v_t record;
begin
  -- A lead arrives 10 minutes ago.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-a-in','contactId','c-attr','phone','+15550100','direction','inbound','dateAdded', now() - interval '10 minutes')));
  select * into v_lead from public.lead where external_id = 'c-attr';

  -- 5: an automated workflow text two minutes later.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','OutboundMessage','messageId','m-a-wf','contactId','c-attr','direction','outbound',
      'source','workflow','messageType','TYPE_SMS','dateAdded', now() - interval '8 minutes')));
  select * into v_t from public.lead_touch where ingest_event_id = (select id from public.ingest_event where external_event_id = 'm-a-wf');
  assert v_t.actor_kind = 'automated' and v_t.is_human is false, 'the workflow text is recorded as automated';
  assert (select first_touch_at from public.lead where id = v_lead.id) is null, 'and does not stamp first touch';
  assert (select response_minutes from public.lead where id = v_lead.id) is null, 'or response time';

  -- 4: the VA replies from GHL, identified by user id.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','OutboundMessage','messageId','m-a-va','contactId','c-attr','direction','outbound',
      'userId','g-va2','source','app','messageType','TYPE_SMS','dateAdded', now() - interval '6 minutes')));
  select * into v_t from public.lead_touch where ingest_event_id = (select id from public.ingest_event where external_event_id = 'm-a-va');
  assert v_t.actor_kind = 'va' and v_t.attribution = 'exact' and v_t.ghl_user_id = 'g-va2', 'the reply is the VA''s, matched on the GHL user id';
  assert v_t.actor_profile_id = 'b9000000-0000-0000-0000-000000000002' and v_t.placement_id = '22222222-9000-0000-0000-000000000002', 'on the placement for that client';
  select * into v_lead from public.lead where id = v_lead.id;
  assert v_lead.first_touch_kind = 'va' and v_lead.first_touch_profile_id = 'b9000000-0000-0000-0000-000000000002', 'it is the lead''s first touch';
  assert round(v_lead.response_minutes) = 4, 'response time runs from lead-in to the first human touch (4 min), not the automation';

  -- 6: the client's front desk replies on a different lead.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-c-in','contactId','c-client','direction','inbound','dateAdded', now() - interval '9 minutes'),
                      jsonb_build_object('type','OutboundMessage','messageId','m-c-out','contactId','c-client','direction','outbound',
      'userId','g-front-desk','source','app','messageType','TYPE_SMS','dateAdded', now() - interval '8 minutes')));
  select * into v_t from public.lead_touch where ingest_event_id = (select id from public.ingest_event where external_event_id = 'm-c-out');
  assert v_t.actor_kind = 'client' and v_t.placement_id is null and v_t.actor_profile_id is null, 'a client staff reply is a client touch, not a VA touch';

  -- DA staff are a staff touch.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-s-in','contactId','c-staff','direction','inbound','dateAdded', now() - interval '9 minutes'),
                      jsonb_build_object('type','OutboundMessage','messageId','m-s-out','contactId','c-staff','direction','outbound',
      'userId','g-admin','source','app','messageType','TYPE_SMS','dateAdded', now() - interval '8 minutes')));
  select * into v_t from public.lead_touch where ingest_event_id = (select id from public.ingest_event where external_event_id = 'm-s-out');
  assert v_t.actor_kind = 'staff' and v_t.placement_id is null, 'a manager or admin reply is a staff touch';
end $$;

\echo '== standards: staff, client and automated touches are never a VA''s response time =='
do $$
declare v_item record; v_day date := (now() at time zone 'UTC')::date;
begin
  select * into v_item from app.va_response_items('11111111-9000-0000-0000-000000000001', date_trunc('month', now())::date) i
  join public.lead l on l.id = i.lead_id where l.external_id = 'c-client' limit 1;
  -- The client lead was routed to someone; whoever it was, the client's own answer is not theirs.
  assert (select count(*) from app.va_response_items('11111111-9000-0000-0000-000000000001', date_trunc('month', now())::date) i
          join public.lead l on l.id = i.lead_id where l.external_id in ('c-client', 'c-staff') and i.counted) = 0
    and (select count(*) from app.va_response_items('11111111-9000-0000-0000-000000000002', date_trunc('month', now())::date) i
          join public.lead l on l.id = i.lead_id where l.external_id in ('c-client', 'c-staff') and i.counted) = 0,
    'a lead answered first by the client or by DA staff counts for no VA';
  assert exists (select 1 from app.va_response_items('11111111-9000-0000-0000-000000000001', date_trunc('month', now())::date) i
                 join public.lead l on l.id = i.lead_id where l.external_id in ('c-client', 'c-staff') and i.excluded_reason like 'Answered first by %'
                 union all
                 select 1 from app.va_response_items('11111111-9000-0000-0000-000000000002', date_trunc('month', now())::date) i
                 join public.lead l on l.id = i.lead_id where l.external_id in ('c-client', 'c-staff') and i.excluded_reason like 'Answered first by %'), 'with the reason shown to the VA';
  assert exists (select 1 from app.va_response_items('11111111-9000-0000-0000-000000000002', date_trunc('month', now())::date) i
                 join public.lead l on l.id = i.lead_id where l.external_id = 'c-attr' and i.counted and i.hit), 'while the VA who really answered is credited';
end $$;

\echo '== attribution 7: an unknown GHL user is unattributed, flagged, and never guessed =='
do $$
declare v_t record; v_health jsonb; v_un jsonb;
begin
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-u-in','contactId','c-unk','direction','inbound','dateAdded', now() - interval '9 minutes'),
                      jsonb_build_object('type','OutboundMessage','messageId','m-u-out','contactId','c-unk','direction','outbound',
      'userId','g-unknown','source','app','messageType','TYPE_SMS','dateAdded', now() - interval '7 minutes')));
  select * into v_t from public.lead_touch where ingest_event_id = (select id from public.ingest_event where external_event_id = 'm-u-out');
  assert v_t.actor_kind = 'unattributed' and v_t.attribution = 'none' and v_t.actor_profile_id is null and v_t.placement_id is null,
    'recorded as unattributed, credited to nobody';
  v_health := public.ghl_activity_health();
  assert (select (x -> 'unrecognised_users') ? 'g-unknown' from jsonb_array_elements(v_health) x where x ->> 'name' = 'Novara Cleaning'), 'flagged in the health view';
  assert (select (x ->> 'unattributed_24h')::int >= 1 from jsonb_array_elements(v_health) x where x ->> 'name' = 'Novara Cleaning'), 'and counted there';
  v_un := public.ghl_unattributed();
  assert exists (select 1 from jsonb_array_elements(v_un -> 'users') u where u ->> 'ghl_user_id' = 'g-unknown' and (u ->> 'touches')::int = 1), 'and listed on the unattributed screen';
  assert (select count(*) from public.lead_touch_resolution) = 0, 'nothing was resolved by guesswork';
end $$;

\echo '== attribution 7, resolved: an admin maps the user to a person and the past is re-attributed =='
do $$
declare v_r jsonb; v_lead public.lead;
begin
  -- The unknown user turns out to be the second VA's other login.
  begin
    perform public.ghl_resolve_user('g-unknown', 'person', 'b9000000-0000-0000-0000-000000000002', null);
    raise exception 'a person who already has a GHL user must be refused';
  exception when unique_violation then null; end;
  update public.ghl_user set profile_id = null where ghl_user_id = 'g-va2';
  v_r := public.ghl_resolve_user('g-unknown', 'person', 'b9000000-0000-0000-0000-000000000002', null);
  assert (v_r ->> 'touches')::int = 1 and (v_r ->> 'leads')::int = 1, 'one touch re-attributed on one lead';
  select * into v_lead from public.lead where external_id = 'c-unk';
  assert v_lead.first_touch_kind = 'va' and v_lead.first_touch_profile_id = 'b9000000-0000-0000-0000-000000000002', 'the lead''s first touch now belongs to that VA';
  assert (select actor_kind from app.touch_eff where ghl_user_id = 'g-unknown' and direction = 'outbound') = 'va', 'through the overlay';
  assert (select actor_kind from public.lead_touch where ghl_user_id = 'g-unknown' and direction = 'outbound') = 'unattributed', 'the original record is untouched';
  begin
    update public.lead_touch_resolution set reason = 'x';
    raise exception 'resolutions must be append only';
  exception when others then if sqlerrm = 'resolutions must be append only' then raise; end if; end;
  assert not exists (select 1 from jsonb_array_elements(public.ghl_unattributed() -> 'users') u where u ->> 'ghl_user_id' = 'g-unknown'), 'it leaves the unattributed screen';
  -- Marking a user as the client's staff also resolves their history.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-k-in','contactId','c-k','direction','inbound','dateAdded', now() - interval '9 minutes'),
                      jsonb_build_object('type','OutboundMessage','messageId','m-k-out','contactId','c-k','direction','outbound',
      'userId','g-new-desk','source','app','dateAdded', now() - interval '7 minutes')));
  assert (select actor_kind from app.touch_eff where ghl_user_id = 'g-new-desk') = 'unattributed';
  perform public.ghl_resolve_user('g-new-desk', 'client_staff', null, 'cccccccc-9000-0000-0000-000000000001');
  assert (select actor_kind from app.touch_eff where ghl_user_id = 'g-new-desk' and direction = 'outbound') = 'client', 'a user marked as client staff has their history re-attributed to the client';
  assert (select first_touch_kind from public.lead where external_id = 'c-k') = 'client';
end $$;

\echo '== response 8: an out-of-order event recalculates response minutes =='
do $$
declare v_lead public.lead; v_in timestamptz := now() - interval '20 minutes';
begin
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-o-in','contactId','c-ooo','direction','inbound','dateAdded', v_in),
                      jsonb_build_object('type','OutboundMessage','messageId','m-o-late','contactId','c-ooo','direction','outbound',
                        'userId','g-va1','source','app','dateAdded', v_in + interval '9 minutes')));
  select * into v_lead from public.lead where external_id = 'c-ooo';
  assert round(v_lead.response_minutes) = 9, 'first the later reply stamps 9 minutes';
  -- An earlier reply arrives afterwards.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','OutboundMessage','messageId','m-o-early','contactId','c-ooo','direction','outbound',
                        'userId','g-va1','source','app','dateAdded', v_in + interval '3 minutes')));
  select * into v_lead from public.lead where external_id = 'c-ooo';
  assert round(v_lead.response_minutes) = 3, 'the earlier one takes its place: 3 minutes';
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','OutboundMessage','messageId','m-o-later','contactId','c-ooo','direction','outbound',
                        'userId','g-va1','source','app','dateAdded', v_in + interval '15 minutes')));
  assert round((select response_minutes from public.lead where external_id = 'c-ooo')) = 3, 'a later one never overwrites it';
  -- An earlier lead-in (the contact was created first) lengthens it honestly.
  perform pg_temp.feed('cccccccc-9000-0000-0000-000000000001',
    jsonb_build_array(jsonb_build_object('type','InboundMessage','messageId','m-o-in0','contactId','c-ooo','direction','inbound','dateAdded', v_in - interval '2 minutes')));
  assert round((select response_minutes from public.lead where external_id = 'c-ooo')) = 5, 'an earlier lead-in time is honoured';
end $$;

\echo '== speed to lead 9: a connected sub-account that goes silent during business hours alerts =='
do $$
declare v_z uuid := 'cccccccc-9000-0000-0000-000000000003'; v_op uuid;
begin
  insert into public.client_case_file (id, name, slug, status) values (v_z, 'Quiet Roofing', 'quiet-roofing-9b', 'active');
  v_op := pg_temp.mk_va(4, 'Day Shift');
  perform pg_temp.place(4, v_op, v_z, '00:00', '23:59');
  insert into public.ghl_location (case_file_id, location_id, is_test, linked_at) values (v_z, 'LOC-Z', true, now() - interval '5 hours');
  insert into public.ghl_connection (level, case_file_id, location_id, label, secret_id, token_last4, status)
  values ('location', v_z, 'LOC-Z', 'Quiet Roofing', gen_random_uuid(), 'abcd', 'healthy');
  perform set_config('request.jwt.claim.sub', '', false);
  perform app.ghl_minute_sweep();
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false);
  assert exists (select 1 from public.staff_notification where kind = 'ghl.silence' and title like '%Quiet Roofing%'), 'admins are alerted';
  assert (select silence_alerted_at from public.ghl_location where case_file_id = v_z) is not null, 'once per episode';
  perform set_config('request.jwt.claim.sub', '', false);
  perform app.ghl_minute_sweep();
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false);
  assert (select count(*) from public.staff_notification where kind = 'ghl.silence' and title like '%Quiet Roofing%') = (select count(distinct recipient_profile_id) from public.staff_notification where kind = 'ghl.silence' and title like '%Quiet Roofing%'), 'and not again on the next minute';
end $$;

\echo '== accountability 16: the shift draft fills from GHL-attributed activity, not the shift window =='
do $$
declare
  v_pl public.placement; v_w1 jsonb; v_w2 jsonb;
begin
  -- Both VAs on Novara are on shift all day, which the old shift-window rule could not tell apart.
  select * into v_pl from public.placement where id = '22222222-9000-0000-0000-000000000001';
  v_w1 := app.window_activity(v_pl, now() - interval '1 day', now() + interval '1 hour');
  select * into v_pl from public.placement where id = '22222222-9000-0000-0000-000000000002';
  v_w2 := app.window_activity(v_pl, now() - interval '1 day', now() + interval '1 hour');

  -- VA1 sent: c-ooo (three replies). VA2 sent: c-attr, and c-unk after it was mapped to them.
  assert (v_w1 ->> 'touches_outbound')::int = 3, 'VA1 is credited their three replies, nothing else: ' || (v_w1 ->> 'touches_outbound');
  assert (v_w2 ->> 'touches_outbound')::int = 2, 'VA2 is credited their two (one resolved by mapping): ' || (v_w2 ->> 'touches_outbound');
  assert (v_w1 ->> 'conversations')::int = 1 and (v_w2 ->> 'conversations')::int = 2, 'conversations count only the leads each VA really touched';
  assert (select count(*) from app.touch_eff where actor_kind = 'va' and placement_id is null) = 0, 'every VA touch GHL names is on that VA''s placement, so the shift window is never consulted for one';
  assert (v_w1 ->> 'answered_by_others')::int + (v_w2 ->> 'answered_by_others')::int >= 1, 'leads the client or DA staff answered are set aside, and counted';
  -- Not one automated, staff, client or unknown touch is in either figure.
  assert (select count(*) from app.touch_eff where actor_kind in ('automated', 'staff', 'client', 'unattributed') and placement_id is not null) = 0,
    'no automated, staff, client or unknown touch is ever tagged to a placement';
end $$;

\echo '== a VA sees only their own lead alerts =='
do $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'b9000000-0000-0000-0000-000000000002', false);
  v := public.portal_ghl();
  assert not exists (select 1 from jsonb_array_elements(v -> 'leads') l where l ->> 'lead_id' in
    (select lr.lead_id::text from public.lead_routing lr where lr.operator_id <> '11111111-9000-0000-0000-000000000002')), 'no one else''s leads';
  assert v::text not like '%/api/webhooks%' and v::text not like '%secret%', 'no endpoints or secrets';
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-9000-0000-0000-000000000001', false);
end $$;

\echo
rollback;
\echo 'ALL GHL ACTIVITY ASSERTIONS PASSED'
