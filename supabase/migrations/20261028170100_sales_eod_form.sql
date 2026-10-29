-- EOD form, review, feedback, excuses, and the edit unlock.

create or replace function app.so_lock_at(p public.placement, p_submitted timestamptz, p_day date)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule text;
  v_hours integer;
begin
  select eod_edit_rule, eod_edit_hours_after into v_rule, v_hours from public.team_setting where id = 1;
  if v_rule = 'never' then
    return p_submitted;
  end if;
  if v_rule = 'hours_after_submit' then
    return p_submitted + make_interval(hours => coalesce(v_hours, 1));
  end if;
  return coalesce(app.so_next_shift_start(p, p_day), p_submitted + interval '18 hours');
end;
$$;

revoke all on function app.so_lock_at(public.placement, timestamptz, date) from public, anon, authenticated;

create or replace function app.so_hours_total(p_start text, p_end text, p_break integer)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_start time;
  v_end time;
  v_minutes numeric;
begin
  if p_start is null or p_end is null or p_start !~ '^\d{2}:\d{2}' or p_end !~ '^\d{2}:\d{2}' then
    return null;
  end if;
  v_start := p_start::time;
  v_end := p_end::time;
  v_minutes := extract(epoch from (v_end - v_start)) / 60;
  if v_minutes < 0 then
    v_minutes := v_minutes + 1440;
  end if;
  v_minutes := v_minutes - coalesce(p_break, 0);
  if v_minutes < 0 then
    v_minutes := 0;
  end if;
  if v_minutes > 1440 then
    v_minutes := 1440;
  end if;
  return round(v_minutes / 60.0, 2);
end;
$$;

revoke all on function app.so_hours_total(text, text, integer) from public, anon, authenticated;

create or replace function app.so_require_own_eod(p_day date)
returns public.sales_eod
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_op public.operator;
  v_pl public.placement;
  v_eod public.sales_eod;
  v_day uuid;
begin
  perform app.so_refuse_view_as();
  v_ws := public.so_workspace();
  if v_ws ->> 'state' is distinct from 'active' then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  if p_day is null then
    p_day := app.so_work_date(v_pl, now());
  end if;
  if exists (select 1 from public.sales_excused_day x where x.placement_id = v_pl.id and x.work_date = p_day) then
    raise exception 'excused: this day is excused. No EOD is due.' using errcode = '42501';
  end if;
  if not (extract(isodow from p_day)::smallint = any (v_pl.working_days)) then
    raise exception 'not_a_working_day: no EOD is due on this day' using errcode = '23514';
  end if;
  if p_day > app.so_work_date(v_pl, now()) then
    raise exception 'not_due: that working day has not started' using errcode = '23514';
  end if;
  if p_day is distinct from app.so_work_date(v_pl, now())
     and not exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = p_day) then
    raise exception 'not_due: no EOD is open for that day' using errcode = '23514';
  end if;
  if p_day = v_pl.start_date
     and not exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = p_day) then
    declare
      v_bounds record;
    begin
      select * into v_bounds from app.shift_bounds(v_pl, p_day);
      if v_bounds.ends_at is not null and now() >= v_bounds.ends_at then
        raise exception 'not_due: the shift had already ended when this placement became active' using errcode = '23514';
      end if;
    end;
  end if;
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_op.id, v_pl.id, p_day)
  on conflict (operator_id, placement_id, work_date) do nothing;
  select id into v_day from public.activity_day
  where operator_id = v_op.id and placement_id = v_pl.id and work_date = p_day;
  if not exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = p_day) then
    insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at, status)
    values (v_op.id, v_pl.id, p_day, v_day, app.so_eod_deadline(v_pl, p_day), 'not_started');
  end if;
  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = p_day;
  if not app.so_quick_log_open(v_pl, v_eod) then
    raise exception 'eod_locked: this EOD is locked' using errcode = '42501';
  end if;
  perform app.so_upsert_system_task(
    v_op.id, v_pl.id, p_day, 'Submit today''s EOD',
    coalesce(v_pl.eod_deadline, v_pl.shift_end), v_eod.submitted_at is not null, v_eod.submitted_at);
  return v_eod;
end;
$$;

revoke all on function app.so_require_own_eod(date) from public, anon, authenticated;

