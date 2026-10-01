-- Prompt 8: staff functions (team board, queues, DA scorecard, decisions, formal notices,
-- settings) and the email dispatch queue.

-- 10. Staff: the team board, queues and DA's scorecard ---------------------------------

create or replace function app.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.actor_role() not in ('owner', 'admin', 'manager') or app.effective_state(auth.uid()) <> 'active' then
    raise exception 'permission_denied: this is for DA staff' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.staff_team_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_last_week date := (date_trunc('week', now() at time zone 'UTC') - interval '7 days')::date;
begin
  perform app.require_staff();
  return coalesce((
    select jsonb_agg(x.r order by x.sort, x.name)
    from (
      select o.name,
             case app.operator_stage(o) when 'placed' then 0 when 'waiting' then 1 when 'training' then 2 when 'applicant' then 3 else 4 end as sort,
             jsonb_build_object(
               'id', o.id,
               'name', o.name,
               'stage', app.operator_stage(o),
               'status', o.status,
               'tier', o.tier,
               'has_account', o.profile_id is not null,
               'placements', coalesce((
                 select jsonb_agg(jsonb_build_object('id', pl.id, 'client_name', app.placement_client_name(pl),
                                                     'live', app.placement_is_live(pl)) order by pl.start_date desc)
                 from public.placement pl
                 where pl.operator_id = o.id and pl.status <> 'draft' and app.staff_can_reach_placement(pl.id)), '[]'::jsonb),
               'standards', case when app.operator_stage(o) = 'placed' then (
                 select jsonb_agg(jsonb_build_object('key', s ->> 'key', 'label', s ->> 'label', 'status', s ->> 'status',
                                                     'value', s -> 'value', 'target', s -> 'target', 'unit', s ->> 'unit'))
                 from jsonb_array_elements(app.va_standard_rows(o.id, v_month) -> 'standards') s) end,
               'reviews_unconfirmed', (select count(*) from public.shift_draft d where d.operator_id = o.id and d.status = 'unconfirmed'
                                         and app.staff_can_reach_placement(d.placement_id)),
               'reviews_open', (select count(*) from public.shift_draft d where d.operator_id = o.id and d.status = 'open'
                                  and app.staff_can_reach_placement(d.placement_id)),
               'disputes_open', (select count(*) from public.standard_dispute d where d.operator_id = o.id and d.status = 'open'),
               'blockers', jsonb_build_object(
                 'mine', (select count(*) from public.shift_blocker b where b.operator_id = o.id and b.resolved_at is null and b.control = 'mine'
                            and app.staff_can_reach_placement(b.placement_id)),
                 'client', (select count(*) from public.shift_blocker b where b.operator_id = o.id and b.resolved_at is null and b.control = 'client'
                              and app.staff_can_reach_placement(b.placement_id)),
                 'da', (select count(*) from public.shift_blocker b where b.operator_id = o.id and b.resolved_at is null and b.control = 'da'
                          and app.staff_can_reach_placement(b.placement_id)),
                 'outside', (select count(*) from public.shift_blocker b where b.operator_id = o.id and b.resolved_at is null and b.control = 'outside'
                               and app.staff_can_reach_placement(b.placement_id))),
               'feedback_owed', app.operator_stage(o) = 'placed'
                                and not exists (select 1 from public.weekly_feedback f where f.operator_id = o.id and f.week_start = v_last_week),
               'self_review_ready', exists (select 1 from public.weekly_self_review s where s.operator_id = o.id and s.week_start = v_last_week),
               'flagged_shifts', (select count(*) from public.shift_attendance sa
                                  where sa.operator_id = o.id and sa.status = 'suspected_missed' and sa.decided_at is null
                                    and app.staff_can_reach_placement(sa.placement_id)),
               'availability', (select count(*) from public.operator_availability a where a.operator_id = o.id)
             ) as r
      from public.operator o
      where app.staff_can_reach_operator(o.id)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.staff_queues()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.actor_role() in ('owner', 'admin');
  v_last_week date := (date_trunc('week', now() at time zone 'UTC') - interval '7 days')::date;
begin
  perform app.require_staff();
  return jsonb_build_object(
    'last_week', v_last_week,
    'disputes', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'operator_id', d.operator_id, 'operator_name', o.name,
                                          'standard', m.label, 'item_label', d.item_label, 'item_kind', d.item_kind,
                                          'explanation', d.explanation, 'raised_at', d.raised_at) order by d.raised_at)
      from public.standard_dispute d
      join public.operator o on o.id = d.operator_id
      join public.metric_definition m on m.key = d.standard_key
      where d.status = 'open' and app.staff_can_reach_operator(d.operator_id)
        and (d.placement_id is null or app.staff_can_reach_placement(d.placement_id))), '[]'::jsonb),
    'blockers', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'operator_id', b.operator_id, 'operator_name', o.name,
                                          'client_name', app.placement_client_name(pl), 'shift_date', b.shift_date,
                                          'control', b.control, 'note', b.note, 'created_at', b.created_at) order by b.created_at)
      from public.shift_blocker b
      join public.operator o on o.id = b.operator_id
      join public.placement pl on pl.id = b.placement_id
      where b.resolved_at is null and b.control in ('client', 'da') and app.staff_can_reach_placement(b.placement_id)), '[]'::jsonb),
    'feedback_owed', coalesce((
      select jsonb_agg(jsonb_build_object('operator_id', o.id, 'operator_name', o.name, 'week_start', v_last_week,
                                          'self_review', (select s.focus_line from public.weekly_self_review s
                                                          where s.operator_id = o.id and s.week_start = v_last_week)) order by o.name)
      from public.operator o
      where app.operator_stage(o) = 'placed' and app.staff_can_reach_operator(o.id)
        and not exists (select 1 from public.weekly_feedback f where f.operator_id = o.id and f.week_start = v_last_week)), '[]'::jsonb),
    'suspected_missed', coalesce((
      select jsonb_agg(jsonb_build_object('id', sa.id, 'operator_id', sa.operator_id, 'operator_name', o.name,
                                          'placement_id', sa.placement_id, 'client_name', app.placement_client_name(pl),
                                          'shift_date', sa.shift_date, 'flagged_at', sa.flagged_at) order by sa.shift_date)
      from public.shift_attendance sa
      join public.operator o on o.id = sa.operator_id
      join public.placement pl on pl.id = sa.placement_id
      where sa.status = 'suspected_missed' and sa.decided_at is null and app.staff_can_reach_placement(sa.placement_id)), '[]'::jsonb),
    'attribution', coalesce((
      select jsonb_agg(jsonb_build_object('operator_id', d.operator_id, 'operator_name', o.name, 'placement_id', d.placement_id,
                                          'client_name', app.placement_client_name(pl), 'shift_date', d.shift_date,
                                          'ambiguous', (d.system_counts ->> 'ambiguous')::integer) order by d.shift_date desc)
      from public.shift_draft d
      join public.operator o on o.id = d.operator_id
      join public.placement pl on pl.id = d.placement_id
      where d.flagged_at is not null and d.shift_date >= current_date - 30 and app.staff_can_reach_placement(d.placement_id)), '[]'::jsonb),
    'tier_eligible', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object('operator_id', o.id, 'operator_name', o.name, 'tier', o.tier, 'to_tier', te.to_tier,
                                          'eligible_at', te.eligible_at) order by te.eligible_at)
      from public.tier_eligibility te join public.operator o on o.id = te.operator_id
      where te.decision_id is null and coalesce(o.tier, 1) < te.to_tier), '[]'::jsonb) else '[]'::jsonb end,
    'formal_drafts', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'operator_id', f.operator_id, 'operator_name', o.name, 'subject', f.subject,
                                          'drafted_by', app.profile_name(f.drafted_by), 'drafted_at', f.drafted_at) order by f.drafted_at)
      from public.formal_notice f join public.operator o on o.id = f.operator_id
      where f.status = 'draft'), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

