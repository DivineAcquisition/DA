-- Each end of day has a private link. The link is the credential, so the
-- operator can open and submit that one report without signing in.

alter table public.sales_eod
  add column if not exists link_token text;

update public.sales_eod
   set link_token = encode(extensions.gen_random_bytes(24), 'hex')
 where link_token is null;

alter table public.sales_eod
  alter column link_token set not null;

create unique index if not exists sales_eod_link_token_uidx on public.sales_eod (link_token);

create or replace function app.sales_eod_set_link_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.link_token is null or btrim(new.link_token) = '' then
    new.link_token := encode(extensions.gen_random_bytes(24), 'hex');
  end if;
  return new;
end;
$$;

drop trigger if exists sales_eod_set_link_token on public.sales_eod;
create trigger sales_eod_set_link_token
  before insert on public.sales_eod
  for each row execute function app.sales_eod_set_link_token();

create or replace function app.so_eod_from_token(p_token text)
returns public.sales_eod
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
begin
  select * into v_eod
  from public.sales_eod
  where link_token = lower(btrim(coalesce(p_token, '')));
  if v_eod.id is null then
    raise exception 'link_invalid: this link is not valid' using errcode = '28000';
  end if;
  return v_eod;
end;
$$;

revoke all on function app.so_eod_from_token(text) from public, anon, authenticated;

create or replace function app.so_eod_payload(p_eod public.sales_eod)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_day date;
  v_eod public.sales_eod := p_eod;
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
  select * into v_pl from public.placement where id = p_eod.placement_id;
  v_day := p_eod.work_date;
  v_open := v_eod.id is not null and app.so_quick_log_open(v_pl, v_eod);

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
      'display', case
        when v_metric.source = 'ghl' then app.so_ghl_display(v_pl.id, v_metric.key, v_day, v_day)
        when v_pending then 'pending_sync' else 'number' end,
      'value', case when v_metric.source = 'ghl' and app.so_ghl_display(v_pl.id, v_metric.key, v_day, v_day) is distinct from 'number' then null else v_value end,
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
    'view_as', false,
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

revoke all on function app.so_eod_payload(public.sales_eod) from public, anon, authenticated;

create or replace function public.so_eod_open(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
begin
  v_eod := app.so_eod_from_token(p_token);
  perform public.so_eod_sweep();
  select * into v_eod from public.sales_eod where id = v_eod.id;
  return app.so_eod_payload(v_eod);
end;
$$;

revoke all on function public.so_eod_open(text) from public;
grant execute on function public.so_eod_open(text) to anon, authenticated, service_role;

create or replace function public.so_eod_link_save(p_token text, p_body jsonb)
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
  v_eod := app.so_eod_from_token(p_token);
  v_edits := v_eod.edit_count;
  select * into v_pl from public.placement where id = v_eod.placement_id;
  if not app.so_quick_log_open(v_pl, v_eod) then
    raise exception 'eod_locked: this EOD is locked' using errcode = '42501';
  end if;
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
    status = case when status = 'not_started' then 'draft' else status end
  where id = v_eod.id
  returning * into v_eod;
  if v_eod.edit_count > v_edits and exists (
    select 1 from public.sales_eod_feedback f
    where f.eod_id = v_eod.id and f.author_kind in ('manager', 'admin')
  ) then
    perform app.so_staff_alert('eod_edited', v_eod.operator_id, v_eod.placement_id, v_pl.manager_profile_id, v_eod.work_date,
      format('EOD for %s was edited after feedback.', v_eod.work_date));
  end if;
  return jsonb_build_object('ok', true, 'status', v_eod.status, 'updated_at', v_eod.updated_at, 'edited', v_eod.edited_after_submit);
end;
$$;

revoke all on function public.so_eod_link_save(text, jsonb) from public;
grant execute on function public.so_eod_link_save(text, jsonb) to anon, authenticated, service_role;

create or replace function public.so_eod_link_submit(p_token text, p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
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
begin
  v_eod := app.so_eod_from_token(p_token);
  if v_eod.submitted_at is not null then
    raise exception 'already_submitted: this EOD is already in. Save the edit instead.' using errcode = '23514';
  end if;
  perform public.so_eod_link_save(p_token, p_body);
  select * into v_eod from public.sales_eod where id = v_eod.id;
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
  v_name := v_op.name;
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
    null, jsonb_build_object('status', v_eod.status, 'was_late', v_late, 'needs_help', v_eod.needs_help, 'via', 'link'), v_pl.case_file_id);
  return jsonb_build_object('ok', true, 'status', v_eod.status, 'was_late', v_eod.was_late, 'submitted_at', v_eod.submitted_at);
end;
$$;

revoke all on function public.so_eod_link_submit(text, jsonb) from public;
grant execute on function public.so_eod_link_submit(text, jsonb) to anon, authenticated, service_role;

create or replace function public.so_eod_link_log(
  p_token text,
  p_metric_key text,
  p_outcome_type_id uuid,
  p_amount numeric,
  p_mode text
)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_eod public.sales_eod;
  v_op public.operator;
  v_pl public.placement;
  v_today date;
  v_metric public.activity_metric;
  v_day uuid;
  v_current numeric;
  v_next numeric;
  v_existed boolean;
  v_row public.activity_value;
  v_group text;
begin
  v_eod := app.so_eod_from_token(p_token);
  select * into v_op from public.operator where id = v_eod.operator_id;
  select * into v_pl from public.placement where id = v_eod.placement_id;
  v_today := app.so_work_date(v_pl, now());
  if v_eod.work_date > v_today then
    raise exception 'not_due: that working day has not started' using errcode = '23514';
  end if;
  perform app.so_sync_day(v_op.id, v_pl, v_today);
  select * into v_eod from public.sales_eod where id = v_eod.id;
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
  values (v_op.id, v_pl.id, v_eod.work_date)
  on conflict (operator_id, placement_id, work_date) do nothing;
  select id into v_day from public.activity_day
  where operator_id = v_op.id and placement_id = v_pl.id and work_date = v_eod.work_date;

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
    values (v_day, v_metric.key, p_outcome_type_id, 'operator', v_next, null)
    returning * into v_row;
  else
    update public.activity_value
       set value = v_next, updated_by = null
     where id = v_row.id
    returning * into v_row;
  end if;

  insert into public.activity_value_change (
    activity_day_id, metric_key, outcome_type_id, source, previous_value, new_value, changed_by
  ) values (
    v_day, v_metric.key, p_outcome_type_id, 'operator',
    case when v_existed then v_current else null end,
    v_next, null
  );

  return v_next;
end;
$$;

revoke all on function public.so_eod_link_log(text, text, uuid, numeric, text) from public;
grant execute on function public.so_eod_link_log(text, text, uuid, numeric, text) to anon, authenticated, service_role;
