-- Team Workspace. Self-contained and rolled back.
--
-- Managers and DA Admin both see every operator. A manager does not receive
-- mismatch rows, the GHL number, pay, or the domain write. The domain change
-- is audited and becomes the address emails already read.

\set ON_ERROR_STOP on
set search_path = public;

begin;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  v_enr uuid;
  v_admin uuid := '99000000-0000-4000-8000-0000000000a1';
  v_mgr uuid := '99000000-0000-4000-8000-0000000000b1';
  v_other uuid := '99000000-0000-4000-8000-0000000000b3';
  v_uid uuid := '99000000-0000-4000-8000-0000000000c1';
  v_uid2 uuid := '99000000-0000-4000-8000-0000000000c2';
  v_op uuid := '99000000-0000-4000-8000-0000000001c1';
  v_op2 uuid := '99000000-0000-4000-8000-0000000001c2';
  v_case uuid := '99000000-0000-4000-8000-0000000000d1';
  v_case2 uuid := '99000000-0000-4000-8000-0000000000d2';
  v_p1 uuid;
  v_p2 uuid;
  v_day uuid;
  v_eod uuid;
  v_today jsonb;
  v_detail jsonb;
  v_events jsonb;
begin
  insert into auth.users (id, email) values
    (v_admin, 'admin@tw.test'),
    (v_mgr, 'manager@tw.test'),
    (v_other, 'other-manager@tw.test'),
    (v_uid, 'op@tw.test'),
    (v_uid2, 'op2@tw.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'DA Admin' where id = v_admin;
  update public.profile set role = 'manager', state = 'active', full_name = 'Assigned Manager' where id = v_mgr;
  update public.profile set role = 'manager', state = 'active', full_name = 'Other Manager' where id = v_other;
  update public.profile set role = 'operator', state = 'active', full_name = 'Ada Operator' where id = v_uid;
  update public.profile set role = 'operator', state = 'active', full_name = 'Bea Operator' where id = v_uid2;
  insert into public.operator (id, profile_id, name, email, phone, status) values
    (v_op, v_uid, 'Ada Operator', 'op@tw.test', '+1 555 0100', 'certified'),
    (v_op2, v_uid2, 'Bea Operator', 'op2@tw.test', null, 'certified');
  insert into public.client_case_file (id, name, slug) values
    (v_case, 'Northside', 'tw-northside'),
    (v_case2, 'Southside', 'tw-southside');
  insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
  values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
  insert into public.academy_certification (enrollment_id, profile_id, level, recertify_on)
  values (v_enr, v_uid, 1, current_date + 10);
  insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
  values (v_uid2, v_program, v_op2, 'sales_operator', 'completed') returning id into v_enr;
  insert into public.academy_certification (enrollment_id, profile_id, level, recertify_on)
  values (v_enr, v_uid2, 1, current_date - 2);

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_p1 := public.so_save_placement(jsonb_build_object(
    'operator_id', v_op, 'case_file_id', v_case, 'placement_type', 'client_placed',
    'manager_profile_id', v_mgr, 'start_date', current_date, 'time_zone', 'America/New_York',
    'working_days', '[1,2,3,4,5]'::jsonb, 'shift_start', '09:00', 'shift_end', '17:30',
    'campaign_summary', 'Roof inspections.',
    'activity_categories', '["outbound_calling","follow_up","reactivation"]'::jsonb));
  perform public.so_save_outcome_type(v_p1, null, 'Inspection booked', 'A homeowner booked an inspection.');
  perform public.so_set_placement_status(v_p1, 'active');
  v_p2 := public.so_save_placement(jsonb_build_object(
    'operator_id', v_op2, 'case_file_id', v_case2, 'placement_type', 'da_internal',
    'manager_profile_id', v_mgr, 'start_date', current_date, 'time_zone', 'America/New_York',
    'working_days', '[1,2,3,4,5]'::jsonb, 'shift_start', '09:00', 'shift_end', '17:30',
    'campaign_summary', 'Internal desk.',
    'activity_categories', '["outbound_calling"]'::jsonb));
  perform public.so_save_outcome_type(v_p2, null, 'Call booked', 'A call was booked.');
  perform public.so_set_placement_status(v_p2, 'active');

  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_op, v_p1, (now() at time zone 'America/New_York')::date) returning id into v_day;
  insert into public.activity_value (activity_day_id, metric_key, source, value) values
    (v_day, 'conversations_held', 'operator', 12),
    (v_day, 'conversations_held', 'ghl', 9);
  insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, status, deadline_at, wins, blockers, tomorrow_plan)
  values (v_op, v_p1, (now() at time zone 'America/New_York')::date, v_day, 'late', now(), 'Booked two inspections.', 'Slow list.', 'Call the rest.');
  insert into public.activity_mismatch (operator_id, placement_id, work_date, metric_key, operator_value, ghl_value, gap)
  values (v_op, v_p1, (now() at time zone 'America/New_York')::date, 'conversations_held', 12, 9, 3);

  assert (select count(*) from public.activity_value_change where new_value = 12) = 1, 'a quick log keeps its history';
  begin
    update public.activity_value_change set new_value = 0 where new_value = 12;
    raise exception 'the quick log history was edited';
  exception when others then
    if sqlerrm not like 'append_only%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  v_today := public.so_team_today();
  assert jsonb_array_length(v_today -> 'operators') = 2, 'a manager sees every operator, not only an assigned one';
  assert not (v_today -> 'summary' ? 'open_mismatches'), 'managers do not receive the mismatch count';
  assert not (v_today ? 'domain'), 'managers do not receive the domain setting';
  assert not exists (
    select 1 from jsonb_array_elements(v_today -> 'operators') row
    cross join jsonb_array_elements(row -> 'metrics') metric
    where metric ? 'ghl'
  ), 'managers do not receive GHL numbers';
  v_detail := public.so_team_operator(v_op);
  assert not (v_detail ? 'mismatches'), v_detail::text;
  assert not exists (
    select 1 from jsonb_array_elements(v_detail -> 'today') metric where metric ? 'ghl'
  ), v_detail -> 'today';
  assert v_detail -> 'operator' ->> 'phone' = '+1 555 0100';
  assert (v_detail ->> 'is_admin')::boolean = false;
  v_events := public.so_team_activity();
  assert (
    select count(*) from jsonb_array_elements(v_events -> 'events') ev where ev ->> 'type' = 'quick_log'
  ) = 1, 'managers see the operator quick log and not the GHL change';

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.so_set_default_target('conversations_held', null, 40, 200);
  perform public.so_save_settings('{"target_override_min_pct":50}'::jsonb);
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.so_team_set_target(v_p1, 'conversations_held', 10, null);
    raise exception 'a manager set a target under the floor';
  exception when others then
    if sqlerrm not like 'below_limit%' then raise; end if;
  end;
  perform public.so_team_set_target(v_p1, 'conversations_held', 30, null);
  perform public.so_team_create_task(v_op, 'Call the callback list', 'The ones from this morning.', current_date, v_p1);
  perform public.so_team_send_message(v_op, 'Nice work on the two inspections.', v_p1);
  assert (select count(*) from public.audit_event where action = 'task.assigned' and summary like '%Call the callback list%') = 1, 'task assign is audited';
  assert (select count(*) from public.operator_notification where kind = 'manager_message') = 1, 'the manager message is stored';

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_today := public.so_team_today();
  assert (v_today -> 'summary' ->> 'open_mismatches')::int = 1, v_today -> 'summary';
  assert (v_today -> 'summary' -> 'eod' ->> 'late')::int = 1, v_today -> 'summary';
  assert exists (
    select 1 from jsonb_array_elements(v_today -> 'operators') row
    cross join jsonb_array_elements(row -> 'metrics') metric
    where metric ->> 'key' = 'conversations_held' and (metric ->> 'ghl')::numeric = 9
  ), 'DA Admin sees the GHL number beside the logged number';
  v_detail := public.so_team_operator(v_op);
  assert jsonb_array_length(v_detail -> 'mismatches') = 1;
  assert (v_detail -> 'operator' ->> 'certification') = 'warning';
  assert (public.so_team_operator(v_op2) -> 'operator' ->> 'certification') = 'grace';
  select id into v_eod from public.sales_eod where operator_id = v_op;
  assert public.so_team_eod(v_eod) ->> 'wins' = 'Booked two inspections.';
  assert jsonb_array_length(public.so_team_eod(v_eod) -> 'feedback') = 0;
  v_events := public.so_team_activity(null, null, 'quick_log');
  assert (
    select count(*) from jsonb_array_elements(v_events -> 'events') ev where ev ->> 'type' = 'quick_log'
  ) = 2, 'DA Admin sees both number changes';

  perform public.so_save_operator_domain(jsonb_build_object(
    'origin', 'https://ops.example.test',
    'also_active', jsonb_build_array('https://also.example.test'),
    'retired', jsonb_build_array('https://gone.example.test'),
    'refresh_minutes', 5
  ));
  assert (select base_url from public.team_setting where id = 1) = 'https://ops.example.test';
  assert (select team_workspace_refresh_minutes from public.team_setting where id = 1) = 5;
  assert (select count(*) from public.audit_event where action = 'workspace.domain') = 1, 'the domain change is audited';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-0000000000b3', true);
do $$
begin
  assert (select count(*) from public.activity_mismatch) = 0, 'managers cannot read mismatches directly';
  assert (select count(*) from public.activity_value where source = 'ghl') = 0, 'managers cannot read GHL numbers directly';
  perform set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-0000000000b1', true);
  assert (select count(*) from public.activity_value where source = 'operator') = 1, 'an assigned manager still sees the logged number';
  assert (select count(*) from public.activity_value where source = 'ghl') = 0, 'an assigned manager still cannot see the GHL number';
  assert (select count(*) from public.operator_pay_impact) = 0, 'managers cannot read pay impact';
  assert (select count(*) from public.activity_value_change where source = 'ghl') = 0;
  begin
    perform public.so_save_operator_domain('{"origin":"https://nope.example.test"}'::jsonb);
    raise exception 'a manager changed the domain';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
end $$;
reset role;

set local role anon;
do $$
declare v jsonb := public.so_operator_workspace_hosts();
begin
  assert v ->> 'origin' = 'https://ops.example.test';
  assert v -> 'retired' ->> 0 = 'https://gone.example.test';
end $$;
reset role;

rollback;
\echo 'team workspace: ok'
