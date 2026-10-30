-- Client report payload, approval, token, and delivery boundaries. No live email.
\set ON_ERROR_STOP on
set search_path = public;
begin;

create temp table ids (k text primary key, v uuid) on commit drop;
create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, true);
$$;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  v_uid uuid := '10200000-0000-4000-8000-0000000000c1';
  v_op uuid := '10200000-0000-4000-8000-0000000001c1';
  v_enr uuid;
  v_id uuid;
  v_report uuid;
  v_day date := current_date;
  v_json jsonb;
  v_token text;
  v_open jsonb;
  v_key text;
begin
  insert into auth.users (id, email) values
    ('10200000-0000-4000-8000-0000000000a1', 'report-admin@so.test'),
    ('10200000-0000-4000-8000-0000000000b1', 'report-manager@so.test'),
    (v_uid, 'report-op@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'Report Admin' where id = '10200000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Report Manager', email = 'report-manager@so.test' where id = '10200000-0000-4000-8000-0000000000b1';
  update public.profile set role = 'operator', state = 'active', full_name = 'Report Op' where id = v_uid;
  insert into public.operator (id, profile_id, name, email, status) values (v_op, v_uid, 'Alex Rivera', 'report-op@so.test', 'certified');
  insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
  values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
  insert into public.academy_certification (enrollment_id, profile_id, level) values (v_enr, v_uid, 1);
  insert into public.client_case_file (id, name, slug, contact_name, contact_email)
  values ('10200000-0000-4000-8000-0000000000d1', 'Bay Area Cleaning Pros', 'so-report-client', 'Casey Client', 'casey@bayarea.test');

  perform pg_temp.as_user('10200000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(jsonb_build_object(
    'operator_id', v_op, 'case_file_id', '10200000-0000-4000-8000-0000000000d1',
    'placement_type', 'client_placed', 'manager_profile_id', '10200000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 14, 'time_zone', 'UTC',
    'working_days', '[1,2,3,4,5,6,7]'::jsonb, 'shift_start', '00:00', 'shift_end', '23:59',
    'eod_deadline', '23:59', 'campaign_summary', 'Report test.',
    'activity_categories', '["outbound_calling"]'::jsonb, 'tracks_results', false
  ));
  insert into ids values ('p', v_id);
  perform public.so_save_outcome_type(v_id, null, 'Booked', 'A booking.');
  perform public.so_set_placement_status(v_id, 'active');
  perform public.so_report_save_config(v_id, jsonb_build_object(
    'weekly_enabled', true, 'daily_enabled', true, 'require_approval', true,
    'recipient_emails', jsonb_build_array('casey@bayarea.test'),
    'include_speed', true, 'include_plan', true, 'cc_manager', true
  ));

  perform pg_temp.as_user(v_uid);
  perform public.so_log_activity('conversations_held', null, 12, 'set', v_day);
  perform public.so_eod_submit(v_day, jsonb_build_object(
    'wins', 'Booked the Tuesday route with a real conversation.',
    'blockers', 'SECRET BLOCKER TEXT THAT MUST NOT LEAK',
    'plan_items', jsonb_build_array(jsonb_build_object('text', 'Call the no-shows')),
    'needs_help', false
  ));

  insert into public.sales_excused_day (operator_id, placement_id, work_date, reason)
  values (v_op, v_id, v_day - 1, 'time_off');
  update public.sales_eod set status = 'missed', submitted_at = null
  where placement_id = v_id and work_date = v_day - 2;

  perform pg_temp.as_user('10200000-0000-4000-8000-0000000000a1');
  v_report := public.so_report_ensure(v_id, 'weekly', v_day - 6, v_day);
  assert v_report is not null, 'a period with a submitted EOD opens a report';
  assert (select status from public.sales_report where id = v_report) = 'ready';

  v_json := app.so_report_client_json(v_report);
  foreach v_key in array array['blockers','mismatch','pay','payout','credential','note_to_manager','operator_value','ghl_value'] loop
    assert not (v_json ? v_key), v_key;
  end loop;
  assert v_json::text not like '%SECRET BLOCKER%', 'the blocker text stays out of the client payload';
  assert v_json ->> 'operator' = 'Alex', 'the client sees the first name';
  assert v_json ->> 'client' = 'Bay Area Cleaning Pros';
  assert exists (
    select 1 from jsonb_array_elements(v_json -> 'gaps') g
    where g ->> 'label' = 'No report submitted'
  );
  assert exists (
    select 1 from jsonb_array_elements(v_json -> 'gaps') g
    where g ->> 'label' = 'Scheduled day off'
  );
  assert not exists (
    select 1 from jsonb_array_elements(v_json -> 'gaps') g
    where g::text ilike '%time_off%' or g::text ilike '%sick%'
  );

  perform pg_temp.as_user(v_uid);
  begin
    perform public.so_report_get(v_report);
    raise exception 'an operator opened the report review';
  exception when others then
    if sqlerrm not like 'permission_denied%' then raise; end if;
  end;

  perform pg_temp.as_user('10200000-0000-4000-8000-0000000000b1');
  begin
    perform public.so_report_approve(v_report, '', 'Next', '{}', 'now');
    raise exception 'an empty summary was accepted';
  exception when others then
    if sqlerrm not like 'required%' then raise; end if;
  end;
  perform public.so_report_approve(v_report, 'Calls landed.', 'Work the no-shows.', '{}', 'now');
  assert (select status from public.sales_report where id = v_report) = 'approved';

  update public.sales_report set approval_due_at = now() - interval '1 hour', approval_alerted_at = null, status = 'ready' where id = v_report;
  perform public.so_report_sweep();
  assert (select status from public.sales_report where id = v_report) = 'ready', 'an unapproved report does not send';
  assert exists (select 1 from public.workspace_alert where kind = 'report_approval_due' and placement_id = v_id);

  perform public.so_report_approve(v_report, 'Calls landed.', 'Work the no-shows.', '{}', 'now');
  assert (select count(*) from jsonb_array_elements(public.so_report_claim(5)) e where e ->> 'id' = v_report::text) = 1;
  perform public.so_report_finish(v_report, true, null);
  assert (select status from public.sales_report where id = v_report) = 'sent';
  assert (select count(*) from jsonb_array_elements(public.so_report_claim(5)) e where e ->> 'id' = v_report::text) = 0;

  v_token := public.so_report_mint(v_report);
  assert v_token is not null and length(v_token) = 64;
  v_open := public.so_report_open(v_token);
  assert v_open ->> 'state' = 'ok';
  assert (v_open -> 'report')::text not like '%SECRET BLOCKER%';
  assert v_open -> 'report' ->> 'operator' = 'Alex';
  perform public.so_report_leave(v_token, 1, 'The calls', 'Shorter notes', true, 'The dial count looks high', 'Casey');
  perform public.so_report_leave(v_token, 4, 'Still working', null, false, null, 'Casey');
  assert (select count(*) from public.sales_report_feedback where report_id = v_report) = 2;
  assert exists (select 1 from public.workspace_alert where kind = 'client_feedback_low' and placement_id = v_id);
  assert exists (select 1 from public.sales_delivery where channel = 'discord' and destination = 'escalations' and subject_type = 'feedback');

  perform pg_temp.as_user(v_uid);
  assert jsonb_array_length(public.so_eod_client_feedback((select id from public.sales_eod where placement_id = v_id and work_date = v_day))) = 2;

  perform pg_temp.as_user('10200000-0000-4000-8000-0000000000b1');
  assert jsonb_array_length(public.so_delivery_list('discord', null, null, null, null)) >= 1;
  assert (public.so_delivery_list('discord', null, null, null, null) -> 0 ->> 'error') is null;

  update public.client_feedback_token set revoked_at = now() where report_id = v_report;
  assert public.so_report_open(v_token) ->> 'state' = 'revoked';
  update public.client_feedback_token set revoked_at = null, created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where report_id = v_report;
  assert public.so_report_open(v_token) ->> 'state' = 'expired';

  assert public.so_report_ensure(v_id, 'weekly', v_day - 20, v_day - 14) is null;
  assert exists (select 1 from public.workspace_alert where kind = 'report_empty' and placement_id = v_id);
  assert exists (select 1 from cron.job where jobname = 'sales-report-sweep');

  perform public.so_outbound_catchup();
  assert exists (select 1 from public.sales_delivery where subject_type = 'eod' and channel = 'discord');
  assert (select payload::text from public.sales_delivery where subject_type = 'eod' and channel = 'discord' limit 1) not like '%mismatch%';

  perform pg_temp.as_user('10200000-0000-4000-8000-0000000000a1');
  v_id := public.so_report_test((select v from ids where k = 'p'));
  assert (select test from public.sales_report where id = v_id);
  assert (select token_id from public.sales_report where id = v_id) is null;
end $$;

rollback;
