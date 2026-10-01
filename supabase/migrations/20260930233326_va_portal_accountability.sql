-- Prompt 8: portal functions for the accountability system (stages, My Day, shift reviews,
-- standards, disputes, DA commitments, growth, availability, inbox, formal notices).

-- 4. Portal: context, My Day ----------------------------------------------------------

create or replace function public.portal_context(p_tab text default 'today', p_placement_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
  v_stage text := app.operator_stage(v_op);
  v_imp public.impersonation := app.live_impersonation();
  v_op_today date := (now() at time zone app.safe_tz(v_op.time_zone))::date;
  v_selected uuid;
  v_placements jsonb;
  v_onboarding jsonb;
  v_focus jsonb;
begin
  perform app.portal_view_audit(p_tab);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', pl.id,
           'client_name', app.placement_client_name(pl),
           'status', pl.status,
           'live', app.placement_is_live(pl),
           'start_date', pl.start_date,
           'end_date', coalesce(pl.closed_on, pl.end_date),
           'shift_start', pl.shift_start,
           'shift_end', pl.shift_end,
           'time_zone', app.safe_tz(pl.time_zone),
           'working_days', to_jsonb(pl.working_days)
         ) order by app.placement_is_live(pl) desc, pl.start_date desc), '[]'::jsonb)
    into v_placements
  from public.placement pl
  where pl.id in (select app.portal_placement_ids(v_op));

  if p_placement_id is not null and p_placement_id in (select app.portal_placement_ids(v_op)) then
    v_selected := p_placement_id;
  else
    v_selected := (v_placements -> 0 ->> 'id')::uuid;
  end if;

  select jsonb_build_object(
           'status', s.status,
           'protocol_name', coalesce(p.name, s.protocol_key),
           'link_token', case when v_imp.id is null and s.status = 'pending' then s.access_token end
         )
    into v_onboarding
  from public.da_onboarding_submission s
  join public.da_recipient d on d.id = s.recipient_id
  left join public.da_onboarding_protocol p on p.key = s.protocol_key
  where d.operator_id = v_op.id
  order by (s.status = 'pending') desc, s.created_at desc
  limit 1;

  -- The focus from the latest feedback, shown all the week after it was written for.
  select jsonb_build_object('text', f.focus, 'week_start', f.week_start, 'author', f.author_name)
    into v_focus
  from public.weekly_feedback f
  where f.operator_id = v_op.id and f.week_start >= (date_trunc('week', v_op_today::timestamp) - interval '7 days')::date
  order by f.week_start desc
  limit 1;

  return jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op.id,
      'name', v_op.name,
      'first_name', split_part(btrim(v_op.name), ' ', 1),
      'time_zone', app.safe_tz(v_op.time_zone),
      'status', v_op.status,
      'tier', v_op.tier,
      'certified_on', v_op.certified_on,
      'email_optional', v_op.email_digest
    ),
    'stage', v_stage,
    'has_history', exists (select 1 from public.placement pl where pl.operator_id = v_op.id and pl.status <> 'draft'),
    'has_pay', exists (select 1 from public.pay_statement s where s.operator_id = v_op.id),
    'inactive_until', case when v_stage = 'inactive' then
        app.operator_inactive_since(v_op) + make_interval(months => (select inactive_access_months from public.team_setting where id = 1)) end,
    'viewer', jsonb_build_object(
      'view_as', v_imp.id is not null,
      'kind', v_imp.kind,
      'read_only', v_imp.id is not null,
      'session_id', v_imp.id,
      'actor_name', case when v_imp.id is not null then app.profile_name(v_imp.actor_profile_id) end,
      'actor_role', case when v_imp.id is not null
                         then (select pr.role from public.profile pr where pr.id = v_imp.actor_profile_id) end,
      'reason_kind', v_imp.reason_kind,
      'started_at', v_imp.started_at,
      'expires_at', v_imp.expires_at,
      'extended', v_imp.extended_at is not null,
      'can_see_pay', v_imp.id is null or app.actor_can('payroll.view')
    ),
    'placements', v_placements,
    'selected_placement_id', v_selected,
    'focus', v_focus,
    'blocking_notices', case when v_stage = 'inactive' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'severity', n.severity,
                                          'created_at', n.created_at) order by n.created_at)
      from public.account_notice n
      where n.profile_id = v_op.profile_id and n.blocking
        and n.acknowledged_at is null and n.cleared_at is null
    ), '[]'::jsonb) end,
    'badges', jsonb_build_object(
      'answers_ready', (select count(*) from public.escalation e
                        where e.operator_id = v_op.id and e.status = 'answered' and e.answer_read_at is null
                          and e.placement_id in (select app.portal_placement_ids(v_op))),
      'overdue_escalations', (select count(*) from public.escalation e
                              where e.operator_id = v_op.id and e.status = 'open' and e.response_due_at < now()
                                and e.placement_id in (select app.portal_placement_ids(v_op))),
      'unread_notifications', (select count(*) from public.operator_notification n
                               where n.operator_id = v_op.id and n.read_at is null),
      'open_tasks', (select count(*) from public.operator_task t
                     where t.operator_id = v_op.id and t.completed_on is null and t.due_on <= v_op_today),
      'pay_answers', case when v_imp.id is null or app.actor_can('payroll.view') then
                       (select count(*) from public.pay_question q
                        where q.operator_id = v_op.id and q.answered_at is not null and q.answer_read_at is null)
                     else 0 end,
      'reviews_open', (select count(*) from public.shift_draft d
                       where d.operator_id = v_op.id and d.status in ('open', 'unconfirmed')
                         and d.placement_id in (select app.portal_placement_ids(v_op))),
      'reviews_unconfirmed', (select count(*) from public.shift_draft d
                              where d.operator_id = v_op.id and d.status = 'unconfirmed'
                                and d.placement_id in (select app.portal_placement_ids(v_op))),
      'feedback_unread', (select count(*) from public.weekly_feedback f
                          where f.operator_id = v_op.id and f.acknowledged_at is null),
      'formal_notices', (select count(*) from public.formal_notice f
                         where f.operator_id = v_op.id and f.status = 'sent' and f.reply is null)
    ),
    'onboarding', v_onboarding
  );
