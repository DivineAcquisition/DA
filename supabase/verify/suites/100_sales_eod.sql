-- End-of-day submission, the deadline clock, feedback, and excused days.
-- Timings come from team_setting. Each step fires once. A submitted report
-- stops the rest. Operators only reach their own rows.
\set ON_ERROR_STOP on
set search_path = public;

begin;

create temp table ids (k text primary key, v uuid) on commit drop;

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, true);
$$;

create or replace function pg_temp.eod_body(p_help boolean) returns jsonb language sql as $$
  select jsonb_build_object(
    'wins', 'Closed two inspections and kept the follow-ups moving.',
    'blockers', 'No blockers today.',
    'needs_help', p_help,
    'plan_items', jsonb_build_array(jsonb_build_object('text', 'Call the warm leads'))
  );
$$;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  n int;
  v_uid uuid;
  v_op uuid;
  v_enr uuid;
  v_id uuid;
begin
  insert into auth.users (id, email) values
    ('10000000-0000-4000-8000-0000000000a1', 'eod-admin@so.test'),
    ('10000000-0000-4000-8000-0000000000b1', 'eod-manager@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'EOD Admin' where id = '10000000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'EOD Manager' where id = '10000000-0000-4000-8000-0000000000b1';

  insert into public.client_case_file (id, name, slug) values
    ('10000000-0000-4000-8000-0000000000d1', 'EOD North', 'so-eod-north'),
    ('10000000-0000-4000-8000-0000000000d2', 'EOD South', 'so-eod-south');

  for n in 1..2 loop
    v_uid := ('10000000-0000-4000-8000-0000000000c' || n)::uuid;
    v_op := ('10000000-0000-4000-8000-0000000001c' || n)::uuid;
    insert into auth.users (id, email) values (v_uid, 'eod-op' || n || '@so.test');
    update public.profile set role = 'operator', state = 'active', full_name = 'EOD Op ' || n where id = v_uid;
    insert into public.operator (id, profile_id, name, email, status)
    values (v_op, v_uid, 'EOD Op ' || n, 'eod-op' || n || '@so.test', 'certified');
    insert into ids values ('op' || n, v_op), ('user' || n, v_uid);
    insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
    values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
    insert into public.academy_certification (enrollment_id, profile_id, level) values (v_enr, v_uid, 1);
  end loop;

  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(jsonb_build_object(
    'operator_id', (select v from ids where k = 'op1'),
    'case_file_id', '10000000-0000-4000-8000-0000000000d1',
    'placement_type', 'client_placed',
    'manager_profile_id', '10000000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 14,
    'time_zone', current_setting('TimeZone'),
    'working_days', '[1,2,3,4,5,6,7]'::jsonb,
    'shift_start', '00:00', 'shift_end', '23:59', 'eod_deadline', '23:59',
    'campaign_summary', 'Storm inspections.',
    'activity_categories', '["outbound_calling","follow_up","reactivation"]'::jsonb,
    'tracks_results', true
  ));
  insert into ids values ('p1', v_id);
  perform public.so_save_outcome_type(v_id, null, 'Inspection booked', 'A roof inspection is booked.');
  assert public.so_set_placement_status(v_id, 'active') = 'active';

  v_id := public.so_save_placement(jsonb_build_object(
    'operator_id', (select v from ids where k = 'op2'),
    'case_file_id', '10000000-0000-4000-8000-0000000000d2',
    'placement_type', 'client_placed',
    'manager_profile_id', '10000000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 14,
    'time_zone', current_setting('TimeZone'),
    'working_days', '[1,2,3,4,5,6,7]'::jsonb,
    'shift_start', '00:00', 'shift_end', '23:59', 'eod_deadline', '23:59',
    'campaign_summary', 'Follow-up calls.',
    'activity_categories', '["outbound_calling"]'::jsonb,
    'tracks_results', false
  ));
  insert into ids values ('p2', v_id);
  insert into ids values ('outcome2', public.so_save_outcome_type(v_id, null, 'Call booked', 'A sales call is booked.'));
  assert public.so_set_placement_status(v_id, 'active') = 'active';
end $$;

create or replace function pg_temp.open_eod(p_placement uuid, p_day date, p_deadline timestamptz, p_status text)
returns uuid language plpgsql as $$
declare v_op uuid; v_day uuid; v_eod uuid;
begin
  select operator_id into v_op from public.placement where id = p_placement;
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_op, p_placement, p_day)
  on conflict (operator_id, placement_id, work_date) do nothing;
  select id into v_day from public.activity_day
  where operator_id = v_op and placement_id = p_placement and work_date = p_day;
  insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at, status)
  values (v_op, p_placement, p_day, v_day, p_deadline, p_status)
  returning id into v_eod;
  return v_eod;