create or replace function public.so_eod_form(p_day date default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_op public.operator;
  v_pl public.placement;
  v_day date;
  v_eod public.sales_eod;
  v_prev date;
  v_prev_eod public.sales_eod;
  v_metrics jsonb := '[]'::jsonb;
  v_metric public.activity_metric;
  v_group text;
  v_pending boolean;
  v_value numeric;
  v_target public.activity_target;
  v_outcomes jsonb;
  v_min integer;
  v_hours boolean;
  v_note boolean;
  v_open boolean;
begin
  perform public.so_eod_sweep();
  v_ws := public.so_workspace();
  if v_ws ->> 'state' not in ('active', 'paused') then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_day := coalesce(p_day, app.so_work_date(v_pl, now()));
  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_day;
  if v_eod.id is null and v_ws ->> 'state' = 'active' and not app.is_impersonating()
     and not exists (select 1 from public.sales_excused_day x where x.placement_id = v_pl.id and x.work_date = v_day) then
    v_eod := app.so_require_own_eod(v_day);
  end if;
  v_open := v_eod.id is not null and app.so_quick_log_open(v_pl, v_eod) and not app.is_impersonating();

  for v_metric in select * from public.activity_metric where active order by sort_order, key loop
    v_group := app.so_metric_group(v_metric.key, v_metric.category);
    continue when v_group is null or v_metric.by_outcome;
    continue when v_group in ('outbound', 'ghl') and not ('outbound_calling' = any(v_pl.activity_categories));
    continue when v_group = 'follow_up' and not ('follow_up' = any(v_pl.activity_categories));
    continue when v_group = 'reactivation' and not ('reactivation' = any(v_pl.activity_categories));
    continue when v_group = 'results' and not v_pl.tracks_results;
    if v_metric.source = 'ghl' then
      v_pending := not app.so_has_value(v_pl.id, v_metric.key, 'ghl', v_day, v_day);
      v_value := case when v_pending then null else app.so_value_sum(v_pl.id, v_metric.key, 'ghl', null, false, v_day, v_day) end;
    else
      v_pending := false;
      v_value := app.so_value_sum(v_pl.id, v_metric.key, 'operator', null, false, v_day, v_day);
    end if;
    v_target := app.so_target(v_pl.id, v_metric.key, v_day);
    v_metrics := v_metrics || jsonb_build_array(jsonb_build_object(
      'key', v_metric.key, 'label', v_metric.label, 'unit', v_metric.unit, 'group', app.so_group_label(v_group),
      'editable', v_metric.operator_editable and v_metric.source <> 'ghl' and v_open,
      'display', case when v_pending then 'pending_sync' else 'number' end,
      'value', v_value,
      'target', case when v_target.daily is not null and v_target.daily > 0 then v_target.daily else null end
    ));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'name', o.name,
           'value', app.so_value_sum(v_pl.id, 'positive_outcomes', 'operator', o.id, false, v_day, v_day)
         ) order by o.sort_order, o.name), '[]'::jsonb)
    into v_outcomes
  from public.placement_outcome_type o
  where o.placement_id = v_pl.id and o.active;

  v_prev := app.so_previous_work_date(v_pl, v_day);
  select * into v_prev_eod from public.sales_eod
  where placement_id = v_pl.id and work_date = v_prev and submitted_at is not null;

  select eod_min_text_chars, eod_hours_worked_enabled, eod_note_to_manager_enabled
    into v_min, v_hours, v_note
  from public.team_setting where id = 1;

  return jsonb_build_object(
    'work_date', v_day,
    'status', coalesce(v_eod.status, 'not_started'),
    'deadline_at', coalesce(v_eod.deadline_at, app.so_eod_deadline(v_pl, v_day)),
    'submitted_at', v_eod.submitted_at,
    'was_late', coalesce(v_eod.was_late, false),
    'edited_after_submit', coalesce(v_eod.edited_after_submit, false),
    'editable', v_open,
    'view_as', app.is_impersonating(),
    'updated_at', v_eod.updated_at,
    'wins', v_eod.wins,
    'blockers', v_eod.blockers,
    'needs_help', coalesce(v_eod.needs_help, false),
    'plan_items', coalesce(v_eod.plan_items, '[]'::jsonb),
    'note_to_manager', v_eod.note_to_manager,
    'hours_start', v_eod.hours_start,
    'hours_end', v_eod.hours_end,
    'break_minutes', v_eod.break_minutes,
    'hours_enabled', coalesce(v_hours, false),
    'note_enabled', coalesce(v_note, false),
    'min_chars', coalesce(v_min, 20),
    'time_zone', v_pl.time_zone,
    'metrics', v_metrics,
    'outcomes', v_outcomes,
    'yesterday_plan', case when v_prev_eod.id is null then '[]'::jsonb else coalesce(v_prev_eod.plan_items, '[]'::jsonb) end,
    'yesterday', v_prev,
    'excused', exists (select 1 from public.sales_excused_day x where x.placement_id = v_pl.id and x.work_date = v_day)
  );