end;
$$;

-- The live parts of My Day: the response clock, today so far, and reviews waiting.
create or replace function public.portal_live(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_tz text := app.safe_tz(v_pl.time_zone);
  v_today date := (now() at time zone v_tz)::date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_on boolean := false;
  v_standard integer := coalesce(v_pl.response_standard_minutes, 5);
  v_waiting integer;
  v_over integer;
  v_oldest numeric;
  v_so_far jsonb;
begin
  if not app.placement_is_live(v_pl) then
    return jsonb_build_object('placement_id', v_pl.id, 'live', false);
  end if;

  -- The shift running now; failing that, today's shift so far.
  select b.starts_at, b.ends_at into v_starts, v_ends
  from (values (v_today), (v_today - 1)) d(day)
  cross join lateral app.shift_bounds(v_pl, d.day) b
  where extract(isodow from d.day)::smallint = any(v_pl.working_days) and b.starts_at <= now() and b.ends_at > now()
  limit 1;
  v_on := v_starts is not null;
  if not v_on and extract(isodow from v_today)::smallint = any(v_pl.working_days) then
    select b.starts_at, b.ends_at into v_starts, v_ends from app.shift_bounds(v_pl, v_today) b;
    if v_starts > now() then
      v_starts := null;
      v_ends := null;
    end if;
  end if;

  if v_on then
    select count(*),
           count(*) filter (where l.lead_in_at + make_interval(mins => v_standard) < now()),
           round((max(extract(epoch from (now() - l.lead_in_at))) / 60.0)::numeric, 1)
      into v_waiting, v_over, v_oldest
    from public.lead l
    where l.case_file_id = v_pl.case_file_id
      and (l.placement_id = v_pl.id or (l.placement_id is null and not app.other_placement_on_shift(v_pl, l.lead_in_at)))
      and l.first_touch_at is null
      and l.lead_in_at >= v_starts and l.lead_in_at <= now()
      and (nullif(btrim(coalesce(l.email, '')), '') is not null or nullif(btrim(coalesce(l.phone, '')), '') is not null);
  end if;

  if v_starts is not null then
    v_so_far := app.window_activity(v_pl, v_starts, least(now(), v_ends));
  end if;

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'live', true,
    'on_shift', v_on,
    'shift', case when v_starts is not null then jsonb_build_object('starts_at', v_starts, 'ends_at', v_ends) end,
    'tracking', app.tracking_live(v_pl.case_file_id, now()),
    'response_standard_minutes', v_standard,
    'clock', case when v_on then jsonb_build_object('waiting', v_waiting, 'over_standard', v_over, 'oldest_minutes', v_oldest) end,
    'so_far', v_so_far,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('shift_date', d.shift_date, 'status', d.status, 'confirm_by', d.confirm_by)
                       order by d.shift_date desc)
      from public.shift_draft d
      where d.placement_id = v_pl.id and d.operator_id = v_op.id and d.status in ('open', 'unconfirmed')
    ), '[]'::jsonb)
  );
end;
$$;

-- 5. Portal: shift reviews (draft, then confirm) --------------------------------------

create or replace function app.hhmm(p_at timestamptz, p_tz text)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_at at time zone p_tz, 'HH24:MI');
$$;