end $$;

\echo '== draft, on-time submit, and a short field is refused =='
do $$
declare
  v_day date := current_date;
  v_id uuid;
  v_saved jsonb;
begin
  v_id := pg_temp.open_eod((select v from ids where k = 'p2'), v_day, now() + interval '3 hours', 'not_started');
  insert into ids values ('on_time', v_id);
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  v_saved := public.so_eod_save(v_day, '{"wins":"Started","blockers":"","needs_help":false,"plan_items":[{"text":"Call back"}]}'::jsonb);
  assert v_saved ->> 'status' = 'draft';
  assert (select status from public.sales_eod where id = v_id) = 'draft';

  begin
    perform public.so_eod_submit(v_day, '{"wins":"short","blockers":"short","needs_help":false,"plan_items":[{"text":"Call back"}]}'::jsonb);
    raise exception 'a short report was submitted';
  exception when others then
    if sqlerrm not like 'too_short%' then raise; end if;
  end;

  v_saved := public.so_eod_submit(v_day, pg_temp.eod_body(true));
  assert v_saved ->> 'status' = 'submitted';
  assert v_saved ->> 'was_late' = 'false';
  assert (select needs_help from public.sales_eod where id = v_id);
  assert (select completed_on from public.operator_task where placement_id = (select v from ids where k = 'p2') and system_key = 'eod:' || v_day::text) = v_day;
  assert exists (
    select 1 from public.workspace_alert
    where placement_id = (select v from ids where k = 'p2') and kind = 'eod_needs_help' and period_on = v_day
  );

  assert public.so_log_activity('conversations_held', null, 2, 'set', v_day) = 2;
  begin
    perform public.so_log_activity('dials_made', null, 1, 'delta', v_day);
    raise exception 'a GHL number was edited on the form';
  exception when others then
    if sqlerrm not like 'ghl_only%' then raise; end if;
  end;
end $$;

\echo '== submit stops every later deadline step =='
do $$
declare v_id uuid; v_day date := current_date - 1;
begin
  v_id := pg_temp.open_eod((select v from ids where k = 'p2'), v_day, now() - interval '5 hours', 'draft');
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  perform public.so_eod_submit(v_day, pg_temp.eod_body(false));
  assert (select was_late from public.sales_eod where id = v_id);
  perform public.so_eod_sweep();
  assert (select count(*) from public.sales_eod_step where eod_id = v_id) = 0;
end $$;

\echo '== reminder, late, and the manager alert each fire once =='
do $$
declare
  v_id uuid;
  v_notes int;
  v_alerts int;
begin
  delete from public.sales_eod where placement_id = (select v from ids where k = 'p1') and work_date = current_date;
  v_id := pg_temp.open_eod((select v from ids where k = 'p1'), current_date, now() - interval '3 hours', 'not_started');
  insert into ids values ('clock', v_id);
  perform public.so_eod_sweep();
  assert (select status from public.sales_eod where id = v_id) = 'late';
  assert (select count(*) from public.sales_eod_step where eod_id = v_id and step = 'reminder') = 1;
  assert (select count(*) from public.sales_eod_step where eod_id = v_id and step = 'late') = 1;
  assert (select count(*) from public.sales_eod_step where eod_id = v_id and step = 'manager_alert') = 1;
  assert not exists (select 1 from public.sales_eod_step where eod_id = v_id and step = 'missed');
  select count(*) into v_notes from public.operator_notification
  where operator_id = (select v from ids where k = 'op1') and kind in ('eod_reminder', 'eod_late');
  select count(*) into v_alerts from public.workspace_alert
  where placement_id = (select v from ids where k = 'p1') and kind in ('eod_late', 'eod_manager');
  perform public.so_eod_sweep();
  assert (select count(*) from public.operator_notification
          where operator_id = (select v from ids where k = 'op1') and kind in ('eod_reminder', 'eod_late')) = v_notes;
  assert (select count(*) from public.workspace_alert
          where placement_id = (select v from ids where k = 'p1') and kind in ('eod_late', 'eod_manager')) = v_alerts;
  assert exists (select 1 from public.sales_eod_event where eod_id = v_id and step = 'late');
  assert exists (select 1 from public.audit_event where action = 'workspace.eod.late' and entity_id = v_id::text);
