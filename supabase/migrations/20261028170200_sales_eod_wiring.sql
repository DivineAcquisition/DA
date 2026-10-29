-- Wires the EOD clock into the dashboard day, the edit window, settings, and
-- the Team Workspace queue. View As still cannot write. The sweep can.

create or replace function app.so_block_impersonated_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.eod_sweep', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: viewing as this person cannot change their numbers, reports, or alerts. Exit View As to make a change.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.so_block_impersonated_write() from public, anon, authenticated;

-- The row for a working day appears at shift start. An excused day never gets one.
-- A placement that turns Active after the shift has ended waits until the next day.
create or replace function app.so_sync_day(p_op uuid, p public.placement, p_today date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day uuid;
  v_eod public.sales_eod;
  v_yesterday date;
  v_prev public.sales_eod;
  v_due text := coalesce(p.eod_deadline, p.shift_end);
  v_bounds record;
  v_excused boolean;
  v_open boolean;
begin
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (p_op, p.id, p_today)
  on conflict (operator_id, placement_id, work_date) do nothing;

  select id into v_day
  from public.activity_day
  where operator_id = p_op and placement_id = p.id and work_date = p_today;

  select * into v_bounds from app.shift_bounds(p, p_today);
  v_excused := exists (
    select 1 from public.sales_excused_day x where x.placement_id = p.id and x.work_date = p_today
  );
  select * into v_eod from public.sales_eod where placement_id = p.id and work_date = p_today;

  if v_excused then
    update public.operator_task
       set completed_on = p_today, completed_at = coalesce(completed_at, now())
     where placement_id = p.id and system_key = 'eod:' || p_today::text and completed_on is null;
  else
    v_open := v_eod.id is not null
      or (v_bounds.starts_at is not null and now() >= v_bounds.starts_at
          and not (p.start_date = p_today and v_eod.id is null and v_bounds.ends_at is not null and now() >= v_bounds.ends_at));
    if v_open and v_eod.id is null then
      insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at, status)
      values (p_op, p.id, p_today, v_day, app.so_eod_deadline(p, p_today), 'not_started')
      on conflict (operator_id, placement_id, work_date) do nothing;
      select * into v_eod from public.sales_eod where placement_id = p.id and work_date = p_today;
    end if;
    if v_eod.id is not null then
      perform app.so_upsert_system_task(
        p_op, p.id, p_today, 'Submit today''s EOD', v_due,
        v_eod.submitted_at is not null or v_eod.status = 'excused', v_eod.submitted_at);
    end if;
  end if;

  v_yesterday := app.so_previous_work_date(p, p_today);
  select * into v_prev from public.sales_eod where placement_id = p.id and work_date = v_yesterday;
  if v_prev.submitted_at is null and v_prev.status in ('late', 'draft', 'missed') then
    perform app.so_upsert_system_task(p_op, p.id, v_yesterday, 'Submit yesterday''s EOD', v_due, false, null);
  elsif v_prev.submitted_at is not null or v_prev.status = 'excused' then
    update public.operator_task
       set completed_on = v_yesterday,
           completed_at = coalesce(completed_at, v_prev.submitted_at, now())
     where placement_id = p.id
       and system_key = 'eod:' || v_yesterday::text
       and completed_on is null;
  end if;
end;
$$;

revoke all on function app.so_sync_day(uuid, public.placement, date) from public, anon, authenticated;