-- DA's own on-time rates across every VA in scope, misses first.
create or replace function public.staff_da_scorecard(p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', coalesce(p_month, (now() at time zone 'UTC')::date))::date;
begin
  perform app.require_staff();
  return jsonb_build_object('month', v_month, 'commitments', coalesce((
    with per_op as (
      select o.id, o.name, c
      from public.operator o
      cross join lateral jsonb_array_elements(app.da_commitment_rows(o.id, v_month) -> 'commitments') c
      where app.staff_can_reach_operator(o.id)
        and exists (select 1 from public.placement pl where pl.operator_id = o.id and pl.status <> 'draft')
    )
    select jsonb_agg(jsonb_build_object(
             'key', k.key, 'label', k.label, 'target', k.target_label,
             'total', coalesce(a.total, 0), 'on_time', coalesce(a.on_time, 0),
             'rate', case when coalesce(a.total, 0) > 0 then round(100.0 * a.on_time / a.total, 1) end,
             'misses', coalesce(a.misses, '[]'::jsonb)) order by k.sort_order)
    from public.da_commitment k
    left join lateral (
      select sum((p.c ->> 'total')::integer) as total, sum((p.c ->> 'on_time')::integer) as on_time,
             jsonb_agg(m || jsonb_build_object('operator_id', p.id, 'operator_name', p.name))
               filter (where m is not null) as misses
      from per_op p
      left join lateral jsonb_array_elements(p.c -> 'misses') m on true
      where p.c ->> 'key' = k.key
    ) a on true
  ), '[]'::jsonb));
end;
$$;

-- 11. Staff: one VA's standards, record and feedback -----------------------------------

create or replace function public.staff_standards(p_operator_id uuid, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
begin
  perform app.require_staff();
  perform app.require_reach_operator(p_operator_id);
  select * into v_op from public.operator where id = p_operator_id;
  return jsonb_build_object('operator_id', v_op.id, 'name', v_op.name, 'stage', app.operator_stage(v_op))
    || app.va_standards_view(v_op.id, p_month)
    || jsonb_build_object(
      'findings', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'occurred_on', f.occurred_on, 'note', f.note,
                                            'recorded_by', app.profile_name(f.recorded_by)) order by f.occurred_on desc)
        from public.standard_finding f where f.operator_id = v_op.id), '[]'::jsonb),
      'productive_time', coalesce((
        select jsonb_agg(jsonb_build_object('placement_id', pt.placement_id, 'week_start', pt.week_start, 'minutes', pt.minutes,
                                            'entered_by', app.profile_name(pt.entered_by)) order by pt.week_start desc)
        from public.productive_time pt where pt.operator_id = v_op.id and app.staff_can_reach_placement(pt.placement_id)), '[]'::jsonb),
      'placements', coalesce((
        select jsonb_agg(jsonb_build_object('id', pl.id, 'client_name', app.placement_client_name(pl), 'live', app.placement_is_live(pl),
                                            'productive_minutes_weekly', pl.productive_minutes_weekly,
                                            'exclusions', coalesce((
                                              select jsonb_agg(jsonb_build_object('id', w.id, 'starts_at', w.starts_at, 'ends_at', w.ends_at,
                                                                                  'kind', w.kind, 'reason', w.reason,
                                                                                  'created_by', app.profile_name(w.created_by)) order by w.starts_at desc)
                                              from public.exclusion_window w where w.placement_id = pl.id), '[]'::jsonb))
                         order by pl.start_date desc)
        from public.placement pl where pl.operator_id = v_op.id and pl.status <> 'draft' and app.staff_can_reach_placement(pl.id)), '[]'::jsonb));