create or replace function public.portal_shift_reviews(p_placement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_pl public.placement := app.portal_placement(v_op, p_placement_id);
  v_tz text := app.safe_tz(v_pl.time_zone);
begin
  if app.placement_is_live(v_pl) then
    perform app.ensure_shift_drafts(v_pl);
  end if;

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'time_zone', v_tz,
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id,
               'shift_date', d.shift_date,
               'starts_at', d.starts_at,
               'ends_at', d.ends_at,
               'status', d.status,
               'confirm_by', d.confirm_by,
               'confirmed_at', d.confirmed_at,
               'period_closed', app.pay_period_closed_for(d.shift_date),
               'system', d.system_counts,
               'captured_start', app.hhmm((d.system_counts ->> 'first_activity_at')::timestamptz, v_tz),
               'captured_end', app.hhmm((d.system_counts ->> 'last_activity_at')::timestamptz, v_tz),
               'report', (select jsonb_build_object(
                                   'id', r.id, 'version', r.version,
                                   'conversations_handled', r.conversations_handled,
                                   'appointments_booked', r.appointments_booked,
                                   'follow_ups_completed', r.follow_ups_completed,
                                   'escalations_raised', r.escalations_raised,
                                   'shift_start_actual', r.shift_start_actual,
                                   'shift_end_actual', r.shift_end_actual,
                                   'variance_explanation', r.variance_explanation,
                                   'correction_reason', r.correction_reason,
                                   'notes', r.notes,
                                   'submitted_at', r.submitted_at)
                          from public.eod_report r
                          where r.placement_id = d.placement_id and r.shift_date = d.shift_date and r.superseded_by_id is null),
               'reflection', jsonb_build_object('went_well', d.reflection_went_well, 'differently', d.reflection_differently,
                                                'in_way', d.reflection_in_way),
               'blockers', coalesce((
                 select jsonb_agg(jsonb_build_object('id', b.id, 'control', b.control, 'note', b.note,
                                                     'resolved_at', b.resolved_at, 'resolution', b.resolution)
                                  order by b.created_at)
                 from public.shift_blocker b where b.draft_id = d.id), '[]'::jsonb)
             ) order by d.shift_date desc)
      from public.shift_draft d
      where d.placement_id = v_pl.id and d.operator_id = v_op.id and d.shift_date >= current_date - 60
    ), '[]'::jsonb)
  );
end;
$$;