create or replace function app.so_eod_card(p public.placement, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_deadline timestamptz;
  v_remaining integer;
  v_late integer;
  v_feedback integer := 0;
  v_excused boolean;
  v_status text;
begin
  select * into v_eod from public.sales_eod where placement_id = p.id and work_date = p_day;
  v_excused := exists (
    select 1 from public.sales_excused_day x where x.placement_id = p.id and x.work_date = p_day
  ) or v_eod.status = 'excused';
  v_status := case when v_excused then 'excused' else coalesce(v_eod.status, 'not_started') end;
  v_deadline := coalesce(v_eod.deadline_at, app.so_eod_deadline(p, p_day));
  if v_status in ('not_started', 'draft') and v_deadline > now() then
    v_remaining := extract(epoch from (v_deadline - now()))::integer;
  end if;
  if v_status = 'late' and v_deadline < now() then
    v_late := extract(epoch from (now() - v_deadline))::integer;
  end if;
  if v_eod.id is not null then
    select count(*)::integer into v_feedback from public.sales_eod_feedback where eod_id = v_eod.id;
  end if;
  return jsonb_build_object(
    'id', v_eod.id,
    'work_date', p_day,
    'status', v_status,
    'deadline_at', v_deadline,
    'submitted_at', v_eod.submitted_at,
    'was_late', coalesce(v_eod.was_late, false),
    'feedback_count', v_feedback,
    'remaining_seconds', v_remaining,
    'late_seconds', v_late,
    'updated_at', v_eod.updated_at,
    'edited_after_submit', coalesce(v_eod.edited_after_submit, false),
    'editable', v_status <> 'excused' and not app.is_impersonating() and app.so_quick_log_open(p, v_eod)
  );
end;
$$;

revoke all on function app.so_eod_card(public.placement, date) from public, anon, authenticated;

-- Log a number on a specific working day. The dashboard keeps calling this
-- without a day, which still means today.
drop function if exists public.so_log_activity(text, uuid, numeric, text);

create or replace function public.so_log_activity(
  p_metric_key text,
  p_outcome_type_id uuid,
  p_amount numeric,
  p_mode text,
  p_day date default null
)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_op public.operator;
  v_pl public.placement;
  v_today date;
  v_log date;
  v_metric public.activity_metric;
  v_eod public.sales_eod;
  v_day uuid;
  v_current numeric;
  v_next numeric;
  v_existed boolean;
  v_row public.activity_value;
  v_group text;
begin
  perform app.so_refuse_view_as();
  v_ws := public.so_workspace();
  if v_ws ->> 'state' is distinct from 'active' then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;

  select * into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_today := app.so_work_date(v_pl, now());
  v_log := coalesce(p_day, v_today);
  if v_log > v_today then
    raise exception 'not_due: that working day has not started' using errcode = '23514';
  end if;
  perform app.so_sync_day(v_op.id, v_pl, v_today);
  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_log;
  if p_day is not null and p_day is distinct from v_today and v_eod.id is null then
    raise exception 'not_due: no EOD is open for that day' using errcode = '23514';
  end if;
  if not app.so_quick_log_open(v_pl, v_eod) then
    raise exception 'eod_locked: today''s numbers are locked' using errcode = '42501';
  end if;

  select * into v_metric from public.activity_metric where key = p_metric_key and active;
  if v_metric.key is null then
    raise exception 'not_found: that metric is not on this workspace' using errcode = 'P0002';
  end if;
  if v_metric.source = 'ghl' or not v_metric.operator_editable then
    raise exception 'ghl_only: % comes from GHL. It cannot be logged here.', v_metric.label using errcode = '42501';
  end if;
  v_group := app.so_metric_group(v_metric.key, v_metric.category);
  if v_group is null
     or (v_group in ('outbound', 'ghl') and not ('outbound_calling' = any(v_pl.activity_categories)))
     or (v_group = 'follow_up' and not ('follow_up' = any(v_pl.activity_categories)))
     or (v_group = 'reactivation' and not ('reactivation' = any(v_pl.activity_categories)))
     or (v_group = 'results' and not v_pl.tracks_results) then
    raise exception 'not_on_placement: that metric is not on this placement' using errcode = '42501';
  end if;
  if p_mode not in ('delta', 'set') then
    raise exception 'invalid: log a change or a total' using errcode = '23514';
  end if;
  if p_mode = 'set' and coalesce(p_amount, -1) < 0 then
    raise exception 'invalid: the number cannot be negative' using errcode = '23514';
  end if;
  if v_metric.by_outcome then
    if p_outcome_type_id is null or not exists (
      select 1 from public.placement_outcome_type o
      where o.id = p_outcome_type_id and o.placement_id = v_pl.id and o.active
    ) then
      raise exception 'outcome_required: choose a positive outcome on this placement' using errcode = '23514';
    end if;
  elsif p_outcome_type_id is not null then
    raise exception 'no_outcome: that metric is not logged per outcome' using errcode = '23514';
  end if;

  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_op.id, v_pl.id, v_log)
  on conflict (operator_id, placement_id, work_date) do nothing;
  select id into v_day from public.activity_day
  where operator_id = v_op.id and placement_id = v_pl.id and work_date = v_log;

  select * into v_row
  from public.activity_value
  where activity_day_id = v_day
    and metric_key = v_metric.key
    and source = 'operator'
    and outcome_type_id is not distinct from p_outcome_type_id
  for update;

  v_existed := v_row.id is not null;
  v_current := coalesce(v_row.value, 0);
  if p_mode = 'delta' then
    v_next := greatest(0, least(100000, v_current + coalesce(p_amount, 0)));
  else
    v_next := least(100000, p_amount);
  end if;
  if v_metric.unit = 'minutes' and v_next > 1440 then
    raise exception 'invalid: talk time for one day stays within 24 hours' using errcode = '23514';
  end if;
  if v_existed and v_next = v_current then
    return v_next;
  end if;
  if not v_existed and v_next = 0 then
    return 0;
  end if;

  if not v_existed then
    insert into public.activity_value (activity_day_id, metric_key, outcome_type_id, source, value, updated_by)
    values (v_day, v_metric.key, p_outcome_type_id, 'operator', v_next, auth.uid())
    returning * into v_row;
  else
    update public.activity_value
       set value = v_next, updated_by = auth.uid()
     where id = v_row.id
    returning * into v_row;
  end if;

  insert into public.activity_value_change (
    activity_day_id, metric_key, outcome_type_id, source, previous_value, new_value, changed_by
  ) values (
    v_day, v_metric.key, p_outcome_type_id, 'operator',
    case when v_existed then v_current else null end,
    v_next, auth.uid()
  );

  return v_next;