end;
$$;

create or replace function public.staff_standard_items(p_operator_id uuid, p_key text, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  perform app.require_staff();
  perform app.require_reach_operator(p_operator_id);
  v_items := app.va_standard_items(p_operator_id, p_key, coalesce(p_month, (now() at time zone 'UTC')::date));
  return jsonb_set(v_items, '{items}', coalesce((
    select jsonb_agg(i) from jsonb_array_elements(v_items -> 'items') i
    where i ->> 'placement_id' is null or app.staff_can_reach_placement((i ->> 'placement_id')::uuid)), '[]'::jsonb));
end;
$$;

-- Shift reviews with reflections and blockers: the VA, their manager and admins only.
create or replace function public.staff_shift_reviews(p_operator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  perform app.require_reach_operator(p_operator_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'placement_id', d.placement_id, 'client_name', app.placement_client_name(pl),
             'shift_date', d.shift_date, 'status', d.status, 'system', d.system_counts, 'flagged', d.flagged_at is not null,
             'report', (select jsonb_build_object('conversations_handled', r.conversations_handled,
                                                  'appointments_booked', r.appointments_booked,
                                                  'follow_ups_completed', r.follow_ups_completed,
                                                  'escalations_raised', r.escalations_raised,
                                                  'shift_start_actual', r.shift_start_actual, 'shift_end_actual', r.shift_end_actual,
                                                  'variance_explanation', r.variance_explanation, 'version', r.version)
                        from public.eod_report r where r.placement_id = d.placement_id and r.shift_date = d.shift_date and r.superseded_by_id is null),
             'reflection', jsonb_build_object('went_well', d.reflection_went_well, 'differently', d.reflection_differently,
                                              'in_way', d.reflection_in_way),
             'blockers', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'control', b.control, 'note', b.note,
                                                                       'resolved_at', b.resolved_at, 'resolution', b.resolution))
                                   from public.shift_blocker b where b.draft_id = d.id), '[]'::jsonb)
           ) order by d.shift_date desc)
    from public.shift_draft d join public.placement pl on pl.id = d.placement_id
    where d.operator_id = p_operator_id and app.staff_can_reach_placement(d.placement_id) and d.shift_date >= current_date - 60
  ), '[]'::jsonb);
end;
$$;

create or replace function public.staff_feedback_context(p_operator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_last_week date := (date_trunc('week', now() at time zone 'UTC') - interval '7 days')::date;
begin
  perform app.require_staff();
  perform app.require_reach_operator(p_operator_id);
  select * into v_op from public.operator where id = p_operator_id;
  return jsonb_build_object(
    'operator_id', v_op.id, 'name', v_op.name, 'week_start', v_last_week,
    'self_review', (select jsonb_build_object('focus_line', s.focus_line, 'submitted_at', s.submitted_at)
                    from public.weekly_self_review s where s.operator_id = v_op.id and s.week_start = v_last_week),
    'reflections', coalesce((
      select jsonb_agg(jsonb_build_object('shift_date', d.shift_date, 'went_well', d.reflection_went_well,
                                          'differently', d.reflection_differently, 'in_way', d.reflection_in_way) order by d.shift_date)
      from public.shift_draft d where d.operator_id = v_op.id and d.shift_date between v_last_week and v_last_week + 6
        and app.staff_can_reach_placement(d.placement_id)), '[]'::jsonb),
    'standards', app.va_standard_rows(v_op.id, (now() at time zone 'UTC')::date) -> 'standards',
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'week_start', f.week_start, 'keep_doing', f.keep_doing, 'improve', f.improve,
                                          'focus', f.focus, 'author', f.author_name, 'acknowledged_at', f.acknowledged_at,
                                          'reply', f.reply) order by f.week_start desc)
      from (select * from public.weekly_feedback where operator_id = v_op.id order by week_start desc limit 12) f), '[]'::jsonb)
  );
end;
$$;