-- Confirm the draft, or correct a number with a reason. Both values are kept:
-- the system's in system_counts, the VA's in the report, and the reason in
-- variance_explanation. A second call corrects a confirmed review as a new version.
create or replace function public.portal_confirm_shift(
  p_placement_id uuid,
  p_shift_date date,
  p_entered jsonb,
  p_variance_explanation text default null,
  p_blockers jsonb default '[]'::jsonb,
  p_went_well text default null,
  p_differently text default null,
  p_in_way text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_pl public.placement;
  v_draft public.shift_draft;
  v_tz text;
  v_sys jsonb;
  v_prev public.eod_report;
  v_row public.eod_report;
  v_fields text[][] := array[
    array['conversations_handled', 'conversations'],
    array['appointments_booked', 'appointments_booked'],
    array['follow_ups_completed', 'follow_ups'],
    array['escalations_raised', 'escalations_raised']];
  v_vals integer[] := array[]::integer[];
  v_changed boolean := false;
  v_sys_v integer;
  v_ent_v integer;
  v_start text;
  v_end text;
  v_cap_start text;
  v_cap_end text;
  v_reason text := nullif(btrim(coalesce(p_variance_explanation, '')), '');
  b jsonb;
  v_blocker_text text := '';
  i integer;
begin
  perform app.require('portal.reports.submit');
  v_op := app.portal_operator();
  v_pl := app.portal_placement(v_op, p_placement_id);
  v_tz := app.safe_tz(v_pl.time_zone);

  if app.placement_is_live(v_pl) then
    perform app.ensure_shift_drafts(v_pl);
  end if;
  select * into v_draft from public.shift_draft where placement_id = v_pl.id and shift_date = p_shift_date and operator_id = v_op.id;
  if v_draft.id is null then
    raise exception 'no_draft: there is no shift review for that date yet. It opens when the shift ends.' using errcode = 'P0002';
  end if;
  if app.pay_period_closed_for(p_shift_date) then
    raise exception 'period_closed: that pay period is closed, so your manager makes any correction' using errcode = '23514';
  end if;
  if p_entered is null or jsonb_typeof(p_entered) <> 'object' then
    raise exception 'answers_invalid: the review was not in the expected shape' using errcode = '23514';
  end if;

  v_sys := v_draft.system_counts;
  for i in 1 .. array_length(v_fields, 1) loop
    v_sys_v := (v_sys ->> v_fields[i][2])::integer;
    v_ent_v := (p_entered ->> v_fields[i][1])::integer;
    if v_ent_v is null and v_sys_v is null then
      raise exception 'not_captured: % was not captured by the system, so please enter it', replace(v_fields[i][1], '_', ' ') using errcode = '23514';
    end if;
    if v_sys_v is not null and v_ent_v is not null and v_ent_v <> v_sys_v then
      v_changed := true;
    end if;
    v_vals := v_vals || coalesce(v_ent_v, v_sys_v);
  end loop;

  v_cap_start := app.hhmm((v_sys ->> 'first_activity_at')::timestamptz, v_tz);
  v_cap_end := app.hhmm((v_sys ->> 'last_activity_at')::timestamptz, v_tz);
  v_start := coalesce(nullif(btrim(p_entered ->> 'shift_start_actual'), ''), v_cap_start);
  v_end := coalesce(nullif(btrim(p_entered ->> 'shift_end_actual'), ''), v_cap_end);
  if (v_cap_start is not null and v_start <> v_cap_start) or (v_cap_end is not null and v_end <> v_cap_end) then
    v_changed := true;
  end if;

  perform app.check_report_values(v_vals[1], v_vals[2], v_vals[3], v_vals[4], v_start, v_end, '{}'::jsonb);

  select * into v_prev from public.eod_report
  where placement_id = v_pl.id and shift_date = p_shift_date and superseded_by_id is null;

  if (v_changed or v_prev.id is not null) and (v_reason is null or length(v_reason) < 5) then
    raise exception 'explanation_required: %', case when v_prev.id is not null
      then 'say why you are correcting a confirmed review'
      else 'you changed a captured number, so add a short reason. Both values are kept.' end using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_blockers, '[]'::jsonb)) <> 'array' then
    raise exception 'answers_invalid: blockers were not in the expected shape' using errcode = '23514';
  end if;
  for b in select * from jsonb_array_elements(coalesce(p_blockers, '[]'::jsonb)) loop
    if b ->> 'control' not in ('mine', 'client', 'da', 'outside') or length(btrim(coalesce(b ->> 'note', ''))) not between 2 and 1000 then
      raise exception 'blocker_invalid: each blocker needs who controlled it and a short note' using errcode = '23514';
    end if;
    v_blocker_text := v_blocker_text
      || case b ->> 'control' when 'mine' then '[Within my control] ' when 'client' then '[Client side] '
                              when 'da' then '[DA side] ' else '[Outside anyone''s control] ' end
      || btrim(b ->> 'note') || E'\n';
  end loop;

  insert into public.eod_report (
    placement_id, operator_id, shift_date, shift_start_actual, shift_end_actual,
    conversations_handled, appointments_booked, follow_ups_completed, escalations_raised,
    blockers, notes, configured, system_counts, variance_explanation,
    version, supersedes_id, correction_reason
  ) values (
    v_pl.id, v_op.id, p_shift_date, v_start, v_end,
    v_vals[1], v_vals[2], v_vals[3], v_vals[4],
    left(btrim(v_blocker_text), 4000), left(coalesce(p_notes, ''), 4000), '{}'::jsonb, v_sys,
    case when v_changed then v_reason end,
    coalesce(v_prev.version, 0) + 1, v_prev.id, case when v_prev.id is not null then v_reason end
  ) returning * into v_row;

  if v_prev.id is not null then
    update public.eod_report set superseded_by_id = v_row.id where id = v_prev.id;
  end if;

  update public.shift_draft
     set status = 'confirmed', confirmed_at = now(), eod_report_id = v_row.id,
         reflection_went_well = coalesce(left(nullif(btrim(p_went_well), ''), 300), reflection_went_well),
         reflection_differently = coalesce(left(nullif(btrim(p_differently), ''), 300), reflection_differently),
         reflection_in_way = coalesce(left(nullif(btrim(p_in_way), ''), 300), reflection_in_way)
   where id = v_draft.id;

  for b in select * from jsonb_array_elements(coalesce(p_blockers, '[]'::jsonb)) loop
    insert into public.shift_blocker (draft_id, placement_id, operator_id, shift_date, control, note)
    values (v_draft.id, v_pl.id, v_op.id, p_shift_date, b ->> 'control', btrim(b ->> 'note'));
    -- The VA can't fix these, so the people who can hear about them now.
    if b ->> 'control' in ('client', 'da') then
      perform app.notify_staff(
        case when b ->> 'control' = 'da' then app.admin_recipient_ids() || app.placement_manager_ids(v_pl.id)
             else coalesce(nullif(app.placement_manager_ids(v_pl.id), '{}'::uuid[]), app.admin_recipient_ids()) end,
        'blocker.' || (b ->> 'control'), 'important',
        format('%s blocker from %s on %s', case when b ->> 'control' = 'da' then 'DA-side' else 'Client-side' end,
               v_op.name, to_char(p_shift_date, 'FMDy DD Mon')),
        format('%s: %s', app.placement_client_name(v_pl), left(btrim(b ->> 'note'), 500)),
        v_op.id);
    end if;
  end loop;

  perform app.audit(case when v_prev.id is null then 'eod.confirmed' else 'eod.corrected' end, 'eod_report', v_row.id::text,
    format('%s the shift review for %s%s', case when v_prev.id is null then 'Confirmed' else 'Corrected' end, p_shift_date,
           case when v_changed then ' with corrections: ' || v_reason else '' end),
    jsonb_build_object('system_counts', v_sys), null, v_pl.case_file_id);

  return jsonb_build_object('ok', true, 'id', v_row.id, 'corrected', v_changed);
end;
$$;

-- 6. Portal: standards, disputes, commitments ------------------------------------------

create or replace function app.standard_definitions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', d.key, 'label', d.label, 'unit', d.unit, 'direction', d.direction,
                                               'target', d.standard_target, 'section', d.agreement_section, 'how', d.help)
                            order by d.sort_order), '[]'::jsonb)
  from public.metric_definition d where d.category = 'va_standard';
$$;

-- The standards and three months of trend, from the one calculation.
create or replace function app.va_standards_view(p_operator_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, (now() at time zone 'UTC')::date))::date;
  v_now jsonb := app.va_standard_rows(p_operator_id, v_month);
  v_trend jsonb := '[]'::jsonb;
  v_m date;