end;
$$;

revoke all on function public.so_eod_form(date) from public, anon;
grant execute on function public.so_eod_form(date) to authenticated;

create or replace function public.so_eod_save(p_day date, p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_pl public.placement;
  v_plan jsonb := coalesce(p_body -> 'plan_items', '[]'::jsonb);
  v_wins text := nullif(btrim(coalesce(p_body ->> 'wins', '')), '');
  v_blockers text := nullif(btrim(coalesce(p_body ->> 'blockers', '')), '');
  v_note text := nullif(btrim(coalesce(p_body ->> 'note_to_manager', '')), '');
  v_start text := nullif(btrim(coalesce(p_body ->> 'hours_start', '')), '');
  v_end text := nullif(btrim(coalesce(p_body ->> 'hours_end', '')), '');
  v_break integer := nullif(p_body ->> 'break_minutes', '')::integer;
  v_help boolean := coalesce((p_body ->> 'needs_help')::boolean, false);
  v_text text := '';
  v_item jsonb;
  v_edits integer;
begin
  if v_break is not null and v_break not between 0 and 1440 then
    raise exception 'invalid: break minutes stay between 0 and 1440' using errcode = '23514';
  end if;
  if jsonb_typeof(v_plan) <> 'array' or jsonb_array_length(v_plan) > 5 then
    raise exception 'invalid: tomorrow''s plan is at most five lines' using errcode = '23514';
  end if;
  for v_item in select value from jsonb_array_elements(v_plan) loop
    v_text := v_text || coalesce(v_item ->> 'text', '');
  end loop;
  v_eod := app.so_require_own_eod(p_day);
  v_edits := v_eod.edit_count;
  select * into v_pl from public.placement where id = v_eod.placement_id;
  update public.sales_eod set
    wins = v_wins,
    blockers = v_blockers,
    needs_help = v_help,
    plan_items = v_plan,
    tomorrow_plan = nullif(v_text, ''),
    note_to_manager = v_note,
    hours_start = v_start,
    hours_end = v_end,
    break_minutes = v_break,
    hours_worked = app.so_hours_total(v_start, v_end, v_break),
    status = case
      when status = 'not_started' then 'draft'
      else status
    end
  where id = v_eod.id
  returning * into v_eod;

  if v_eod.edit_count > v_edits and exists (select 1 from public.sales_eod_feedback f where f.eod_id = v_eod.id and f.author_kind in ('manager', 'admin')) then
    perform app.so_staff_alert('eod_edited', v_eod.operator_id, v_eod.placement_id, v_pl.manager_profile_id, v_eod.work_date,
      format('EOD for %s was edited after feedback.', v_eod.work_date));
  end if;

  return jsonb_build_object('ok', true, 'status', v_eod.status, 'updated_at', v_eod.updated_at, 'edited', v_eod.edited_after_submit);
end;
$$;

revoke all on function public.so_eod_save(date, jsonb) from public, anon;
grant execute on function public.so_eod_save(date, jsonb) to authenticated;

create or replace function public.so_eod_submit(p_day date, p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_saved jsonb;
  v_eod public.sales_eod;
  v_pl public.placement;
  v_op public.operator;
  v_min integer;
  v_wins text;
  v_blockers text;
  v_plan jsonb;
  v_count integer := 0;
  v_item jsonb;
  v_late boolean;
  v_status text;
  v_name text;
  v_already timestamptz;
begin
  select e.submitted_at into v_already
  from public.sales_eod e
  where e.work_date = p_day
    and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
  if v_already is not null then
    raise exception 'already_submitted: this EOD is already in. Save the edit instead.' using errcode = '23514';
  end if;
  v_saved := public.so_eod_save(p_day, p_body);
  select * into v_eod from public.sales_eod e
  where e.work_date = p_day
    and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
  select * into v_pl from public.placement where id = v_eod.placement_id;
  select * into v_op from public.operator where id = v_eod.operator_id;
  select coalesce(eod_min_text_chars, 20) into v_min from public.team_setting where id = 1;
  v_wins := coalesce(v_eod.wins, '');
  v_blockers := coalesce(v_eod.blockers, '');
  if length(v_wins) < v_min then
    raise exception 'too_short: Wins needs at least % characters.', v_min using errcode = '23514';
  end if;
  if v_blockers <> 'No blockers today.' and length(v_blockers) < v_min then
    raise exception 'too_short: Blockers needs at least % characters, or tick No blockers today.', v_min using errcode = '23514';
  end if;
  v_plan := coalesce(v_eod.plan_items, '[]'::jsonb);
  for v_item in select value from jsonb_array_elements(v_plan) loop
    if length(btrim(coalesce(v_item ->> 'text', ''))) > 0 then
      v_count := v_count + 1;
    end if;
  end loop;
  if v_count < 1 then
    raise exception 'plan_required: add at least one priority for the next working day' using errcode = '23514';
  end if;

  v_late := now() > v_eod.deadline_at or v_eod.status in ('late', 'missed');
  v_status := case when v_eod.status = 'missed' then 'missed' else 'submitted' end;
  update public.sales_eod set
    status = v_status,
    submitted_at = coalesce(submitted_at, now()),
    was_late = v_late,
    locked_at = app.so_lock_at(v_pl, coalesce(submitted_at, now()), work_date)
  where id = v_eod.id
  returning * into v_eod;

  perform app.so_upsert_system_task(v_op.id, v_pl.id, v_eod.work_date, 'Submit today''s EOD',
    coalesce(v_pl.eod_deadline, v_pl.shift_end), true, v_eod.submitted_at);
  select name into v_name from public.operator where id = v_op.id;
  perform app.so_staff_alert('eod_submitted', v_op.id, v_pl.id, v_pl.manager_profile_id, v_eod.work_date,
    format('%s submitted the EOD for %s%s.', v_name, v_eod.work_date, case when v_late then ' (late)' else '' end));
  if v_eod.needs_help then
    perform app.so_staff_alert('eod_needs_help', v_op.id, v_pl.id, v_pl.manager_profile_id, v_eod.work_date,
      format('%s needs manager help on the EOD for %s.', v_name, v_eod.work_date));
  end if;
  insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
  values (v_eod.id, null, v_eod.status, 'submitted', case when v_late then 'Submitted late.' else 'Submitted on time.' end);
  perform app.audit('workspace.eod.submitted', 'sales_eod', v_eod.id::text,
    format('%s submitted the EOD for %s%s', v_name, v_eod.work_date, case when v_late then ' late' else ' on time' end),
    null, jsonb_build_object('status', v_eod.status, 'was_late', v_late, 'needs_help', v_eod.needs_help), v_pl.case_file_id);

  return jsonb_build_object('ok', true, 'status', v_eod.status, 'was_late', v_eod.was_late, 'submitted_at', v_eod.submitted_at);
end;
$$;

revoke all on function public.so_eod_submit(date, jsonb) from public, anon;
grant execute on function public.so_eod_submit(date, jsonb) to authenticated;

create or replace function public.so_plan_tick(p_eod_id uuid, p_index integer, p_done boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_items jsonb;
  v_item jsonb;
  i integer := 0;
begin
  perform app.so_refuse_view_as();
  select * into v_eod from public.sales_eod e
  where e.id = p_eod_id
    and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
  if v_eod.id is null then
    raise exception 'not_found: that plan is not yours' using errcode = 'P0002';
  end if;
  v_items := '[]'::jsonb;
  for v_item in select value from jsonb_array_elements(coalesce(v_eod.plan_items, '[]'::jsonb)) loop
    if i = p_index then
      v_item := v_item || jsonb_build_object('done_at', case when p_done then now() else null end);
    end if;
    v_items := v_items || jsonb_build_array(v_item);
    i := i + 1;
  end loop;
  update public.sales_eod set plan_items = v_items where id = v_eod.id;
  return v_items;
end;
$$;

revoke all on function public.so_plan_tick(uuid, integer, boolean) from public, anon;
grant execute on function public.so_plan_tick(uuid, integer, boolean) to authenticated;

create or replace function public.so_today_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_pl public.placement;
  v_today date;
  v_prev date;
  v_eod public.sales_eod;
begin
  v_ws := public.so_workspace();
  if v_ws ->> 'state' is distinct from 'active' then
    return '[]'::jsonb;
  end if;
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_today := app.so_work_date(v_pl, now());
  v_prev := app.so_previous_work_date(v_pl, v_today);
  select * into v_eod from public.sales_eod
  where placement_id = v_pl.id and work_date = v_prev and submitted_at is not null;
  if v_eod.id is null then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;
  return jsonb_build_object('eod_id', v_eod.id, 'work_date', v_prev, 'items', coalesce(v_eod.plan_items, '[]'::jsonb));
end;
$$;

revoke all on function public.so_today_plan() from public, anon;
grant execute on function public.so_today_plan() to authenticated;

-- 4. Review, feedback, excuse, unlock -------------------------------------------------

create or replace function app.so_require_staff_eod(p_eod uuid)
returns public.sales_eod
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
begin
  perform app.so_require_staff();
  select * into v_eod from public.sales_eod where id = p_eod;
  if v_eod.id is null then
    raise exception 'not_found: that EOD does not exist' using errcode = 'P0002';
  end if;
  return v_eod;
end;
$$;

revoke all on function app.so_require_staff_eod(uuid) from public, anon, authenticated;

create or replace function public.so_eod_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.so_require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'work_date', e.work_date, 'status', e.status, 'was_late', e.was_late,
      'needs_help', e.needs_help, 'escalated_at', e.escalated_at, 'reviewed_at', e.reviewed_at,
      'operator_name', o.name, 'client_name', cf.name, 'placement_id', e.placement_id,
      'submitted_at', e.submitted_at
    ) order by e.needs_help desc, e.escalated_at desc nulls last, e.submitted_at desc)
    from public.sales_eod e
    join public.operator o on o.id = e.operator_id
    join public.placement pl on pl.id = e.placement_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    where e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused'
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_eod_queue() from public, anon;
grant execute on function public.so_eod_queue() to authenticated;

create or replace function public.so_eod_staff(p_eod uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_feedback jsonb;
  v_events jsonb;
begin
  v_eod := app.so_require_staff_eod(p_eod);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id, 'parent_id', f.parent_id, 'author_kind', f.author_kind,
           'author_name', coalesce(app.profile_name(f.author_profile_id), f.author_kind),
           'body', f.body, 'rating', f.rating, 'created_at', f.created_at
         ) order by f.created_at), '[]'::jsonb)
    into v_feedback
  from public.sales_eod_feedback f where f.eod_id = v_eod.id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'from_status', ev.from_status, 'to_status', ev.to_status, 'step', ev.step,
           'detail', ev.detail, 'happened_at', ev.happened_at
         ) order by ev.happened_at), '[]'::jsonb)
    into v_events
  from public.sales_eod_event ev where ev.eod_id = v_eod.id;
  return jsonb_build_object(
    'id', v_eod.id, 'work_date', v_eod.work_date, 'status', v_eod.status, 'was_late', v_eod.was_late,
    'needs_help', v_eod.needs_help, 'wins', v_eod.wins, 'blockers', v_eod.blockers,
    'plan_items', v_eod.plan_items, 'note_to_manager', v_eod.note_to_manager,
    'hours_worked', v_eod.hours_worked, 'submitted_at', v_eod.submitted_at,
    'reviewed_at', v_eod.reviewed_at, 'escalated_at', v_eod.escalated_at, 'escalation_reason', v_eod.escalation_reason,
    'edited_after_submit', v_eod.edited_after_submit, 'prior_status', v_eod.prior_status,
    'placement_id', v_eod.placement_id, 'operator_id', v_eod.operator_id,
    'feedback', v_feedback, 'events', v_events
  );