-- 12. Staff: decisions (all in the staff member's own name, all recorded) --------------

create or replace function public.staff_post_feedback(p_operator_id uuid, p_week_start date, p_keep_doing text, p_improve text, p_focus text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.weekly_feedback;
begin
  perform app.require_own_name('feedback.write');
  perform app.require_reach_operator(p_operator_id);
  if p_week_start is null or extract(isodow from p_week_start) <> 1 or p_week_start > current_date then
    raise exception 'week_invalid: feedback is for a week that has started, from its Monday' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_keep_doing, ''))) < 3 or length(btrim(coalesce(p_improve, ''))) < 3 or length(btrim(coalesce(p_focus, ''))) < 3 then
    raise exception 'feedback_incomplete: fill in keep doing, improve, and next week''s focus' using errcode = '23514';
  end if;
  if length(btrim(p_focus)) > 300 then
    raise exception 'focus_too_long: the focus is one sentence' using errcode = '23514';
  end if;
  if exists (select 1 from public.weekly_feedback f where f.operator_id = p_operator_id and f.week_start = p_week_start) then
    raise exception 'already_posted: feedback for that week is already posted' using errcode = '23514';
  end if;

  insert into public.weekly_feedback (operator_id, week_start, keep_doing, improve, focus, author_profile_id, author_name)
  values (p_operator_id, p_week_start, btrim(p_keep_doing), btrim(p_improve), btrim(p_focus), auth.uid(), app.profile_name(auth.uid()))
  returning * into v_row;

  perform app.audit('feedback.posted', 'weekly_feedback', v_row.id::text,
    format('Posted weekly feedback for the week of %s', p_week_start), null, null, null);
  perform app.notify_template(p_operator_id, 'feedback_posted',
    jsonb_build_object('week', to_char(p_week_start, 'FMMon FMDD'), 'manager', split_part(app.profile_name(auth.uid()), ' ', 1),
                       'focus', v_row.focus),
    '/vistrial/operator/growth#feedback-' || v_row.id);
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.staff_decide_dispute(p_dispute_id uuid, p_approve boolean, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_d public.standard_dispute;
  v_label text;
begin
  perform app.require_own_name('standards.decide');
  select * into v_d from public.standard_dispute where id = p_dispute_id;
  if v_d.id is null then
    raise exception 'dispute_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_operator(v_d.operator_id);
  if v_d.placement_id is not null then
    perform app.require_reach_placement(v_d.placement_id);
  end if;
  if v_d.status <> 'open' then
    raise exception 'already_decided: that dispute has been decided' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'reason_required: the VA sees your reason' using errcode = '23514';
  end if;

  update public.standard_dispute
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_by = auth.uid(), decided_at = now(), decision_reason = btrim(p_reason)
   where id = v_d.id;

  select label into v_label from public.metric_definition where key = v_d.standard_key;
  perform app.audit('standard.dispute_decided', 'standard_dispute', v_d.id::text,
    format('%s the dispute on %s: %s', case when p_approve then 'Approved' else 'Declined' end, v_d.item_label, btrim(p_reason)),
    null, null, (select pl.case_file_id from public.placement pl where pl.id = v_d.placement_id));
  perform app.notify_template(v_d.operator_id, 'dispute_decided',
    jsonb_build_object('standard', lower(v_label), 'outcome', case when p_approve then 'approved' else 'declined' end,
                       'manager', split_part(app.profile_name(auth.uid()), ' ', 1), 'item', lower(left(v_d.item_label, 1)) || substr(v_d.item_label, 2),
                       'reason', btrim(p_reason),
                       'effect', case when not p_approve then 'The item stays counted, and the dispute stays on your record with this reason.'
                                      when v_d.item_kind = 'booking' then 'Your manager will re-review the booking itself; bookings only count through that review.'
                                      else 'The item is now excluded from your numbers, with this reason shown.' end),
    '/vistrial/operator/standards?key=' || v_d.standard_key, v_d.placement_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_resolve_blocker(p_blocker_id uuid, p_resolution text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_b public.shift_blocker;
begin
  perform app.require_own_name('standards.decide');
  select * into v_b from public.shift_blocker where id = p_blocker_id;
  if v_b.id is null then
    raise exception 'blocker_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_b.placement_id);
  if v_b.resolved_at is not null then
    raise exception 'already_resolved' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_resolution, ''))) not between 3 and 2000 then
    raise exception 'resolution_required: say what was done' using errcode = '23514';
  end if;
  update public.shift_blocker set resolved_at = now(), resolved_by = auth.uid(), resolution = btrim(p_resolution) where id = v_b.id;
  perform app.audit('blocker.resolved', 'shift_blocker', v_b.id::text, 'Resolved a blocker: ' || btrim(p_resolution), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = v_b.placement_id));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_add_exclusion(p_placement_id uuid, p_starts timestamptz, p_ends timestamptz, p_kind text, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.exclusion_window;
begin
  perform app.require_own_name('standards.exclusions');
  perform app.require_reach_placement(p_placement_id);
  if p_starts is null or p_ends is null or p_ends <= p_starts or p_ends - p_starts > interval '14 days' then
    raise exception 'window_invalid: a window has a start before its end, up to 14 days' using errcode = '23514';
  end if;
  if p_kind not in ('outage', 'client_incident') then
    raise exception 'kind_invalid' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 1000 then
    raise exception 'reason_required: VAs see the reason next to each excluded item' using errcode = '23514';
  end if;
  insert into public.exclusion_window (placement_id, starts_at, ends_at, kind, reason, created_by)
  values (p_placement_id, p_starts, p_ends, p_kind, btrim(p_reason), auth.uid())
  returning * into v_row;
  perform app.audit('standard.exclusion_added', 'exclusion_window', v_row.id::text,
    format('Marked %s to %s as %s: %s', p_starts, p_ends, replace(p_kind, '_', ' '), btrim(p_reason)), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = p_placement_id));
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.staff_record_finding(p_operator_id uuid, p_placement_id uuid, p_occurred_on date, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.standard_finding;
begin
  perform app.require_own_name('standards.decide');
  perform app.require_reach_placement(p_placement_id);
  if not exists (select 1 from public.placement pl where pl.id = p_placement_id and pl.operator_id = p_operator_id) then
    raise exception 'placement_mismatch' using errcode = '23514';
  end if;
  if p_occurred_on is null or p_occurred_on > current_date then
    raise exception 'date_invalid' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 5 and 2000 then
    raise exception 'note_required: record the verified facts' using errcode = '23514';
  end if;
  insert into public.standard_finding (operator_id, placement_id, standard_key, occurred_on, note, recorded_by)
  values (p_operator_id, p_placement_id, 'va_escalation_discipline', p_occurred_on, btrim(p_note), auth.uid())
  returning * into v_row;
  perform app.audit('standard.finding', 'standard_finding', v_row.id::text,
    format('Recorded an escalation-discipline finding for %s', p_occurred_on), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = p_placement_id));
  perform app.notify_template(p_operator_id, 'finding_recorded',
    jsonb_build_object('manager', split_part(app.profile_name(auth.uid()), ' ', 1), 'date', to_char(p_occurred_on, 'FMDy, Mon FMDD')),
    '/vistrial/operator/standards?key=va_escalation_discipline', p_placement_id);
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

