-- GHL counts, mismatch access, and verified numbers. No live GHL calls.
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
  v_uid uuid := '10100000-0000-4000-8000-0000000000c1';
  v_op uuid := '10100000-0000-4000-8000-0000000001c1';
  v_enr uuid;
  v_id uuid;
  v_secret uuid;
  v_day date := current_date;
begin
  insert into auth.users (id, email) values
    ('10100000-0000-4000-8000-0000000000a1', 'ghl-admin@so.test'),
    ('10100000-0000-4000-8000-0000000000b1', 'ghl-manager@so.test'),
    (v_uid, 'ghl-op@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'GHL Admin' where id = '10100000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'GHL Manager' where id = '10100000-0000-4000-8000-0000000000b1';
  update public.profile set role = 'operator', state = 'active', full_name = 'GHL Op' where id = v_uid;
  insert into public.operator (id, profile_id, name, email, status) values (v_op, v_uid, 'GHL Op', 'ghl-op@so.test', 'certified');
  insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
  values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
  insert into public.academy_certification (enrollment_id, profile_id, level) values (v_enr, v_uid, 1);
  insert into public.client_case_file (id, name, slug) values ('10100000-0000-4000-8000-0000000000d1', 'GHL Client', 'so-ghl-client');

  perform pg_temp.as_user('10100000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(jsonb_build_object(
    'operator_id', v_op, 'case_file_id', '10100000-0000-4000-8000-0000000000d1',
    'placement_type', 'client_placed', 'manager_profile_id', '10100000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 10, 'time_zone', 'UTC',
    'working_days', '[1,2,3,4,5,6,7]'::jsonb, 'shift_start', '00:00', 'shift_end', '23:59',
    'eod_deadline', '23:59', 'campaign_summary', 'GHL test.',
    'activity_categories', '["outbound_calling"]'::jsonb, 'tracks_results', false
  ));
  insert into ids values ('p', v_id);
  perform public.so_save_outcome_type(v_id, null, 'Booked', 'A booking.');
  perform public.so_set_placement_status(v_id, 'active');

  v_secret := vault.create_secret('pit-test-token-value-xxxx', 'ghl-suite', 'suite');
  insert into public.ghl_connection (level, case_file_id, location_id, label, secret_id, token_last4, status)
  values ('location', '10100000-0000-4000-8000-0000000000d1', 'loc-suite', 'Suite', v_secret, 'xxxx', 'healthy');
  insert into public.ghl_location (case_file_id, location_id) values ('10100000-0000-4000-8000-0000000000d1', 'loc-suite');
  insert into public.sales_ghl_link (placement_id, ghl_user_id, status, connected_at, last_success_at, mapping, mapping_effective_on)
  values (v_id, 'ghl-user-1', 'connected', now(), now(), '{"outcomes":[{"id":"x"}]}'::jsonb, current_date - 1);

  assert app.so_ghl_display(v_id, 'dials_made', v_day, v_day) = 'sync_delayed', 'a day with no finished pull is not current';
  perform public.so_apply_ghl_day(v_id, v_day,
    '[{"metric":"dials_made","value":4},{"metric":"conversations_held","value":2}]'::jsonb,
    '[{"metric":"dials_made","ghl_id":"call-1","ghl_type":"call","at":"2026-10-29T15:00:00Z","contact_id":"c1"}]'::jsonb,
    array['dials_made','conversations_held','connects','talk_time_minutes']);
  perform public.so_ghl_sync_result(v_id, true, null, 2);
  assert app.so_ghl_display(v_id, 'dials_made', v_day, v_day) = 'number';
  assert app.so_ghl_display(v_id, 'speed_to_lead_seconds', v_day, v_day) = 'pending_sync', 'an unmapped metric stays pending';

  perform pg_temp.as_user(v_uid);
  perform public.so_log_activity('conversations_held', null, 20, 'set', v_day);
  perform public.so_check_mismatches(v_id, v_day, 'eod');
  assert (select count(*) from public.activity_mismatch where placement_id = v_id and metric_key = 'conversations_held' and status = 'open') = 1;

  perform pg_temp.as_user('10100000-0000-4000-8000-0000000000b1');
  begin
    perform public.so_ghl_mismatches(null, null, null);
    raise exception 'a manager saw mismatches';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;

  perform pg_temp.as_user(v_uid);
  begin
    perform public.so_ghl_panel(v_id);
    raise exception 'an operator opened the connection';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;

  perform pg_temp.as_user('10100000-0000-4000-8000-0000000000a1');
  perform public.so_ghl_decide((select id from public.activity_mismatch where placement_id = v_id and metric_key = 'conversations_held'),
    'accept_operator', 'ghl_outage', 'The dialer logged the calls. GHL missed them.');
  assert (select basis from public.activity_verified ver join public.activity_day d on d.id = ver.activity_day_id
          where d.placement_id = v_id and ver.metric_key = 'conversations_held') = 'operator';
end $$;

rollback;