end;
$$;

revoke all on function public.so_log_activity(text, uuid, numeric, text, date) from public, anon;
grant execute on function public.so_log_activity(text, uuid, numeric, text, date) to authenticated;

create or replace function public.so_save_settings(p_settings jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.team_setting;
  v_new public.team_setting;
  v_fields constant text[] := array[
    'mismatch_tolerance_pct', 'mismatch_small_count_under', 'mismatch_small_count_gap',
    'eod_reminder_minutes_before', 'eod_late_minutes_after', 'eod_manager_alert_minutes_after',
    'eod_missed_rule', 'eod_missed_hours_after', 'eod_edit_rule', 'eod_edit_hours_after',
    'eod_hours_worked_enabled', 'eod_note_to_manager_enabled', 'eod_min_text_chars',
    'client_feedback_token_days', 'speed_to_lead_target_seconds',
    'target_override_min_pct', 'target_override_max_pct',
    'cert_warning_days', 'cert_grace_days', 'view_as_idle_minutes', 'placement_review_months'];
  s jsonb := p_settings;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes workspace settings' using errcode = '42501';
  end if;
  if s ? 'eod_min_text_chars' and (s ->> 'eod_min_text_chars')::integer not between 1 and 500 then
    raise exception 'invalid: the minimum length is between 1 and 500 characters' using errcode = '23514';
  end if;

  select * into v_old from public.team_setting where id = 1 for update;

  update public.team_setting set
    mismatch_tolerance_pct = coalesce((s ->> 'mismatch_tolerance_pct')::numeric, mismatch_tolerance_pct),
    mismatch_small_count_under = coalesce((s ->> 'mismatch_small_count_under')::integer, mismatch_small_count_under),
    mismatch_small_count_gap = coalesce((s ->> 'mismatch_small_count_gap')::numeric, mismatch_small_count_gap),
    eod_reminder_minutes_before = coalesce((s ->> 'eod_reminder_minutes_before')::integer, eod_reminder_minutes_before),
    eod_late_minutes_after = coalesce((s ->> 'eod_late_minutes_after')::integer, eod_late_minutes_after),
    eod_manager_alert_minutes_after = coalesce((s ->> 'eod_manager_alert_minutes_after')::integer, eod_manager_alert_minutes_after),
    eod_missed_rule = coalesce(s ->> 'eod_missed_rule', eod_missed_rule),
    eod_missed_hours_after = case when s ? 'eod_missed_hours_after' then (s ->> 'eod_missed_hours_after')::integer else eod_missed_hours_after end,
    eod_edit_rule = coalesce(s ->> 'eod_edit_rule', eod_edit_rule),
    eod_edit_hours_after = case when s ? 'eod_edit_hours_after' then (s ->> 'eod_edit_hours_after')::integer else eod_edit_hours_after end,
    eod_hours_worked_enabled = coalesce((s ->> 'eod_hours_worked_enabled')::boolean, eod_hours_worked_enabled),
    eod_note_to_manager_enabled = coalesce((s ->> 'eod_note_to_manager_enabled')::boolean, eod_note_to_manager_enabled),
    eod_min_text_chars = coalesce((s ->> 'eod_min_text_chars')::integer, eod_min_text_chars),
    client_feedback_token_days = coalesce((s ->> 'client_feedback_token_days')::integer, client_feedback_token_days),
    speed_to_lead_target_seconds = case when s ? 'speed_to_lead_target_seconds' then (s ->> 'speed_to_lead_target_seconds')::integer else speed_to_lead_target_seconds end,
    target_override_min_pct = case when s ? 'target_override_min_pct' then (s ->> 'target_override_min_pct')::integer else target_override_min_pct end,
    target_override_max_pct = case when s ? 'target_override_max_pct' then (s ->> 'target_override_max_pct')::integer else target_override_max_pct end,
    cert_warning_days = coalesce((s ->> 'cert_warning_days')::integer, cert_warning_days),
    cert_grace_days = coalesce((s ->> 'cert_grace_days')::integer, cert_grace_days),
    view_as_idle_minutes = coalesce((s ->> 'view_as_idle_minutes')::integer, view_as_idle_minutes),
    placement_review_months = coalesce((s ->> 'placement_review_months')::integer, placement_review_months),
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1
  returning * into v_new;

  if v_new.eod_missed_rule = 'hours_after_deadline' and v_new.eod_missed_hours_after is null then
    raise exception 'required: set how many hours after the deadline an EOD becomes Missed' using errcode = '23514';
  end if;
  if v_new.eod_edit_rule = 'hours_after_submit' and v_new.eod_edit_hours_after is null then
    raise exception 'required: set how many hours after submitting an EOD stays editable' using errcode = '23514';
  end if;
  if v_new.target_override_min_pct is not null and v_new.target_override_max_pct is not null
     and v_new.target_override_min_pct > v_new.target_override_max_pct then
    raise exception 'invalid: the override floor is above the ceiling' using errcode = '23514';
  end if;

  perform app.audit('workspace.settings', 'team_setting', '1', 'Changed Sales Operator workspace settings',
    (select jsonb_object_agg(k, to_jsonb(v_old) -> k) from unnest(v_fields) k),
    (select jsonb_object_agg(k, to_jsonb(v_new) -> k) from unnest(v_fields) k));
end;
$$;

revoke all on function public.so_save_settings(jsonb) from public, anon;
grant execute on function public.so_save_settings(jsonb) to authenticated;

create or replace function public.so_eod_read(p_eod_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_pl public.placement;
  v_op uuid;
  v_eod public.sales_eod;
  v_feedback jsonb;
begin
  perform app.portal_view_audit('workspace_eod');
  v_ws := public.so_workspace();
  if v_ws ->> 'state' not in ('active', 'paused') then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  select id into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_eod
  from public.sales_eod
  where id = p_eod_id and operator_id = v_op and placement_id = v_pl.id;
  if v_eod.id is null then
    raise exception 'not_found: that end-of-day report is not on your placement' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id,
           'parent_id', f.parent_id,
           'author_kind', f.author_kind,
           'author_name', case f.author_kind
             when 'client' then 'Client'
             when 'operator' then coalesce(app.profile_name(f.author_profile_id), 'Operator')
             when 'admin' then coalesce(app.profile_name(f.author_profile_id), 'DA Admin')
             else coalesce(app.profile_name(f.author_profile_id), 'Manager')
           end,
           'body', f.body,
           'rating', f.rating,
           'created_at', f.created_at
         ) order by f.created_at), '[]'::jsonb)
    into v_feedback
  from public.sales_eod_feedback f
  where f.eod_id = v_eod.id;

  return jsonb_build_object(
    'id', v_eod.id,
    'work_date', v_eod.work_date,
    'status', v_eod.status,
    'was_late', v_eod.was_late,
    'submitted_at', v_eod.submitted_at,
    'wins', v_eod.wins,
    'blockers', v_eod.blockers,
    'tomorrow_plan', v_eod.tomorrow_plan,
    'plan_items', coalesce(v_eod.plan_items, '[]'::jsonb),
    'hours_worked', v_eod.hours_worked,
    'note_to_manager', v_eod.note_to_manager,
    'needs_help', v_eod.needs_help,
    'edited_after_submit', v_eod.edited_after_submit,
    'view_as', app.is_impersonating(),
    'numbers', app.so_eod_numbers(v_pl, v_eod.work_date),
    'feedback', v_feedback
  );