create or replace function public.staff_set_productive_time(p_operator_id uuid, p_placement_id uuid, p_week_start date, p_minutes integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('standards.productive_time');
  perform app.require_reach_placement(p_placement_id);
  if not exists (select 1 from public.placement pl where pl.id = p_placement_id and pl.operator_id = p_operator_id) then
    raise exception 'placement_mismatch' using errcode = '23514';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'week_invalid: enter productive time for a week, from its Monday' using errcode = '23514';
  end if;
  if p_minutes is null or p_minutes not between 0 and 10080 then
    raise exception 'minutes_invalid' using errcode = '23514';
  end if;
  insert into public.productive_time (operator_id, placement_id, week_start, minutes, entered_by)
  values (p_operator_id, p_placement_id, p_week_start, p_minutes, auth.uid())
  on conflict (operator_id, placement_id, week_start) do update
    set minutes = excluded.minutes, entered_by = excluded.entered_by, entered_at = now();
  perform app.audit('standard.productive_time', 'placement', p_placement_id::text,
    format('Entered %s productive minutes for the week of %s', p_minutes, p_week_start), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = p_placement_id));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_set_productive_threshold(p_placement_id uuid, p_minutes integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('standards.productive_time');
  perform app.require_reach_placement(p_placement_id);
  if p_minutes is not null and p_minutes not between 1 and 10080 then
    raise exception 'minutes_invalid' using errcode = '23514';
  end if;
  update public.placement set productive_minutes_weekly = p_minutes where id = p_placement_id;
  perform app.audit('placement.productive_threshold', 'placement', p_placement_id::text,
    format('Set the weekly productive-time threshold to %s minutes', coalesce(p_minutes::text, 'none')), null, null,
    (select pl.case_file_id from public.placement pl where pl.id = p_placement_id));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_decide_tier(p_operator_id uuid, p_to_tier smallint, p_approve boolean, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_dec public.tier_decision;
begin
  perform app.require_own_name('tiers.decide');
  perform app.require_reach_operator(p_operator_id);
  select * into v_op from public.operator where id = p_operator_id;
  if p_to_tier not between 1 and 3 or p_to_tier = coalesce(v_op.tier, 1) then
    raise exception 'tier_invalid: choose a tier different from their current one' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'reason_required: the VA sees your reason' using errcode = '23514';
  end if;

  insert into public.tier_decision (operator_id, from_tier, to_tier, decision, reason, decided_by)
  values (v_op.id, v_op.tier, p_to_tier, case when p_approve then 'approved' else 'declined' end, btrim(p_reason), auth.uid())
  returning * into v_dec;
  if p_approve then
    update public.operator set tier = p_to_tier, updated_at = now() where id = v_op.id;
  end if;
  update public.tier_eligibility set decision_id = v_dec.id where operator_id = v_op.id and to_tier = p_to_tier and decision_id is null;

  perform app.audit('tier.decided', 'operator', v_op.id::text,
    format('%s a move from Tier %s to Tier %s: %s', case when p_approve then 'Approved' else 'Declined' end,
           coalesce(v_op.tier, 1), p_to_tier, btrim(p_reason)),
    jsonb_build_object('tier', v_op.tier), jsonb_build_object('tier', case when p_approve then p_to_tier else v_op.tier end), null);
  perform app.notify_template(v_op.id, case when p_approve then 'tier_approved' else 'tier_declined' end,
    jsonb_build_object('tier', p_to_tier, 'reason', btrim(p_reason), 'admin', split_part(app.profile_name(auth.uid()), ' ', 1)),
    '/vistrial/operator/growth');
  return jsonb_build_object('ok', true, 'id', v_dec.id);
end;
$$;

-- 13. Formal notices: drafted from a template, sent only by an admin -------------------

create or replace function public.staff_draft_formal_notice(p_operator_id uuid, p_template_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.message_template;
  v_op public.operator;
  v_row public.formal_notice;
  v_vars jsonb;
begin
  perform app.require_own_name('notices.formal');
  perform app.require_reach_operator(p_operator_id);
  select * into t from public.message_template where key = p_template_key and formal;
  if t.key is null then
    raise exception 'template_missing: choose a formal notice template' using errcode = 'P0002';
  end if;
  select * into v_op from public.operator where id = p_operator_id;
  v_vars := jsonb_build_object('first_name', split_part(btrim(v_op.name), ' ', 1));
  insert into public.formal_notice (operator_id, template_key, subject, body, drafted_by)
  values (v_op.id, t.key, app.render_template(t.subject, v_vars), app.render_template(t.body, v_vars), auth.uid())
  returning * into v_row;
  perform app.audit('formal_notice.drafted', 'formal_notice', v_row.id::text, 'Drafted a formal notice: ' || v_row.subject, null, null, null);
  return jsonb_build_object('ok', true, 'id', v_row.id, 'subject', v_row.subject, 'body', v_row.body);
end;
$$;

create or replace function public.staff_formal_notices(p_operator_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  if p_operator_id is not null then
    perform app.require_reach_operator(p_operator_id);
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', f.id, 'operator_id', f.operator_id, 'operator_name', o.name,
                                        'template_key', f.template_key, 'subject', f.subject, 'body', f.body, 'status', f.status,
                                        'drafted_by', app.profile_name(f.drafted_by), 'drafted_at', f.drafted_at,
                                        'approved_by', app.profile_name(f.approved_by), 'sent_at', f.sent_at,
                                        'reply', f.reply, 'replied_at', f.replied_at) order by f.drafted_at desc)
    from public.formal_notice f join public.operator o on o.id = f.operator_id
    where (p_operator_id is null or f.operator_id = p_operator_id) and app.staff_can_reach_operator(f.operator_id)
  ), '[]'::jsonb);
