-- Sales Operator dashboard. Self-contained and rolled back.
--
-- Working day follows the placement time zone and shift. EOD status is the
-- stored row. System tasks cannot be checked off. A manager task on any
-- operator creates an alert and an audit row. Quick log writes the operator
-- set, keeps history, and refuses GHL metrics, a locked day, another operator,
-- and view-as. A manager override replaces the default for that operator only.
-- GHL metrics stay pending. The certification warning and grace follow settings.
\set ON_ERROR_STOP on
set search_path = public;

begin;

create temp table ids (k text primary key, v uuid) on commit drop;

\echo '== the working day follows the shift and the placement zone =='
do $$
declare p public.placement;
begin
  p.time_zone := 'America/New_York';
  p.working_days := '{1,2,3,4,5}';
  p.shift_start := '09:00';
  p.shift_end := '17:30';
  p.start_date := '2020-01-01';
  -- Monday 26 Oct 2026, 09:00 EDT.
  assert app.so_work_date(p, '2026-10-26 13:00:00+00') = '2026-10-26', 'a shift morning is that working day';
  -- Saturday 11:00 EDT rolls forward to Monday.
  assert app.so_work_date(p, '2026-10-24 15:00:00+00') = '2026-10-26', 'a day off is the next working day';
  -- Friday 22:00 EDT is still Friday.
  assert app.so_work_date(p, '2026-10-24 02:00:00+00') = '2026-10-23', 'after the shift, the day is still that working day';

  p.shift_start := '22:00';
  p.shift_end := '06:00';
  -- Saturday 02:30 EDT is still Friday's overnight shift.
  assert app.so_work_date(p, '2026-10-24 06:30:00+00') = '2026-10-23', 'an overnight shift stays on the day it started';

  p.time_zone := 'Asia/Manila';
  p.shift_start := '09:00';
  p.shift_end := '18:00';
  p.working_days := '{1,2,3,4,5,6,7}';
  -- 16:00 UTC is already Thursday in Manila.
  assert app.so_work_date(p, '2026-10-28 16:00:00+00') = '2026-10-29', 'the zone, not the server date, decides the day';

  p.time_zone := 'America/New_York';
  p.working_days := '{1,2,3,4,5}';
  p.shift_start := '09:00';
  p.shift_end := '17:30';
  p.start_date := '2026-10-27';
  assert app.so_work_date(p, '2026-10-24 15:00:00+00') = '2026-10-27', 'before the start date, the first working day on or after it';

  assert app.so_pace(10, 10, 0.1) = 'met';
  assert app.so_pace(0, 10, 0) = 'on_track';
  assert app.so_pace(1, 10, 1) = 'behind';
  assert app.so_pace(3, 10, 0.3) = 'on_track';
  assert app.so_pace(5, null, 1) is null;
  assert app.so_pace(5, 0, 1) is null, 'a zero target is not a target';
end $$;

do $$
declare
  v_program uuid := (select id from public.academy_program where slug = 'da-operator-academy');
  n int;
  v_uid uuid;
  v_op uuid;
  v_enr uuid;