begin
  for i in reverse 3 .. 1 loop
    v_m := (v_month - make_interval(months => i))::date;
    v_trend := v_trend || jsonb_build_array(jsonb_build_object('month', v_m, 'rows', (
      select jsonb_object_agg(r ->> 'key', jsonb_build_object('value', r -> 'value', 'status', r -> 'status'))
      from jsonb_array_elements(app.va_standard_rows(p_operator_id, v_m) -> 'standards') r)));
  end loop;
  return v_now || jsonb_build_object(
    'trend', v_trend,
    'disputes', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'standard_key', d.standard_key, 'item_kind', d.item_kind,
                                          'item_id', d.item_id, 'item_label', d.item_label, 'explanation', d.explanation,
                                          'status', d.status, 'raised_at', d.raised_at,
                                          'decided_by', app.profile_name(d.decided_by), 'decided_at', d.decided_at,
                                          'decision_reason', d.decision_reason) order by d.raised_at desc)
      from public.standard_dispute d where d.operator_id = p_operator_id), '[]'::jsonb));
end;
$$;

create or replace function public.portal_standards(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_stage text := app.operator_stage(v_op);
begin
  -- Applicants and trainees see what they will be held to, with no personal numbers.
  if v_stage in ('applicant', 'training') then
    return jsonb_build_object('preview', true, 'definitions', app.standard_definitions());
  end if;
  return jsonb_build_object('preview', false) || app.va_standards_view(v_op.id, p_month);
end;
$$;

create or replace function public.portal_standard_items(p_key text, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_month date := date_trunc('month', coalesce(p_month, (now() at time zone 'UTC')::date))::date;
  v_items jsonb;
begin
  if app.operator_stage(v_op) in ('applicant', 'training') then
    raise exception 'training_only: standards start counting once you are placed' using errcode = '42501';
  end if;
  v_items := app.va_standard_items(v_op.id, p_key, v_month);
  -- Items from placements hidden from this viewer (a manager out of scope) are left out.
  return jsonb_set(v_items, '{items}', coalesce((
    select jsonb_agg(i) from jsonb_array_elements(v_items -> 'items') i
    where i ->> 'placement_id' is null or (i ->> 'placement_id')::uuid in (select app.portal_placement_ids(v_op))), '[]'::jsonb));
end;
$$;

create or replace function public.portal_raise_dispute(p_key text, p_item_id text, p_month date, p_explanation text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_items jsonb;
  v_item jsonb;
  v_kind text;
  v_row public.standard_dispute;
  v_pl uuid;
begin
  perform app.require('portal.disputes.raise');
  v_op := app.portal_operator();
  if app.operator_stage(v_op) in ('applicant', 'training') then
    raise exception 'training_only: standards start counting once you are placed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_explanation, ''))) not between 5 and 2000 then
    raise exception 'explanation_required: say briefly why this item is wrong' using errcode = '23514';
  end if;

  v_items := app.va_standard_items(v_op.id, p_key, coalesce(p_month, (now() at time zone 'UTC')::date));
  v_kind := v_items ->> 'kind';
  if v_kind not in ('lead', 'shift', 'booking') then
    raise exception 'not_disputable: items on this standard are disputed with your manager directly' using errcode = '23514';
  end if;
  select i into v_item from jsonb_array_elements(v_items -> 'items') i where i ->> 'id' = p_item_id limit 1;
  if v_item is null then
    raise exception 'item_not_found: that item is not one of yours on this standard' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.standard_dispute d where d.operator_id = v_op.id and d.item_kind = v_kind
               and d.item_id = p_item_id and d.status = 'open') then
    raise exception 'already_disputed: this item already has an open dispute' using errcode = '23514';
  end if;
  v_pl := (v_item ->> 'placement_id')::uuid;

  insert into public.standard_dispute (operator_id, placement_id, standard_key, item_kind, item_id, item_label, explanation)
  values (v_op.id, v_pl, p_key, v_kind, p_item_id,
          case v_kind when 'lead' then 'Lead at ' || to_char((v_item ->> 'at')::timestamptz at time zone app.safe_tz(v_op.time_zone), 'FMDy DD Mon FMHH12:MI AM')
                      when 'shift' then 'Shift on ' || to_char((v_item ->> 'date')::date, 'FMDy DD Mon')
                      else 'Booking for ' || to_char((v_item ->> 'at')::timestamptz at time zone app.safe_tz(v_op.time_zone), 'FMDy DD Mon') end,
          btrim(p_explanation))
  returning * into v_row;

  perform app.audit('standard.disputed', 'standard_dispute', v_row.id::text,
    format('Disputed %s on %s', v_row.item_label, p_key), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = v_pl));
  perform app.notify_staff(
    coalesce(nullif(app.placement_manager_ids(v_pl), '{}'::uuid[]), app.admin_recipient_ids()),
    'standard.dispute', 'important',
    format('%s disputed an item on %s', v_op.name, (select label from public.metric_definition where key = p_key)),
    format('%s. Decide it from the queue.', v_row.item_label), v_op.id);

  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.portal_commitments(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  return app.da_commitment_rows(v_op.id, coalesce(p_month, (now() at time zone 'UTC')::date));
end;
$$;

-- 7. Portal: growth, feedback, self-review --------------------------------------------

create or replace function public.portal_growth()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
  v_tz text := app.safe_tz(v_op.time_zone);
  v_week date := date_trunc('week', (now() at time zone v_tz))::date;
begin
  return jsonb_build_object(
    'tier', v_op.tier,
    'certified_on', v_op.certified_on,
    'progress', app.tier_progress(v_op.id),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object('from_tier', t.from_tier, 'to_tier', t.to_tier, 'decision', t.decision,
                                          'reason', t.reason, 'decided_by', app.profile_name(t.decided_by),
                                          'decided_at', t.decided_at) order by t.decided_at desc)
      from public.tier_decision t where t.operator_id = v_op.id), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'week_start', f.week_start, 'keep_doing', f.keep_doing,
                                          'improve', f.improve, 'focus', f.focus, 'author', f.author_name,
                                          'posted_at', f.posted_at, 'acknowledged_at', f.acknowledged_at,
                                          'reply', f.reply, 'replied_at', f.replied_at) order by f.week_start desc)
      from (select * from public.weekly_feedback where operator_id = v_op.id order by week_start desc limit 26) f), '[]'::jsonb),
    'week_start', v_week,
    'self_review', (select jsonb_build_object('week_start', s.week_start, 'focus_line', s.focus_line, 'submitted_at', s.submitted_at)
                    from public.weekly_self_review s where s.operator_id = v_op.id and s.week_start = v_week),
    'self_reviews', coalesce((
      select jsonb_agg(jsonb_build_object('week_start', s.week_start, 'focus_line', s.focus_line) order by s.week_start desc)
      from (select * from public.weekly_self_review where operator_id = v_op.id order by week_start desc limit 12) s), '[]'::jsonb),
    'week_summary', jsonb_build_object(
      'bookings', (select count(*) filter (where public.booking_is_creditable(b.state, b.source, b.matched_booking_id))
                   from public.booking b where b.operator_id = v_op.id
                     and b.scheduled_for >= v_week::timestamp at time zone v_tz
                     and b.scheduled_for < (v_week + 7)::timestamp at time zone v_tz),
      'shifts_worked', (select count(*) from public.shift_draft d where d.operator_id = v_op.id
                          and d.shift_date between v_week and v_week + 6),
      'reviews_confirmed', (select count(*) from public.shift_draft d where d.operator_id = v_op.id
                              and d.shift_date between v_week and v_week + 6 and d.status = 'confirmed'),
      'reflections', coalesce((
        select jsonb_agg(jsonb_build_object('shift_date', d.shift_date, 'went_well', d.reflection_went_well,
                                            'differently', d.reflection_differently, 'in_way', d.reflection_in_way)
                         order by d.shift_date)
        from public.shift_draft d
        where d.operator_id = v_op.id and d.shift_date between v_week and v_week + 6
          and coalesce(d.reflection_went_well, d.reflection_differently, d.reflection_in_way) is not null), '[]'::jsonb)
    )
  );