end;
$$;

-- The admin reviews and edits the draft, then presses send. That admin is recorded as the approver.
create or replace function public.staff_send_formal_notice(p_notice_id uuid, p_subject text, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_n public.formal_notice;
begin
  perform app.require_own_name('notices.formal');
  select * into v_n from public.formal_notice where id = p_notice_id;
  if v_n.id is null then
    raise exception 'notice_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_operator(v_n.operator_id);
  if v_n.status <> 'draft' then
    raise exception 'already_sent: that notice is not a draft' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_subject, ''))) not between 3 and 200 or length(btrim(coalesce(p_body, ''))) not between 20 and 10000 then
    raise exception 'notice_incomplete: write the subject and the notice' using errcode = '23514';
  end if;
  if p_body ~ '\[fill in|\[section|\[the specific|\[date\]' then
    raise exception 'placeholders_left: replace every bracketed placeholder with the verified facts before sending' using errcode = '23514';
  end if;

  update public.formal_notice
     set subject = btrim(p_subject), body = btrim(p_body), status = 'sent', approved_by = auth.uid(), sent_at = now()
   where id = v_n.id;

  perform app.notify_operator(v_n.operator_id, 'formal', 'urgent', btrim(p_subject),
    'You have a formal notice on your account. Open it to read it in full and reply if you wish; your reply is kept with the record.',
    '/vistrial/operator/notice/' || v_n.id, 'immediate', btrim(p_subject), null, true, v_n.id);

  perform app.audit('formal_notice.sent', 'formal_notice', v_n.id::text,
    format('Reviewed and sent a formal notice: %s', btrim(p_subject)), null,
    jsonb_build_object('subject', btrim(p_subject), 'body', btrim(p_body)), null);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_cancel_formal_notice(p_notice_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('notices.formal');
  update public.formal_notice set status = 'cancelled' where id = p_notice_id and status = 'draft';
  if not found then
    raise exception 'notice_not_found: no draft with that id' using errcode = 'P0002';
  end if;
  perform app.audit('formal_notice.cancelled', 'formal_notice', p_notice_id::text, 'Cancelled a formal notice draft', null, null, null);
  return jsonb_build_object('ok', true);
end;
$$;

-- 14. Staff: availability for matching, settings ---------------------------------------

create or replace function public.staff_availability()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'operator_id', o.id, 'name', o.name, 'status', o.status, 'tier', o.tier, 'certified_on', o.certified_on,
             'time_zone', app.safe_tz(o.time_zone),
             'windows', coalesce((select jsonb_agg(jsonb_build_object('iso_day', a.iso_day, 'starts', a.starts, 'ends', a.ends)
                                                   order by a.iso_day, a.starts)
                                  from public.operator_availability a where a.operator_id = o.id), '[]'::jsonb)
           ) order by o.name)
    from public.operator o
    where app.operator_stage(o) = 'waiting' and (app.actor_role() in ('owner', 'admin') or app.staff_can_reach_operator(o.id))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.staff_accountability_settings()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_staff();
  return jsonb_build_object(
    'can_edit', app.actor_allowed('team.settings'),
    'team', (select to_jsonb(s) - 'updated_by' || jsonb_build_object('updated_by', app.profile_name(s.updated_by))
             from public.team_setting s where s.id = 1),
    'commitments', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.da_commitment c), '[]'::jsonb),
    'tier_criteria', coalesce((select jsonb_agg(to_jsonb(c) order by c.tier, c.sort_order) from public.tier_criterion c), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(to_jsonb(t) - 'updated_by' || jsonb_build_object('updated_by', app.profile_name(t.updated_by))
                                            order by t.sort_order) from public.message_template t), '[]'::jsonb)
  );
end;
$$;