begin
  insert into auth.users (id, email) values
    ('99000000-0000-4000-8000-0000000000a1', 'dash-admin@so.test'),
    ('99000000-0000-4000-8000-0000000000b1', 'dash-manager@so.test'),
    ('99000000-0000-4000-8000-0000000000b2', 'dash-other@so.test');
  update public.profile set role = 'admin', state = 'active', full_name = 'Dash Admin' where id = '99000000-0000-4000-8000-0000000000a1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Dash Manager' where id = '99000000-0000-4000-8000-0000000000b1';
  update public.profile set role = 'manager', state = 'active', full_name = 'Other Manager' where id = '99000000-0000-4000-8000-0000000000b2';

  insert into public.client_case_file (id, name, slug) values
    ('99000000-0000-4000-8000-0000000000d1', 'North Client', 'so-dash-north'),
    ('99000000-0000-4000-8000-0000000000d2', 'South Client', 'so-dash-south');

  for n in 1..3 loop
    v_uid := ('99000000-0000-4000-8000-0000000000c' || n)::uuid;
    v_op := ('99000000-0000-4000-8000-0000000001c' || n)::uuid;
    insert into auth.users (id, email) values (v_uid, 'dash-op' || n || '@so.test');
    update public.profile set role = 'operator', state = 'active', full_name = 'Dash Op ' || n where id = v_uid;
    insert into public.operator (id, profile_id, name, email, status)
    values (v_op, v_uid, 'Dash Op ' || n, 'dash-op' || n || '@so.test', 'certified');
    insert into ids values ('op' || n, v_op), ('user' || n, v_uid);
    insert into public.academy_enrollment (profile_id, program_id, operator_id, track, status)
    values (v_uid, v_program, v_op, 'sales_operator', 'completed') returning id into v_enr;
    insert into public.academy_certification (enrollment_id, profile_id, level) values (v_enr, v_uid, 1);
  end loop;
end $$;

create or replace function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p::text, true);
$$;

create or replace function pg_temp.placement_input(p_op uuid, p_case uuid, p_results boolean) returns jsonb language sql as $$
  select jsonb_build_object(
    'operator_id', p_op, 'case_file_id', p_case, 'placement_type', 'client_placed',
    'manager_profile_id', '99000000-0000-4000-8000-0000000000b1',
    'start_date', current_date - 14, 'time_zone', current_setting('TimeZone'),
    'working_days', '[1,2,3,4,5,6,7]'::jsonb, 'shift_start', '00:00', 'shift_end', '23:59',
    'eod_deadline', '23:59',
    'campaign_summary', 'Roof inspections for storm-damaged homes.',
    'activity_categories', case when p_results
      then '["outbound_calling","follow_up","reactivation"]'::jsonb
      else '["outbound_calling"]'::jsonb end,
    'tracks_results', p_results);
$$;

create or replace function pg_temp.metric(p jsonb, p_key text) returns jsonb language sql as $$
  select m
  from jsonb_array_elements(p -> 'groups') g
  cross join lateral jsonb_array_elements(g -> 'metrics') m
  where m ->> 'key' = p_key
  limit 1;
$$;

\echo '== two placements, one paused =='
do $$
declare v_id uuid; v_outcome uuid;
begin
  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000a1');
  v_id := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op1'), '99000000-0000-4000-8000-0000000000d1', true));
  insert into ids values ('p1', v_id);
  v_outcome := public.so_save_outcome_type(v_id, null, 'Inspection booked', 'A homeowner booked a roof inspection.');
  insert into ids values ('outcome', v_outcome);
  perform public.so_save_outcome_type(v_id, null, 'Estimate booked', 'An estimate visit is on the calendar.');
  assert public.so_set_placement_status(v_id, 'active') = 'active';

  v_id := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op2'), '99000000-0000-4000-8000-0000000000d2', false));
  insert into ids values ('p2', v_id);
  perform public.so_save_outcome_type(v_id, null, 'Call booked', 'A sales call is booked.');
  perform public.so_set_placement_status(v_id, 'active');

  v_id := public.so_save_placement(pg_temp.placement_input((select v from ids where k = 'op3'), '99000000-0000-4000-8000-0000000000d1', false));
  insert into ids values ('p3', v_id);
  perform public.so_save_outcome_type(v_id, null, 'Call booked', 'A sales call is booked.');
  perform public.so_set_placement_status(v_id, 'active');
  perform public.so_set_placement_status(v_id, 'paused', 'Client on holiday');
end $$;

\echo '== yesterday late sits above today, and the payload hides secrets =='
do $$
declare
  v_pl public.placement;
  v_day uuid;
  v_eod uuid;
  w jsonb;
  b jsonb;
  v_yesterday date;