end $$;

\echo '== missed at the next shift, and a late submit stays missed =='
do $$
declare v_id uuid; v_day date := current_date - 1; v_saved jsonb;
begin
  v_id := pg_temp.open_eod((select v from ids where k = 'p1'), v_day, now() - interval '30 hours', 'draft');
  insert into ids values ('missed', v_id);
  perform public.so_eod_sweep();
  assert (select status from public.sales_eod where id = v_id) = 'missed';
  assert exists (select 1 from public.sales_eod_step where eod_id = v_id and step = 'missed');
  assert exists (
    select 1 from public.workspace_alert
    where placement_id = (select v from ids where k = 'p1') and kind = 'eod_missed' and period_on = v_day
  );
  perform pg_temp.as_user((select v from ids where k = 'user1'));
  v_saved := public.so_eod_submit(v_day, pg_temp.eod_body(false));
  assert v_saved ->> 'status' = 'missed';
  assert v_saved ->> 'was_late' = 'true';
  assert (select submitted_at from public.sales_eod where id = v_id) is not null;
  perform public.so_eod_sweep();
  assert (select count(*) from public.sales_eod_step where eod_id = v_id and step = 'missed') = 1;
end $$;

\echo '== an excuse stops the clock, including after late =='
do $$
declare v_id uuid; v_day date := current_date - 3; v_n int;
begin
  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  v_day := current_date;
  assert public.so_excuse_days((select v from ids where k = 'p1'), array[v_day], 'sick', 'Out today') = 1;
  assert (select status from public.sales_eod where id = (select v from ids where k = 'clock')) = 'excused';
  assert (select prior_status from public.sales_eod where id = (select v from ids where k = 'clock')) = 'late';
  perform public.so_eod_sweep();
  assert not exists (select 1 from public.sales_eod_step where eod_id = (select v from ids where k = 'clock') and step = 'missed');

  v_day := current_date - 3;
  v_id := pg_temp.open_eod((select v from ids where k = 'p1'), v_day, now() - interval '4 hours', 'not_started');
  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  perform public.so_excuse_days((select v from ids where k = 'p1'), array[v_day], 'holiday', null);
  perform public.so_eod_sweep();
  assert (select status from public.sales_eod where id = v_id) = 'excused';
  assert (select count(*) from public.sales_eod_step where eod_id = v_id) = 0;

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  begin
    perform public.so_excuse_days((select v from ids where k = 'p1'), array[current_date - 4], 'time_off', null);
    raise exception 'an operator excused their own day';
  exception when others then
    if sqlerrm not like 'permission_denied%' then raise; end if;
  end;
  v_n := jsonb_array_length(public.so_excused_days());
  assert v_n >= 1;
end $$;

\echo '== edits stay in history, then the window locks, and DA Admin can unlock =='
do $$
declare v_id uuid := (select v from ids where k = 'on_time'); v_until timestamptz;
begin
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  perform public.so_eod_save(current_date, pg_temp.eod_body(true) || '{"wins":"Closed two inspections and rewrote the win."}'::jsonb);
  assert (select edited_after_submit from public.sales_eod where id = v_id);
  assert (select edit_count from public.sales_eod where id = v_id) = 1;
  assert (select count(*) from public.sales_eod_revision where eod_id = v_id) = 1;

  update public.sales_eod set locked_at = now() - interval '1 minute' where id = v_id;
  begin
    perform public.so_eod_save(current_date, pg_temp.eod_body(true) || '{"wins":"Closed two inspections and tried again later."}'::jsonb);
    raise exception 'a locked EOD was edited';
  exception when others then
    if sqlerrm not like 'eod_locked%' then raise; end if;
  end;

  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  begin
    perform public.so_eod_unlock(v_id, 2, 'The operator lost the last paragraph.');
    raise exception 'a manager unlocked an EOD';
  exception when others then
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;

  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000a1');
  v_until := public.so_eod_unlock(v_id, 2, 'The operator lost the last paragraph.');
  assert v_until > now();
  assert exists (select 1 from public.audit_event where action = 'workspace.eod.unlocked' and entity_id = v_id::text);
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  perform public.so_eod_save(current_date, pg_temp.eod_body(true) || '{"wins":"Closed two inspections and added the missing line."}'::jsonb);
  assert (select edit_count from public.sales_eod where id = v_id) = 2;