end;
$$;

revoke all on function public.so_eod_staff(uuid) from public, anon;
grant execute on function public.so_eod_staff(uuid) to authenticated;

create or replace function public.so_eod_mark_reviewed(p_eod uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_case uuid;
begin
  v_eod := app.so_require_staff_eod(p_eod);
  update public.sales_eod set reviewed_at = now(), reviewed_by = auth.uid() where id = v_eod.id and reviewed_at is null;
  select case_file_id into v_case from public.placement where id = v_eod.placement_id;
  perform app.audit('workspace.eod.reviewed', 'sales_eod', v_eod.id::text,
    format('Reviewed the EOD for %s', v_eod.work_date), null, jsonb_build_object('reviewed_by', auth.uid()), v_case);
end;
$$;

revoke all on function public.so_eod_mark_reviewed(uuid) from public, anon;
grant execute on function public.so_eod_mark_reviewed(uuid) to authenticated;

create or replace function public.so_eod_feedback(p_eod uuid, p_body text, p_rating integer, p_parent uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_id uuid;
  v_kind text;
  v_case uuid;
  v_op public.operator;
begin
  if nullif(btrim(coalesce(p_body, '')), '') is null then
    raise exception 'required: write the feedback' using errcode = '23514';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'invalid: the rating is 1 to 5' using errcode = '23514';
  end if;

  if app.is_admin() or app.is_manager() then
    v_eod := app.so_require_staff_eod(p_eod);
    v_kind := case when app.is_admin() then 'admin' else 'manager' end;
  else
    perform app.so_refuse_view_as();
    select * into v_eod from public.sales_eod e
    where e.id = p_eod and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
    if v_eod.id is null or p_parent is null then
      raise exception 'not_found: reply on your own EOD, under a feedback note' using errcode = 'P0002';
    end if;
    v_kind := 'operator';
  end if;

  if p_parent is not null and not exists (
    select 1 from public.sales_eod_feedback f
    where f.id = p_parent and f.eod_id = v_eod.id and f.author_kind <> 'client'
  ) then
    raise exception 'not_found: reply under a note on this EOD' using errcode = 'P0002';
  end if;
  if v_kind = 'operator' and not exists (
    select 1 from public.sales_eod_feedback f
    where f.id = p_parent and f.eod_id = v_eod.id and f.author_kind in ('manager', 'admin')
  ) then
    raise exception 'not_found: reply under a manager or admin note' using errcode = 'P0002';
  end if;

  insert into public.sales_eod_feedback (eod_id, author_kind, author_profile_id, body, rating, parent_id)
  values (v_eod.id, v_kind, auth.uid(), btrim(p_body), p_rating, p_parent)
  returning id into v_id;

  select * into v_op from public.operator where id = v_eod.operator_id;
  select case_file_id into v_case from public.placement where id = v_eod.placement_id;
  if v_kind <> 'operator' then
    perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'feedback_received',
      'Feedback on your EOD', left(btrim(p_body), 280),
      '/workspace/operator/workspace/history/' || v_eod.id::text);
  else
    perform app.so_staff_alert('eod_feedback', v_eod.operator_id, v_eod.placement_id,
      (select manager_profile_id from public.placement where id = v_eod.placement_id), v_eod.work_date,
      format('%s replied on the EOD for %s.', v_op.name, v_eod.work_date));
  end if;
  perform app.audit('workspace.eod.feedback', 'sales_eod_feedback', v_id::text,
    format('%s left feedback on the EOD for %s', v_kind, v_eod.work_date),
    null, jsonb_build_object('rating', p_rating, 'parent_id', p_parent), v_case);
  return v_id;
end;
$$;

revoke all on function public.so_eod_feedback(uuid, text, integer, uuid) from public, anon;
grant execute on function public.so_eod_feedback(uuid, text, integer, uuid) to authenticated;

create or replace function public.so_eod_escalate(p_eod uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_case uuid;
begin
  if not app.is_manager() and not app.is_admin() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'required: say why this needs DA Admin' using errcode = '23514';
  end if;
  v_eod := app.so_require_staff_eod(p_eod);
  update public.sales_eod
     set escalated_at = now(), escalated_by = auth.uid(), escalation_reason = btrim(p_reason)
   where id = v_eod.id;
  select case_file_id into v_case from public.placement where id = v_eod.placement_id;
  perform app.so_staff_alert('eod_escalated', v_eod.operator_id, v_eod.placement_id, null, v_eod.work_date,
    format('Escalated EOD for %s. %s', v_eod.work_date, btrim(p_reason)));
  insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
  values (v_eod.id, v_eod.status, v_eod.status, 'escalated', btrim(p_reason));
  perform app.audit('workspace.eod.escalated', 'sales_eod', v_eod.id::text,
    format('Escalated the EOD for %s', v_eod.work_date), null, jsonb_build_object('reason', btrim(p_reason)), v_case);
end;
$$;

revoke all on function public.so_eod_escalate(uuid, text) from public, anon;
grant execute on function public.so_eod_escalate(uuid, text) to authenticated;

create or replace function public.so_eod_unlock(p_eod uuid, p_hours integer, p_reason text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_until timestamptz;
  v_case uuid;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin unlocks an EOD' using errcode = '42501';
  end if;
  if coalesce(p_hours, 0) not between 1 and 72 then
    raise exception 'invalid: unlock for 1 to 72 hours' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'required: say why this EOD is unlocked' using errcode = '23514';
  end if;
  v_eod := app.so_require_staff_eod(p_eod);
  v_until := now() + make_interval(hours => p_hours);
  update public.sales_eod set unlocked_until = v_until where id = v_eod.id;
  select case_file_id into v_case from public.placement where id = v_eod.placement_id;
  perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'eod_reminder',
    'EOD unlocked',
    format('DA unlocked your EOD for %s for %s hours. %s', v_eod.work_date, p_hours, btrim(p_reason)),
    '/workspace/operator/workspace/eod?day=' || v_eod.work_date::text);
  insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
  values (v_eod.id, v_eod.status, v_eod.status, 'unlocked', btrim(p_reason));
  perform app.audit('workspace.eod.unlocked', 'sales_eod', v_eod.id::text,
    format('Unlocked the EOD for %s for %s hours', v_eod.work_date, p_hours),
    null, jsonb_build_object('until', v_until, 'reason', btrim(p_reason)), v_case);
  return v_until;
end;
$$;

revoke all on function public.so_eod_unlock(uuid, integer, text) from public, anon;
grant execute on function public.so_eod_unlock(uuid, integer, text) to authenticated;

create or replace function public.so_excuse_days(p_placement uuid, p_dates date[], p_reason text, p_note text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_day date;
  v_eod public.sales_eod;
  v_count integer := 0;
  v_case uuid;
begin
  perform app.so_require_staff();
  if p_reason not in ('time_off', 'sick', 'client_closed', 'holiday', 'system_outage', 'other') then
    raise exception 'invalid: pick a reason' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement and placement_type is not null;
  if v_pl.id is null then
    raise exception 'not_found: that is not a workspace placement' using errcode = 'P0002';
  end if;
  v_case := v_pl.case_file_id;
  foreach v_day in array p_dates loop
    insert into public.sales_excused_day (operator_id, placement_id, work_date, reason, note, excused_by)
    values (v_pl.operator_id, v_pl.id, v_day, p_reason, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    on conflict (placement_id, work_date) do update
      set reason = excluded.reason, note = excluded.note, excused_by = excluded.excused_by;
    select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_day;
    if v_eod.id is not null and v_eod.submitted_at is null and v_eod.status <> 'excused' then
      update public.sales_eod
         set prior_status = coalesce(prior_status, status), status = 'excused'
       where id = v_eod.id;
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, 'excused', 'excused', p_reason);
    end if;
    update public.operator_task
       set completed_on = v_day, completed_at = coalesce(completed_at, now())
     where placement_id = v_pl.id
       and system_key = 'eod:' || v_day::text
       and completed_on is null;
    perform app.audit('workspace.eod.excused', 'sales_excused_day', v_pl.id::text,
      format('Excused %s (%s)', v_day, p_reason), null, jsonb_build_object('work_date', v_day, 'reason', p_reason, 'note', p_note), v_case);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.so_excuse_days(uuid, date[], text, text) from public, anon;
grant execute on function public.so_excuse_days(uuid, date[], text, text) to authenticated;

create or replace function public.so_excused_days()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'work_date', x.work_date, 'reason', x.reason, 'note', x.note
         ) order by x.work_date desc), '[]'::jsonb)
  from public.sales_excused_day x
  join public.placement pl on pl.id = x.placement_id
  where pl.operator_id = (select id from public.operator where profile_id = app.acting_profile())
    and pl.placement_type is not null
    and pl.status in ('active', 'paused');
$$;

revoke all on function public.so_excused_days() from public, anon;
grant execute on function public.so_excused_days() to authenticated;