create or replace function public.staff_save_team_setting(p_reply_to text, p_from_name text, p_inactive_months integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('team.settings');
  if p_reply_to is not null and p_reply_to !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'reply_to_invalid: enter a monitored email address' using errcode = '23514';
  end if;
  if p_reply_to ~* '(no-?reply|do-?not-?reply)' then
    raise exception 'reply_to_invalid: replies must reach a person, never a no-reply address' using errcode = '23514';
  end if;
  if p_inactive_months is not null and p_inactive_months not between 0 and 120 then
    raise exception 'months_invalid' using errcode = '23514';
  end if;
  update public.team_setting
     set reply_to = coalesce(nullif(btrim(p_reply_to), ''), reply_to),
         from_name = coalesce(nullif(btrim(p_from_name), ''), from_name),
         inactive_access_months = coalesce(p_inactive_months, inactive_access_months),
         updated_by = auth.uid(), updated_at = now()
   where id = 1;
  perform app.audit('team.settings', 'team_setting', '1', 'Changed team sending and access settings', null,
    jsonb_build_object('reply_to', p_reply_to, 'from_name', p_from_name, 'inactive_access_months', p_inactive_months), null);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_save_commitment(p_key text, p_target_value numeric, p_target_label text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('team.settings');
  if p_target_value is not null and p_target_value < 0 then
    raise exception 'target_invalid' using errcode = '23514';
  end if;
  update public.da_commitment
     set target_value = case when key in ('pay_on_schedule', 'pay_questions') then coalesce(p_target_value, target_value) else target_value end,
         target_label = coalesce(nullif(btrim(p_target_label), ''), target_label)
   where key = p_key;
  if not found then
    raise exception 'commitment_not_found' using errcode = 'P0002';
  end if;
  perform app.audit('team.commitment', 'da_commitment', p_key, format('Changed DA commitment %s', p_key), null,
    jsonb_build_object('target_value', p_target_value, 'target_label', p_target_label), null);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.staff_save_tier_criterion(
  p_id uuid, p_tier smallint, p_kind text, p_threshold numeric, p_label text, p_delete boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  perform app.require_own_name('team.settings');
  if p_delete then
    delete from public.tier_criterion where id = p_id;
    perform app.audit('team.tier_criterion', 'tier_criterion', p_id::text, 'Removed a tier criterion', null, null, null);
    return jsonb_build_object('ok', true);
  end if;
  if p_tier not between 2 and 3 or p_kind not in ('months_placed', 'standards_met_months', 'zero_abandonments_days', 'training_complete')
     or p_threshold is null or p_threshold < 0 or length(btrim(coalesce(p_label, ''))) < 3 then
    raise exception 'criterion_invalid: a tier, a kind, a threshold and a label the VA reads' using errcode = '23514';
  end if;
  if v_id is null then
    insert into public.tier_criterion (tier, kind, threshold, label) values (p_tier, p_kind, p_threshold, btrim(p_label)) returning id into v_id;
  else
    update public.tier_criterion set tier = p_tier, kind = p_kind, threshold = p_threshold, label = btrim(p_label) where id = v_id;
  end if;
  perform app.audit('team.tier_criterion', 'tier_criterion', v_id::text,
    format('Saved a Tier %s criterion: %s', p_tier, btrim(p_label)), null, null, null);
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.staff_save_template(p_key text, p_subject text, p_body text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_own_name('team.settings');
  if length(btrim(coalesce(p_subject, ''))) not between 3 and 200 or length(btrim(coalesce(p_body, ''))) not between 10 and 5000 then
    raise exception 'template_invalid: a subject and a body' using errcode = '23514';
  end if;
  update public.message_template set subject = btrim(p_subject), body = btrim(p_body), updated_by = auth.uid(), updated_at = now()
   where key = p_key;
  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;
  perform app.audit('team.template', 'message_template', p_key, format('Edited the "%s" message', p_key), null,
    jsonb_build_object('subject', btrim(p_subject)), null);
  return jsonb_build_object('ok', true);
end;
$$;

-- 15. The email dispatcher's queue (service role only) --------------------------------

-- Claims what should be emailed now: immediate messages at once, and each VA's
-- normal messages as one daily digest during their working hours.
create or replace function public.notify_claim_emails(p_limit integer default 100)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_setting public.team_setting;
  v_out jsonb := '[]'::jsonb;
  r record;
  v_op public.operator;
  v_items jsonb;
begin
  select * into v_setting from public.team_setting where id = 1;

  -- A claim whose send never got recorded (the sender crashed) goes back in the queue.
  update public.operator_notification n set email_claimed_at = null
   where n.email_claimed_at < now() - interval '30 minutes'
     and not exists (select 1 from public.notification_attempt a where a.notification_id = n.id and a.channel <> 'in_app');

  -- Nowhere to send, or an optional message the VA turned off: skipped, and recorded.
  with skipped as (
    update public.operator_notification n set email_claimed_at = now()
      from public.operator o
     where o.id = n.operator_id and n.email_claimed_at is null
       and (nullif(btrim(coalesce(o.email, '')), '') is null or (not n.required and not o.email_digest))
    returning n.id, (nullif(btrim(coalesce(o.email, '')), '') is null) as no_email
  )
  insert into public.notification_attempt (notification_id, channel, status, attempted_at, detail)
  select id, 'email', 'skipped', now(), case when no_email then 'No email address on file' else 'Optional email turned off by the VA' end
  from skipped;

  -- Immediate: one email each.
  for r in
    select n.* from public.operator_notification n
    where n.email_claimed_at is null and n.urgency = 'immediate'
    order by n.created_at
    limit p_limit
    for update skip locked
  loop
    update public.operator_notification set email_claimed_at = now() where id = r.id;
    select * into v_op from public.operator where id = r.operator_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'kind', 'single', 'operator_id', v_op.id, 'to', v_op.email, 'first_name', split_part(btrim(v_op.name), ' ', 1),
      'preferred_channel', v_op.preferred_channel,
      'items', jsonb_build_array(jsonb_build_object('id', r.id, 'subject', coalesce(r.email_subject, r.title),
                                                    'title', r.title, 'body', r.body, 'link', r.link_path, 'formal', r.kind = 'formal'))));
  end loop;

  -- Normal: a digest per VA, at most daily, inside their working hours.
  for v_op in
    select o.* from public.operator o
    where exists (select 1 from public.operator_notification n where n.operator_id = o.id and n.email_claimed_at is null and n.urgency = 'normal')
      and (o.last_digest_at is null or o.last_digest_at < now() - interval '20 hours')
      and app.operator_in_working_hours(o.id)
    limit p_limit
  loop
    with claimed as (
      update public.operator_notification n set email_claimed_at = now()
       where n.operator_id = v_op.id and n.email_claimed_at is null and n.urgency = 'normal'
      returning n.*
    )
    select jsonb_agg(jsonb_build_object('id', c.id, 'subject', coalesce(c.email_subject, c.title), 'title', c.title,
                                        'body', c.body, 'link', c.link_path, 'formal', false) order by c.created_at)
      into v_items from claimed c;
    update public.operator set last_digest_at = now() where id = v_op.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'kind', 'digest', 'operator_id', v_op.id, 'to', v_op.email, 'first_name', split_part(btrim(v_op.name), ' ', 1),
      'preferred_channel', v_op.preferred_channel, 'items', coalesce(v_items, '[]'::jsonb)));
  end loop;

  return jsonb_build_object(
    'from_name', v_setting.from_name, 'from_address', v_setting.from_address,
    'reply_to', v_setting.reply_to, 'base_url', v_setting.base_url, 'messages', v_out);