end;
$$;

create or replace function public.portal_ack_feedback(p_feedback_id uuid, p_reply text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_f public.weekly_feedback;
begin
  perform app.require('portal.feedback.ack');
  v_op := app.portal_operator();
  select * into v_f from public.weekly_feedback where id = p_feedback_id and operator_id = v_op.id;
  if v_f.id is null then
    raise exception 'feedback_not_found' using errcode = 'P0002';
  end if;
  if nullif(btrim(coalesce(p_reply, '')), '') is not null then
    if v_f.reply is not null then
      raise exception 'already_replied: you can reply to feedback once' using errcode = '23514';
    end if;
    if length(btrim(p_reply)) > 1000 then
      raise exception 'reply_too_long: keep your reply under 1000 characters' using errcode = '23514';
    end if;
  end if;
  update public.weekly_feedback
     set acknowledged_at = coalesce(acknowledged_at, now()),
         reply = coalesce(reply, nullif(btrim(coalesce(p_reply, '')), '')),
         replied_at = case when reply is null and nullif(btrim(coalesce(p_reply, '')), '') is not null then now() else replied_at end
   where id = v_f.id;
  if nullif(btrim(coalesce(p_reply, '')), '') is not null and v_f.author_profile_id is not null then
    perform app.notify_staff(array[v_f.author_profile_id], 'feedback.reply', 'informational',
      format('%s replied to your feedback', v_op.name), left(btrim(p_reply), 500), v_op.id);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_submit_self_review(p_focus_line text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_week date;
begin
  perform app.require('portal.self_review.submit');
  v_op := app.portal_operator();
  if length(btrim(coalesce(p_focus_line, ''))) not between 3 and 300 then
    raise exception 'line_required: one short line, up to 300 characters' using errcode = '23514';
  end if;
  v_week := date_trunc('week', (now() at time zone app.safe_tz(v_op.time_zone)))::date;
  insert into public.weekly_self_review (operator_id, week_start, focus_line)
  values (v_op.id, v_week, btrim(p_focus_line))
  on conflict (operator_id, week_start) do update set focus_line = excluded.focus_line, submitted_at = now();
  return jsonb_build_object('ok', true, 'week_start', v_week);
end;
$$;

-- 8. Portal: availability, email preference, inbox, formal notices ---------------------

create or replace function public.portal_availability()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator();
begin
  return jsonb_build_object(
    'time_zone', app.safe_tz(v_op.time_zone),
    'windows', coalesce((
      select jsonb_agg(jsonb_build_object('iso_day', a.iso_day, 'starts', a.starts, 'ends', a.ends) order by a.iso_day, a.starts)
      from public.operator_availability a where a.operator_id = v_op.id), '[]'::jsonb),
    'updated_at', (select max(a.updated_at) from public.operator_availability a where a.operator_id = v_op.id)
  );
end;
$$;

create or replace function public.portal_set_availability(p_windows jsonb, p_time_zone text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  w jsonb;
  v_tz text;
begin
  perform app.require('portal.profile.edit');
  v_op := app.portal_operator();
  v_tz := app.safe_tz(p_time_zone);
  if p_time_zone is null or v_tz <> p_time_zone then
    raise exception 'time_zone_invalid: choose your time zone from the list' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(p_windows, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_windows, '[]'::jsonb)) > 21 then
    raise exception 'windows_invalid: up to three windows a day' using errcode = '23514';
  end if;
  for w in select * from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) loop
    if (w ->> 'iso_day')::integer not between 1 and 7
       or coalesce(w ->> 'starts', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       or coalesce(w ->> 'ends', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       or w ->> 'starts' = w ->> 'ends' then
      raise exception 'windows_invalid: each window needs a day and a start and end time' using errcode = '23514';
    end if;
  end loop;

  delete from public.operator_availability where operator_id = v_op.id;
  insert into public.operator_availability (operator_id, iso_day, starts, ends, time_zone)
  select v_op.id, (x ->> 'iso_day')::smallint, x ->> 'starts', x ->> 'ends', v_tz
  from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) x;
  update public.operator set time_zone = v_tz, updated_at = now() where id = v_op.id;

  perform app.audit('operator.availability', 'operator', v_op.id::text,
    format('Set availability: %s windows, %s', jsonb_array_length(coalesce(p_windows, '[]'::jsonb)), v_tz), null, p_windows, null);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_set_email_prefs(p_optional boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
begin
  perform app.require('portal.profile.edit');
  v_op := app.portal_operator();
  update public.operator set email_digest = coalesce(p_optional, true), updated_at = now() where id = v_op.id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.portal_inbox()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
begin
  return coalesce((
    select jsonb_agg(x.n order by x.created_at desc)
    from (
      select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'severity', n.severity, 'kind', n.kind,
                                'urgency', n.urgency, 'link', n.link_path, 'required', n.required,
                                'created_at', n.created_at, 'read_at', n.read_at, 'sent_by', n.sent_by,
                                'emailed', exists (select 1 from public.notification_attempt a
                                                   where a.notification_id = n.id and a.channel = 'email' and a.status = 'delivered')) as n,
             n.created_at
      from public.operator_notification n
      where n.operator_id = v_op.id
      order by n.created_at desc
      limit 200
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.portal_formal_notice(p_notice_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
  v_n public.formal_notice;
begin
  select * into v_n from public.formal_notice where id = p_notice_id and operator_id = v_op.id and status = 'sent';
  if v_n.id is null then
    raise exception 'notice_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('id', v_n.id, 'subject', v_n.subject, 'body', v_n.body, 'sent_at', v_n.sent_at,
                            'sent_by', app.profile_name(v_n.approved_by), 'reply', v_n.reply, 'replied_at', v_n.replied_at);
end;
$$;

create or replace function public.portal_reply_formal_notice(p_notice_id uuid, p_reply text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_n public.formal_notice;
begin
  perform app.require('portal.notice.reply');
  v_op := app.portal_operator(true);
  select * into v_n from public.formal_notice where id = p_notice_id and operator_id = v_op.id and status = 'sent';
  if v_n.id is null then
    raise exception 'notice_not_found' using errcode = 'P0002';
  end if;
  if v_n.reply is not null then
    raise exception 'already_replied: your reply is already on the record' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reply, ''))) not between 5 and 5000 then
    raise exception 'reply_required: write your reply' using errcode = '23514';
  end if;
  update public.formal_notice set reply = btrim(p_reply), replied_at = now() where id = v_n.id;
  perform app.audit('formal_notice.replied', 'formal_notice', v_n.id::text, 'Replied to a formal notice', null, null, null);
  perform app.notify_staff(array_remove(app.admin_recipient_ids() || array[v_n.approved_by], null),
    'formal_notice.reply', 'important', format('%s replied to a formal notice', v_op.name), v_n.subject, v_op.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- 9. Pay, profile and agreements stay readable after leaving --------------------------

create or replace function public.portal_pay()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
begin
  if app.is_impersonating() and not app.actor_can('payroll.view') then
    raise exception 'pay_hidden: pay is not available to your role' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'read_only', app.operator_stage(v_op) = 'inactive',
    'statements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'period_id', s.period_id,
               'period_start', pp.start_date,
               'period_end', pp.end_date,
               'period_status', pp.status,
               'closes_month', pp.closes_month,
               'client_name', app.placement_client_name(pl),
               'base_amount', s.base_amount,
               'base_detail', s.base_detail,
               'commission_amount', s.commission_amount,
               'commission_detail', s.commission_detail,
               'commission_bookings', coalesce((
                 select jsonb_agg(jsonb_build_object('id', b.id, 'customer', case when app.placement_customer_access(pl) then app.customer_short_name(b.customer_name) end,
                                                     'scheduled_for', b.scheduled_for, 'state', b.state,
                                                     'source', b.source)
                                  order by b.scheduled_for)
                 from unnest(s.commission_booking_ids) ids(booking_id)
                 join public.booking b on b.id = ids.booking_id), '[]'::jsonb),
               'speed_bonus_amount', s.speed_bonus_amount,
               'speed_bonus_detail', s.speed_bonus_detail,
               'adjustments', coalesce((
                 select jsonb_agg(jsonb_build_object('label', a.label, 'reason', a.reason, 'amount', a.amount,
                                                     'added_at', a.added_at) order by a.added_at)
                 from public.pay_adjustment a where a.statement_id = s.id), '[]'::jsonb),
               'adjustment_total', s.adjustment_total,
               'total', s.total,
               'locked', s.locked,
               'locked_at', s.locked_at,
               'payouts', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', po.id, 'amount', po.amount, 'method', po.method, 'status', po.status,
                          'sent_at', po.sent_at, 'confirmed_at', po.confirmed_at, 'failure_reason', po.failure_reason,
                          'rolled_into_period', (select r.period_id from public.payout r where r.id = po.rolled_into_payout_id),
                          'rolled_from_period', (select r.period_id from public.payout r where r.id = po.rolled_from_payout_id)
                        ) order by po.created_at)
                 from public.payout po where po.statement_id = s.id and po.operator_id = v_op.id), '[]'::jsonb),
               'questions', coalesce((
                 select jsonb_agg(jsonb_build_object('id', q.id, 'body', q.body, 'asked_at', q.asked_at,
                                                     'answer', q.answer, 'answered_at', q.answered_at,
                                                     'answered_by', app.profile_name(q.answered_by),
                                                     'unread', q.answered_at is not null and q.answer_read_at is null)
                                  order by q.asked_at)
                 from public.pay_question q where q.statement_id = s.id and q.operator_id = v_op.id), '[]'::jsonb)
             ) order by pp.start_date desc nulls last, s.created_at desc)
      from public.pay_statement s
      join public.placement pl on pl.id = s.placement_id
      left join public.pay_period pp on pp.id = s.period_id
      where s.operator_id = v_op.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
  v_pay boolean := not app.is_impersonating() or app.actor_can('payroll.view');