end;
$$;

revoke all on function public.so_eod_read(uuid) from public, anon;
grant execute on function public.so_eod_read(uuid) to authenticated;

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
  if not found then
    return;
  end if;
  select case_file_id into v_case from public.placement where id = v_eod.placement_id;
  insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
  values (v_eod.id, v_eod.status, v_eod.status, 'reviewed', 'Marked reviewed.');
  perform app.audit('workspace.eod.reviewed', 'sales_eod', v_eod.id::text,
    format('Reviewed the EOD for %s', v_eod.work_date), null, jsonb_build_object('reviewed_by', auth.uid()), v_case);
end;
$$;

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
  v_revisions jsonb;
  v_operator text;
  v_client text;
begin
  v_eod := app.so_require_staff_eod(p_eod);
  select o.name, cf.name into v_operator, v_client
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  join public.client_case_file cf on cf.id = pl.case_file_id
  where pl.id = v_eod.placement_id;
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'revision', r.revision, 'before_value', r.before_value, 'after_value', r.after_value, 'edited_at', r.edited_at
         ) order by r.revision), '[]'::jsonb)
    into v_revisions
  from public.sales_eod_revision r where r.eod_id = v_eod.id;
  return jsonb_build_object(
    'id', v_eod.id, 'work_date', v_eod.work_date, 'status', v_eod.status, 'was_late', v_eod.was_late,
    'needs_help', v_eod.needs_help, 'wins', v_eod.wins, 'blockers', v_eod.blockers,
    'plan_items', v_eod.plan_items, 'note_to_manager', v_eod.note_to_manager,
    'hours_worked', v_eod.hours_worked, 'submitted_at', v_eod.submitted_at,
    'reviewed_at', v_eod.reviewed_at, 'escalated_at', v_eod.escalated_at, 'escalation_reason', v_eod.escalation_reason,
    'edited_after_submit', v_eod.edited_after_submit, 'prior_status', v_eod.prior_status,
    'unlocked_until', v_eod.unlocked_until, 'locked_at', v_eod.locked_at,
    'placement_id', v_eod.placement_id, 'operator_id', v_eod.operator_id,
    'operator_name', v_operator, 'client_name', v_client,
    'feedback', v_feedback, 'events', v_events, 'revisions', v_revisions
  );