end;
$$;

-- Records each attempt: [{notification_id, channel, status, detail}].
create or replace function public.notify_record_attempts(p_attempts jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_attempt (notification_id, channel, status, attempted_at, detail)
  select (a ->> 'notification_id')::uuid, (a ->> 'channel')::public.notification_channel,
         (a ->> 'status')::public.delivery_status, now(), left(a ->> 'detail', 1000)
  from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) a
  where exists (select 1 from public.operator_notification n where n.id = (a ->> 'notification_id')::uuid);
  get diagnostics v_count = row_count;
  return jsonb_build_object('recorded', v_count);
end;
$$;

-- 16. Grants --------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'app.render_template(text, jsonb)', 'app.op_tz(uuid)', 'app.op_time(uuid, timestamptz, text)',
    'app.notify_template(uuid, text, jsonb, text, uuid, text)', 'app.link_report_to_draft()', 'app.confirm_draft_from_report()',
    'app.pay_period_end_for(date)', 'app.operator_in_working_hours(uuid)', 'app.hhmm(timestamptz, text)',
    'app.standard_definitions()', 'app.va_standards_view(uuid, date)', 'app.require_staff()',
    'public.notify_claim_emails(integer)', 'public.notify_record_attempts(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;

  foreach f in array array[
    'public.portal_live(uuid)', 'public.portal_shift_reviews(uuid)',
    'public.portal_confirm_shift(uuid, date, jsonb, text, jsonb, text, text, text, text)',
    'public.portal_standards(date)', 'public.portal_standard_items(text, date)', 'public.portal_raise_dispute(text, text, date, text)',
    'public.portal_commitments(date)', 'public.portal_growth()', 'public.portal_ack_feedback(uuid, text)',
    'public.portal_submit_self_review(text)', 'public.portal_availability()', 'public.portal_set_availability(jsonb, text)',
    'public.portal_set_email_prefs(boolean)', 'public.portal_inbox()', 'public.portal_formal_notice(uuid)',
    'public.portal_reply_formal_notice(uuid, text)',
    'public.staff_team_board()', 'public.staff_queues()', 'public.staff_da_scorecard(date)',
    'public.staff_standards(uuid, date)', 'public.staff_standard_items(uuid, text, date)', 'public.staff_shift_reviews(uuid)',
    'public.staff_feedback_context(uuid)', 'public.staff_post_feedback(uuid, date, text, text, text)',
    'public.staff_decide_dispute(uuid, boolean, text)', 'public.staff_resolve_blocker(uuid, text)',
    'public.staff_add_exclusion(uuid, timestamptz, timestamptz, text, text)', 'public.staff_record_finding(uuid, uuid, date, text)',
    'public.staff_set_productive_time(uuid, uuid, date, integer)', 'public.staff_set_productive_threshold(uuid, integer)',
    'public.staff_decide_tier(uuid, smallint, boolean, text)', 'public.staff_draft_formal_notice(uuid, text)',
    'public.staff_formal_notices(uuid)', 'public.staff_send_formal_notice(uuid, text, text)', 'public.staff_cancel_formal_notice(uuid)',
    'public.staff_availability()', 'public.staff_accountability_settings()', 'public.staff_save_team_setting(text, text, integer)',
    'public.staff_save_commitment(text, numeric, text)', 'public.staff_save_tier_criterion(uuid, smallint, text, numeric, text, boolean)',
    'public.staff_save_template(text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  grant execute on function public.notify_claim_emails(integer) to service_role;
  grant execute on function public.notify_record_attempts(jsonb) to service_role;
end
$$;