begin
  select * into v_pl from public.placement where id = (select v from ids where k = 'p1');
  v_yesterday := app.so_previous_work_date(v_pl, app.so_work_date(v_pl, now()));
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_pl.operator_id, v_pl.id, v_yesterday) returning id into v_day;
  insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, status, deadline_at, wins)
  values (v_pl.operator_id, v_pl.id, v_yesterday, v_day, 'late', now() - interval '2 hours', 'One inspection.')
  returning id into v_eod;
  insert into ids values ('yester', v_eod);
  insert into public.activity_mismatch (operator_id, placement_id, work_date, metric_key, operator_value, ghl_value, gap)
  values (v_pl.operator_id, v_pl.id, v_yesterday, 'conversations_held', 4, 1, 3);

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  w := public.so_dashboard();
  assert w ->> 'state' = 'active';
  assert w #>> '{placement,client_name}' = 'North Client';
  assert w #>> '{placement,manager_name}' = 'Dash Manager';
  assert w #>> '{placement,placement_type}' = 'client_placed';
  assert w #>> '{placement,campaign_summary}' = 'Roof inspections for storm-damaged homes.';
  assert exists (
    select 1 from jsonb_array_elements(w #> '{placement,outcomes}') o
    where o ->> 'name' = 'Inspection booked' and o ->> 'definition' like 'A homeowner%'
  );
  assert w #>> '{eod,today,status}' = 'not_started';
  assert (w #>> '{eod,today,deadline_at}')::timestamptz = app.so_eod_deadline(v_pl, (w ->> 'today')::date);
  assert w #>> '{eod,yesterday,status}' = 'late';
  assert (w #>> '{eod,yesterday,late_seconds}')::int between 7000 and 9000;
  assert w -> 'placement' ? 'review_on' = false;
  assert w::text not like '%mismatch%';
  assert w::text not like '%payout%';
  assert w::text not like '%token_hash%';
  assert w::text not like '%ghl_location%';
  assert w -> 'certification' = 'null'::jsonb;

  b := public.so_dashboard_board();
  assert b ->> 'any_logged' = 'false';
  assert (b ->> 'unread_alerts')::int = 0;
  assert jsonb_array_length(b -> 'alerts') = 0;
  assert exists (
    select 1 from jsonb_array_elements(b -> 'tasks') t
    where t ->> 'title' = 'Submit today''s EOD' and t ->> 'source' = 'system' and t ->> 'created_by' = 'System'
  );
  assert pg_temp.metric(b, 'dials_made') ->> 'today_display' = 'pending_sync';
  assert pg_temp.metric(b, 'dials_made') -> 'today' = 'null'::jsonb;
  assert pg_temp.metric(b, 'connects') ->> 'today_display' = 'pending_sync';
  assert pg_temp.metric(b, 'speed_to_lead_seconds') ->> 'today_display' = 'pending_sync';
  assert pg_temp.metric(b, 'show_rate') ->> 'today_display' = 'pending_sync';
  assert pg_temp.metric(b, 'closes') ->> 'today_display' = 'pending_sync';
  assert pg_temp.metric(b, 'show_rate') ->> 'operator_editable' = 'false';
  assert (select bool_or(g ->> 'key' = 'results') from jsonb_array_elements(b -> 'groups') g);
  assert (select bool_or(g ->> 'key' = 'ghl') from jsonb_array_elements(b -> 'groups') g);
  assert (select bool_or(g ->> 'key' = 'follow_up') from jsonb_array_elements(b -> 'groups') g);
end $$;

\echo '== quick log writes today, keeps history, and refuses GHL =='
do $$
declare v_outcome uuid := (select v from ids where k = 'outcome');
begin
  perform pg_temp.as_user((select v from ids where k = 'user1'));
  assert public.so_log_activity('conversations_held', null, 1, 'delta') = 1;
  assert public.so_log_activity('conversations_held', null, 1, 'delta') = 2;
  assert public.so_log_activity('positive_outcomes', v_outcome, 1, 'delta') = 1;
  assert public.so_log_activity('talk_time_minutes', null, 12, 'set') = 12;
  begin
    perform public.so_log_activity('dials_made', null, 1, 'delta');
    raise exception 'a GHL metric was logged';
  exception when others then
    if sqlerrm not like 'ghl_only%' then raise; end if;
  end;
  begin
    perform public.so_log_activity('show_rate', null, 10, 'set');
    raise exception 'show rate was logged by the operator';
  exception when others then
    if sqlerrm not like 'ghl_only%' then raise; end if;
  end;

  assert (select value from public.activity_value v
          join public.activity_day d on d.id = v.activity_day_id
          where d.placement_id = (select v from ids where k = 'p1')
            and v.metric_key = 'conversations_held' and v.source = 'operator') = 2;
  assert (select count(*) from public.activity_value v
          join public.activity_day d on d.id = v.activity_day_id
          where d.placement_id = (select v from ids where k = 'p1')
            and v.metric_key = 'conversations_held' and v.source = 'ghl') = 0;
  assert (select count(*) from public.activity_value_change c
          join public.activity_day d on d.id = c.activity_day_id
          where d.placement_id = (select v from ids where k = 'p1')
            and c.metric_key = 'conversations_held') = 2;
  assert (select changed_at from public.activity_value_change c
          join public.activity_day d on d.id = c.activity_day_id
          where d.placement_id = (select v from ids where k = 'p1')
          order by c.changed_at desc limit 1) is not null;
end $$;

\echo '== an override replaces the default for that operator only; no target means no pace =='
do $$
declare b jsonb; b2 jsonb;
begin
  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000a1');
  perform public.so_set_default_target('conversations_held', null, 10, 50);
  perform public.so_set_override_target((select v from ids where k = 'p1'), 'conversations_held', 4, 20);

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  b := public.so_dashboard_board();
  assert b ->> 'any_logged' = 'true';
  assert (pg_temp.metric(b, 'conversations_held') ->> 'today')::numeric = 2;
  assert (pg_temp.metric(b, 'conversations_held') ->> 'week')::numeric = 2;
  assert (pg_temp.metric(b, 'conversations_held') ->> 'target_today')::numeric = 4;
  assert pg_temp.metric(b, 'conversations_held') ->> 'target_layer_today' = 'override';
  assert (pg_temp.metric(b, 'conversations_held') ->> 'target_week')::numeric = 20;
  assert pg_temp.metric(b, 'texts_sent') -> 'target_today' = 'null'::jsonb;
  assert pg_temp.metric(b, 'texts_sent') -> 'pace_today' = 'null'::jsonb;
  assert jsonb_array_length(pg_temp.metric(b, 'conversations_held') -> 'trend') between 1 and 7;
  assert (pg_temp.metric(b, 'conversations_held') -> 'trend' -> -1 ->> 'value')::numeric = 2;
  assert (select (o ->> 'today')::numeric from jsonb_array_elements(b -> 'outcomes') o where o ->> 'name' = 'Inspection booked') = 1;

  perform pg_temp.as_user((select v from ids where k = 'user2'));
  b2 := public.so_dashboard_board();
  assert (pg_temp.metric(b2, 'conversations_held') ->> 'today')::numeric = 0;
  assert (pg_temp.metric(b2, 'conversations_held') ->> 'target_today')::numeric = 10;
  assert pg_temp.metric(b2, 'conversations_held') ->> 'target_layer_today' = 'default';
  assert not (select bool_or(g ->> 'key' = 'results') from jsonb_array_elements(b2 -> 'groups') g);
  assert not (select bool_or(g ->> 'key' = 'follow_up') from jsonb_array_elements(b2 -> 'groups') g);
  assert pg_temp.metric(b2, 'dials_made') ->> 'today_display' = 'pending_sync';
end $$;

\echo '== system tasks cannot be checked off; a manager task alerts and audits =='
do $$
declare
  v_system uuid;
  v_task uuid;
  v_alert uuid;
  b jsonb;
begin
  perform pg_temp.as_user((select v from ids where k = 'user1'));
  select id into v_system from public.operator_task
  where placement_id = (select v from ids where k = 'p1') and source = 'system' and completed_on is null
  limit 1;
  begin
    perform public.so_complete_task(v_system);
    raise exception 'a system task was checked off';
  exception when others then
    if sqlerrm not like 'system_task%' then raise; end if;
  end;
  begin
    perform public.portal_complete_task(v_system);
    raise exception 'the portal check-off cleared a system task';
  exception when others then
    if sqlerrm not like 'system_task%' then raise; end if;
  end;

  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000b2');
  begin
    perform public.so_delete_task(v_system);
    raise exception 'a system task was deleted';
  exception when others then
    if sqlerrm not like 'system_task%' then raise; end if;
  end;

  -- This manager is not the assigned manager. The task screen still reaches any operator.
  v_task := public.so_save_task(
    null, (select v from ids where k = 'op1'), (select v from ids where k = 'p1'),
    'Call the no-shows', 'Before noon.', current_date - 1, null, 'high', false);
  insert into ids values ('task', v_task);
  assert (select count(*) from public.operator_notification
          where operator_id = (select v from ids where k = 'op1') and kind = 'task_assigned' and read_at is null) = 1;
  assert (select count(*) from public.audit_event where action = 'workspace.task.created' and entity_id = v_task::text) = 1;

  v_task := public.so_save_task(v_task, null, null, 'Call the no-shows today', 'Before noon.', current_date - 1, '09:00', 'high', false);
  assert (select count(*) from public.audit_event where action = 'workspace.task.updated' and entity_id = v_task::text) = 1;

  perform public.so_save_task(
    null, (select v from ids where k = 'op1'), (select v from ids where k = 'p1'),
    'Future only', null, current_date + 7, null, 'normal', false);

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  b := public.so_dashboard_board();
  assert exists (
    select 1 from jsonb_array_elements(b -> 'tasks') t
      where t ->> 'title' = 'Call the no-shows today' and t ->> 'source' = 'manager'
      and t ->> 'priority' = 'high' and t ->> 'overdue' = 'true' and t ->> 'created_by' = 'Other Manager'
  );
  assert not exists (select 1 from jsonb_array_elements(b -> 'tasks') t where t ->> 'title' = 'Future only');
  assert (b ->> 'unread_alerts')::int >= 1;
  assert (b -> 'alerts' -> 0 ->> 'type_label') = 'Task';

  perform public.so_complete_task((select v from ids where k = 'task'));
  b := public.so_dashboard_board();
  assert not exists (select 1 from jsonb_array_elements(b -> 'tasks') t where t ->> 'title' = 'Call the no-shows today');
  assert (b ->> 'done_today')::int >= 1;
  assert (select count(*) from public.audit_event where action = 'workspace.task.completed') = 1;

  select id into v_alert from public.operator_notification
  where operator_id = (select v from ids where k = 'op1') and kind = 'task_assigned' and read_at is null
  limit 1;
  perform public.so_mark_alerts_read(v_alert);
  assert (select read_at is not null from public.operator_notification where id = v_alert);
  assert not exists (
    select 1 from jsonb_array_elements(public.so_dashboard_board() -> 'alerts') a where a ->> 'id' = v_alert::text
  );
  assert exists (
    select 1 from jsonb_array_elements(public.so_alerts()) a
    where a ->> 'id' = v_alert::text and a ->> 'read' = 'true'
  );

  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000b1');
  perform public.so_delete_task((select v from ids where k = 'task'));
  assert (select count(*) from public.audit_event where action = 'workspace.task.deleted') = 1;
  assert not exists (select 1 from public.operator_task where id = (select v from ids where k = 'task'));
end $$;

\echo '== one operator cannot read another, and a locked EOD refuses the log =='
do $$
declare v_eod uuid;
begin
  perform pg_temp.as_user((select v from ids where k = 'user2'));
  begin
    perform public.so_eod_read((select v from ids where k = 'yester'));
    raise exception 'operator 2 read operator 1''s EOD';
  exception when others then
    if sqlerrm not like 'not_found%' then raise; end if;
  end;
  begin
    perform public.so_save_task(null, (select v from ids where k = 'op1'), (select v from ids where k = 'p1'),
      'Sneaky task here', null, null, null, 'normal', false);
    raise exception 'an operator created a task';
  exception when others then
    if sqlerrm not like 'permission_denied%' then raise; end if;
  end;

  perform pg_temp.as_user((select v from ids where k = 'user1'));
  v_eod := (public.so_dashboard() #>> '{eod,today,id}')::uuid;
  update public.sales_eod set status = 'submitted', submitted_at = now(), wins = 'Two inspections.' where id = v_eod;
  assert (select completed_on is not null from public.operator_task
          where placement_id = (select v from ids where k = 'p1') and system_key = 'eod:' || (public.so_dashboard() ->> 'today'))
    , 'submitting the EOD completes today''s system task';
  update public.sales_eod set locked_at = now() - interval '1 minute' where id = v_eod;
  begin
    perform public.so_log_activity('conversations_held', null, 1, 'delta');
    raise exception 'a locked day accepted a log';
  exception when others then
    if sqlerrm not like 'eod_locked%' then raise; end if;
  end;

  -- Read-only history still opens, including feedback, and never the token.
  insert into public.client_feedback_token (placement_id, period_start, period_end, token_hash, expires_at)
  values ((select v from ids where k = 'p1'), current_date - 14, current_date,
          encode(extensions.digest('dash-token', 'sha256'), 'hex'), now() + interval '14 days');
  insert into public.sales_eod_feedback (eod_id, author_kind, author_profile_id, body)
  values ((select v from ids where k = 'yester'), 'manager', '99000000-0000-4000-8000-0000000000b1', 'Push the inspections.');
  assert public.so_eod_read((select v from ids where k = 'yester')) -> 'feedback' -> 0 ->> 'author_name' = 'Dash Manager';
  assert public.so_eod_read((select v from ids where k = 'yester'))::text not like '%dash-token%';
  assert public.so_eod_read((select v from ids where k = 'yester'))::text not like '%token_hash%';
  assert exists (
    select 1 from jsonb_array_elements(public.so_eod_list()) e where e ->> 'status' = 'late' and (e ->> 'has_feedback')::boolean
  );
end $$;

\echo '== operators have no direct read of the rows =='
set local role authenticated;
select set_config('request.jwt.claim.sub', '99000000-0000-4000-8000-0000000000c2', true);
do $$
begin
  assert (select count(*) from public.activity_value) = 0;
  assert (select count(*) from public.activity_value_change) = 0;
  assert (select count(*) from public.operator_task) = 0;
  assert (select count(*) from public.sales_eod) = 0;
  assert (select count(*) from public.activity_mismatch) = 0;
end $$;
reset role;

\echo '== view-as is read-only and the page is audited =='
do $$
declare w jsonb;
begin
  insert into public.impersonation (actor_profile_id, target_profile_id, reason, expires_at, kind, reason_kind)
  values (
    '99000000-0000-4000-8000-0000000000b1',
    (select v from ids where k = 'user1'),
    'Quality review: checking the dashboard',
    now() + interval '30 minutes',
    'view_as', 'quality_review'
  );
  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000b1');
  w := public.so_dashboard();
  assert w #>> '{viewer,view_as}' = 'true';
  assert w #>> '{placement,client_name}' = 'North Client';
  assert w ->> 'quick_log_open' = 'false';
  assert (select count(*) from public.audit_event where action = 'view_as.viewed' and entity_id = 'workspace') >= 1;
  begin
    perform public.so_log_activity('conversations_held', null, 1, 'delta');
    raise exception 'view-as logged a number';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' then raise; end if;
  end;
  begin
    perform public.so_mark_alerts_read(null);
    raise exception 'view-as marked alerts read';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' then raise; end if;
  end;
  begin
    perform public.so_complete_task((select id from public.operator_task where placement_id = (select v from ids where k = 'p1') and source = 'manager' limit 1));
    raise exception 'view-as checked off a task';
  exception when others then
    if sqlerrm not like 'view_as_read_only%' and sqlerrm not like 'task_not_found%' then raise; end if;
  end;
end $$;

\echo '== a paused placement stays read-only, with past EODs =='
do $$
declare w jsonb; v_eod uuid; v_day uuid;
begin
  -- The previous test left a View As session on the manager. Direct writes are blocked while it is open.
  perform pg_temp.as_user('99000000-0000-4000-8000-0000000000a1');
  update public.impersonation set ended_at = now(), ended_reason = 'ended' where ended_at is null;
  select id into v_day from public.activity_day
  where placement_id = (select v from ids where k = 'p3') limit 1;
  if v_day is null then
    insert into public.activity_day (operator_id, placement_id, work_date)
    values ((select v from ids where k = 'op3'), (select v from ids where k = 'p3'), current_date - 3)
    returning id into v_day;
  end if;
  insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, status, deadline_at, submitted_at, wins)
  values ((select v from ids where k = 'op3'), (select v from ids where k = 'p3'), current_date - 3, v_day,
          'submitted', now() - interval '3 days', now() - interval '3 days', 'A quiet day.')
  returning id into v_eod;

  perform pg_temp.as_user((select v from ids where k = 'user3'));
  w := public.so_dashboard();
  assert w ->> 'state' = 'paused';
  assert w #>> '{placement,client_name}' = 'North Client';
  begin
    perform public.so_log_activity('conversations_held', null, 1, 'delta');
    raise exception 'a paused placement accepted a log';
  exception when others then
    if sqlerrm not like 'no_workspace%' then raise; end if;
  end;
  assert jsonb_array_length(public.so_eod_list()) = 1;
  assert public.so_eod_read(v_eod) ->> 'wins' = 'A quiet day.';
  -- Opening the dashboard did not start a new working-day record.
  assert (select count(*) from public.sales_eod where placement_id = (select v from ids where k = 'p3') and status = 'not_started') = 0;
end $$;

\echo '== certification warning, grace, then no access =='
do $$
declare w jsonb;
begin
  update public.academy_certification
     set recertify_on = current_date - 1
   where profile_id = (select v from ids where k = 'user1');
  perform pg_temp.as_user((select v from ids where k = 'user1'));
  w := public.so_dashboard();
  assert w ->> 'state' = 'active', 'grace keeps the workspace open: ' || w::text;
  assert w #>> '{certification,phase}' = 'grace';
  assert (w #>> '{certification,grace_ends_on}')::date = current_date - 1 + 7;

  update public.academy_certification
     set recertify_on = current_date + 5
   where profile_id = (select v from ids where k = 'user1');
  w := public.so_dashboard();
  assert w #>> '{certification,phase}' = 'warning';
  assert (w #>> '{certification,recertify_on}')::date = current_date + 5;

  update public.academy_certification
     set recertify_on = current_date + 40
   where profile_id = (select v from ids where k = 'user1');
  w := public.so_dashboard();
  assert w -> 'certification' = 'null'::jsonb;

  update public.academy_certification
     set recertify_on = current_date - 30
   where profile_id = (select v from ids where k = 'user1');
  w := public.so_dashboard();
  assert w ->> 'state' = 'not_certified';
end $$;

\echo '== anon cannot call the dashboard =='
set local role anon;
do $$
begin
  perform public.so_dashboard();
  raise exception 'anon opened the dashboard';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;
\echo 'sales dashboard: ok'