end $$;

\echo '== feedback, a reply, escalation, a blocker task, and the plan =='
do $$
declare
  v_id uuid := (select v from ids where k = 'on_time');
  v_note uuid;
  v_task uuid;
  v_plan jsonb;
begin
  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  v_note := public.so_eod_feedback(v_id, 'Keep the inspection follow-up. Drop the cold list.', 4, null);
  perform public.so_eod_mark_reviewed(v_id);
  perform public.so_eod_escalate(v_id, 'The blocker names a client who asked us to stop.');
  perform public.so_save_task(
    null, (select v from ids where k = 'op2'), (select v from ids where k = 'p2'),
    'Clear the blocker from the EOD', 'From the EOD blocker.', current_date, null, 'high', false
  );
  assert exists (select 1 from public.operator_notification where operator_id = (select v from ids where k = 'op2') and kind = 'feedback_received');
  assert exists (select 1 from public.workspace_alert where kind = 'eod_escalated' and placement_id = (select v from ids where k = 'p2'));
  assert (select reviewed_at from public.sales_eod where id = v_id) is not null;

  perform pg_temp.as_user((select v from ids where k = 'user2'));
  perform public.so_eod_feedback(v_id, 'I will drop that list tomorrow.', null, v_note);
  begin
    update public.sales_eod_feedback set body = 'changed' where id = v_note;
    raise exception 'feedback was edited';
  exception when others then
    if sqlerrm not like '%append%' and sqlerrm not like '%not allowed%' and sqlerrm not like '%cannot%' then raise; end if;
  end;

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  begin
    perform public.so_eod_read(v_id);
    raise exception 'another operator read the EOD';
  exception when others then
    if sqlerrm not like 'not_found%' then raise; end if;
  end;

  perform pg_temp.as_user((select v from ids where k = 'user2'));
  v_plan := public.so_today_plan();
  assert v_plan ->> 'eod_id' is not null;
  perform public.so_plan_tick((v_plan ->> 'eod_id')::uuid, 0, true);
  assert (public.so_today_plan() -> 'items' -> 0 ->> 'done_at') is not null;

  select id into v_task from public.operator_task
  where placement_id = (select v from ids where k = 'p2') and title = 'Clear the blocker from the EOD';
  assert v_task is not null;

  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  assert (public.so_team_snapshot() ->> 'needs_review')::int >= 0;
  assert jsonb_array_length(public.so_eod_index('escalated')) >= 1;
end $$;

\echo '== view-as cannot write =='
do $$
begin
  insert into public.impersonation (actor_profile_id, target_profile_id, reason, expires_at, kind, reason_kind)
  values (
    '10000000-0000-4000-8000-0000000000b1',
    (select v from ids where k = 'user2'),
    'Quality review: checking the EOD',
    now() + interval '30 minutes',
    'view_as', 'quality_review'
  );
  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000b1');
  begin
    perform public.so_eod_save(current_date, pg_temp.eod_body(false));
    raise exception 'view-as saved an EOD';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' then raise; end if;
  end;
  update public.impersonation set ended_at = now(), ended_reason = 'ended' where ended_at is null;
end $$;

\echo '== an operator cannot read the EOD table directly =='
select pg_temp.as_user((select v from ids where k = 'user2'));
set local role authenticated;
do $$
declare v_seen int;
begin
  select count(*) into v_seen from public.sales_eod;
  assert v_seen = 0, 'an operator read the EOD table directly';
end $$;
reset role;

\echo '== the minimum length is a setting, and the clock is scheduled =='
do $$
declare v_form jsonb;
begin
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  v_form := public.so_eod_form(current_date);
  assert v_form ->> 'min_chars' = '20';
  assert exists (select 1 from jsonb_array_elements(v_form -> 'metrics') m where m ->> 'key' = 'dials_made' and m ->> 'display' = 'pending_sync' and m ->> 'editable' = 'false');
  assert v_form::text not like '%mismatch%';

  perform pg_temp.as_user('10000000-0000-4000-8000-0000000000a1');
  perform public.so_save_settings(jsonb_build_object('eod_min_text_chars', 12));
  assert (select eod_min_text_chars from public.team_setting where id = 1) = 12;
  assert exists (select 1 from cron.job where jobname = 'sales-eod-sweep' and schedule = '* * * * *');
end $$;

rollback;