end;
$$;

revoke all on function public.so_eod_staff(uuid) from public, anon;
grant execute on function public.so_eod_staff(uuid) to authenticated;

create or replace function public.so_eod_index(p_filter text default 'needs_review')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.so_require_staff();
  perform public.so_eod_sweep();
  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb)
    from (
      select e.id, e.work_date, e.status, e.was_late, e.needs_help, e.escalated_at, e.reviewed_at,
             e.submitted_at, e.placement_id, o.name as operator_name, cf.name as client_name
      from public.sales_eod e
      join public.operator o on o.id = e.operator_id
      join public.placement pl on pl.id = e.placement_id
      join public.client_case_file cf on cf.id = pl.case_file_id
      where pl.placement_type is not null
        and case coalesce(p_filter, 'needs_review')
          when 'needs_review' then e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused'
          when 'late' then e.status = 'late' or (e.was_late and e.submitted_at is not null)
          when 'missed' then e.status = 'missed'
          when 'escalated' then e.escalated_at is not null
          when 'needs_help' then e.needs_help and e.submitted_at is not null
          else e.status <> 'not_started'
        end
      order by e.needs_help desc, (e.escalated_at is null), e.submitted_at desc nulls last, e.work_date desc
      limit 200
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_eod_index(text) from public, anon;
grant execute on function public.so_eod_index(text) to authenticated;

create or replace function public.so_team_snapshot()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.so_require_staff();
  perform public.so_eod_sweep();
  return jsonb_build_object(
    'needs_review', (
      select count(*) from public.sales_eod e
      where e.submitted_at is not null and e.reviewed_at is null and e.status <> 'excused'
    ),
    'late', (
      select count(*) from public.sales_eod e
      join public.placement pl on pl.id = e.placement_id
      where e.status = 'late' and pl.status = 'active' and pl.placement_type is not null
    ),
    'missed', (
      select count(*) from public.sales_eod e
      join public.placement pl on pl.id = e.placement_id
      where e.status = 'missed' and e.submitted_at is null and pl.status = 'active' and pl.placement_type is not null
    ),
    'escalated', (
      select count(*) from public.sales_eod e where e.escalated_at is not null and e.reviewed_at is null
    ),
    'today', coalesce((
      select jsonb_agg(jsonb_build_object(
               'placement_id', q.placement_id,
               'operator_name', q.operator_name,
               'client_name', q.client_name,
               'work_date', q.work_date,
               'status', q.status,
               'needs_help', q.needs_help,
               'escalated', q.escalated,
               'attention', q.attention
             ) order by q.attention, q.operator_name)
      from (
        select pl.id as placement_id, o.name as operator_name, cf.name as client_name,
               app.so_work_date(pl, now()) as work_date,
               coalesce(e.status, 'not_started') as status,
               coalesce(e.needs_help, false) as needs_help,
               e.escalated_at is not null as escalated,
               case
                 when e.status in ('late', 'missed') then 0
                 when e.needs_help or e.escalated_at is not null then 1
                 when e.id is not null and e.submitted_at is null and e.deadline_at < now() and e.status <> 'excused' then 0
                 else 2
               end as attention
        from public.placement pl
        join public.operator o on o.id = pl.operator_id
        join public.client_case_file cf on cf.id = pl.case_file_id
        left join public.sales_eod e on e.placement_id = pl.id and e.work_date = app.so_work_date(pl, now())
        where pl.placement_type is not null and pl.status = 'active'
      ) q
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.so_team_snapshot() from public, anon;
grant execute on function public.so_team_snapshot() to authenticated;