begin
  return jsonb_build_object(
    'name', v_op.name,
    'email', v_op.email,
    'phone', v_op.phone,
    'handle', v_op.handle,
    'country', v_op.country,
    'time_zone', app.safe_tz(v_op.time_zone),
    'preferred_channel', v_op.preferred_channel,
    'email_optional', v_op.email_digest,
    'status', v_op.status,
    'stage', app.operator_stage(v_op),
    'tier', v_op.tier,
    'certified_on', v_op.certified_on,
    'joined_on', v_op.joined_on,
    'pay_visible', v_pay,
    'payout_method', case when v_pay then v_op.payout_method end,
    'payout_last4', case when v_pay and v_op.payout_reference is not null then right(btrim(v_op.payout_reference), 4) end,
    'tax_doc_status', case when v_pay then v_op.tax_doc_status end,
    'tax_doc_reviewed_on', case when v_pay then v_op.tax_doc_reviewed_on end,
    'mfa_enabled', exists (select 1 from auth.mfa_factors f
                           where f.user_id = v_op.profile_id and f.status = 'verified'),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('fingerprint', d.fingerprint, 'label', d.label,
                                          'first_seen_at', d.first_seen_at, 'last_seen_at', d.last_seen_at)
                       order by d.last_seen_at desc)
      from public.known_device d where d.profile_id = v_op.profile_id
    ), '[]'::jsonb),
    'sign_ins', coalesce((
      select jsonb_agg(x.e order by x.at desc)
      from (
        select jsonb_build_object('at', l.at, 'outcome', l.outcome, 'city', l.city, 'country', l.country,
                                  'surface', l.surface) as e, l.at
        from public.login_event l
        where l.profile_id = v_op.profile_id
        order by l.at desc
        limit 10
      ) x
    ), '[]'::jsonb),
    'agreements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'name', coalesce(t.name, 'Agreement'),
               'status', a.status,
               'sent_at', a.sent_at,
               'completed_at', a.completed_at,
               'has_copy', v_pay and a.status = 'completed'
                           and (a.signed_document_url is not null or a.docuseal_submission_id is not null)
             ) order by a.sent_at desc nulls last)
      from public.da_agreement a
      join public.da_recipient d on d.id = a.recipient_id
      left join public.da_agreement_template t on t.id = a.template_id
      where d.operator_id = v_op.id and a.superseded_by_id is null
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.portal_agreement_copy(p_agreement_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator := app.portal_operator(true);
  v_row record;
begin
  if app.is_impersonating() and not app.actor_can('payroll.view') then
    raise exception 'agreement_hidden: agreements carry pay terms, which your role does not see' using errcode = '42501';
  end if;

  select a.id, a.signed_document_url, a.docuseal_submission_id, t.name as template_name
    into v_row
  from public.da_agreement a
  join public.da_recipient d on d.id = a.recipient_id
  left join public.da_agreement_template t on t.id = a.template_id
  where a.id = p_agreement_id and d.operator_id = v_op.id and a.status = 'completed';

  if v_row.id is null then
    raise exception 'agreement_not_found: that signed agreement is not yours' using errcode = 'P0002';
  end if;

  perform app.portal_view_audit('agreement');

  return jsonb_build_object(
    'signed_document_url', v_row.signed_document_url,
    'docuseal_submission_id', v_row.docuseal_submission_id,
    'template_name', v_row.template_name
  );
end;
$$;

