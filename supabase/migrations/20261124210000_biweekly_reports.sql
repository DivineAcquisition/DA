-- Bi-weekly client reports.
--
--  * A third report kind, 'biweekly', on the 2-week pay period cycle
--    (app.pay_period). It replaces the weekly report: weekly is turned off for
--    every seat and off by default for new seats; daily EOD reports stay.
--  * The sweep opens the report the Monday after a period ends, at the seat's
--    send time. The app then pulls the period's data, re-checks the operator's
--    numbers against GoHighLevel, drafts the analysis (summary, improvements,
--    next 2 weeks' sales focus) and emails the draft to DA staff.
--  * A drafted bi-weekly report sends itself 24 hours after it opened unless
--    someone holds or edits it. The client only ever sees verified numbers;
--    mismatches stay in sales_report.integrity for staff.

alter table public.sales_report drop constraint if exists sales_report_kind_check;
alter table public.sales_report
  add constraint sales_report_kind_check check (kind in ('weekly', 'daily', 'biweekly'));
alter table public.sales_report_skip drop constraint if exists sales_report_skip_kind_check;
alter table public.sales_report_skip
  add constraint sales_report_skip_kind_check check (kind in ('weekly', 'daily', 'biweekly'));

alter table public.sales_report_config
  add column if not exists biweekly_enabled boolean not null default true;
alter table public.sales_report_config alter column weekly_enabled set default false;
update public.sales_report_config set weekly_enabled = false where weekly_enabled;

alter table public.sales_report
  add column if not exists auto_send_at timestamptz,
  add column if not exists analysis jsonb,
  add column if not exists integrity jsonb,
  add column if not exists analyzed_at timestamptz,
  add column if not exists draft_sent_at timestamptz;

comment on column public.sales_report.analysis is
  'Bi-weekly: the findings and draft the app produced from the period''s data. Staff only.';
comment on column public.sales_report.integrity is
  'Bi-weekly: operator numbers vs GoHighLevel for the period (mismatches, unverified days). Staff only, never sent to the client.';

-- A 2-week target: the weekly target twice, else the daily target per working day.
create or replace function app.so_client_target(p_placement uuid, p_metric text, p_day date, p_kind text, p_start date, p_end date)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_t public.activity_target;
  v_days integer;
  v_pl public.placement;
begin
  v_t := app.so_target(p_placement, p_metric, p_day);
  if v_t.id is null then
    return null;
  end if;
  if p_kind = 'daily' then
    return v_t.daily;
  end if;
  if v_t.weekly is not null then
    return case when p_kind = 'biweekly' then v_t.weekly * 2 else v_t.weekly end;
  end if;
  select * into v_pl from public.placement where id = p_placement;
  select count(*) into v_days
  from generate_series(p_start, p_end, interval '1 day') g
  where extract(isodow from g)::smallint = any (v_pl.working_days);
  if v_t.daily is null or v_days = 0 then
    return null;
  end if;
  return v_t.daily * v_days;
end;
$$;

revoke all on function app.so_client_target(uuid, text, date, text, date, date) from public, anon, authenticated;

create or replace function public.so_report_ensure(p_placement uuid, p_kind text, p_start date, p_end date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_launch public.placement_launch;
  v_count integer;
  v_workdays integer;
  v_summary text;
  v_first boolean;
  v_approval boolean;
  v_start date := p_start;
begin
  if p_kind not in ('weekly', 'daily', 'biweekly') or p_end < p_start then
    raise exception 'invalid: report period' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement and status = 'active' and placement_type is not null;
  if v_pl.id is null then
    return null;
  end if;
  select * into v_cfg from public.sales_report_config where placement_id = p_placement;
  select * into v_launch from public.placement_launch where placement_id = p_placement;
  if p_kind = 'weekly' and not coalesce(v_cfg.weekly_enabled, true) then
    return null;
  end if;
  if p_kind = 'daily' and not coalesce(v_cfg.daily_enabled, false) then
    return null;
  end if;
  if p_kind = 'biweekly' and not coalesce(v_cfg.biweekly_enabled, true) then
    return null;
  end if;
  v_first := not exists (
    select 1 from public.sales_report r
    where r.placement_id = p_placement and r.kind = 'weekly' and not r.test
  );
  if p_kind = 'weekly' and v_launch.deferred_period_start is not null and v_start > v_launch.deferred_period_start then
    v_start := v_launch.deferred_period_start;
  end if;
  select count(*) into v_workdays
  from generate_series(greatest(v_start, v_pl.start_date), p_end, interval '1 day') g
  where extract(isodow from g)::smallint = any (v_pl.working_days);
  if p_kind = 'weekly' and v_first and v_workdays < 3 and coalesce(v_launch.combine_short_week, true) then
    perform app.placement_launch_row(p_placement);
    update public.placement_launch
       set deferred_period_start = least(coalesce(deferred_period_start, greatest(v_start, v_pl.start_date)), greatest(v_start, v_pl.start_date)),
           updated_at = now()
     where placement_id = p_placement;
    return null;
  end if;
  select id into v_id from public.sales_report
  where placement_id = p_placement and kind = p_kind and period_start = v_start and period_end = p_end and not test;
  if v_id is not null then
    return v_id;
  end if;
  if exists (
    select 1 from public.sales_report_skip s
    where s.placement_id = p_placement and s.kind = p_kind and s.period_start = v_start and s.period_end = p_end
  ) then
    return null;
  end if;
  select count(*) into v_count from public.sales_eod e
  where e.placement_id = p_placement and e.submitted_at is not null
    and e.work_date between v_start and p_end
    and e.work_date >= v_pl.start_date;
  if v_count = 0 then
    insert into public.sales_report_skip (placement_id, kind, period_start, period_end)
    values (p_placement, p_kind, v_start, p_end)
    on conflict do nothing;
    perform app.so_staff_alert('report_empty', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, p_end,
      format('No report sent for %s. No EOD was submitted in that period.', v_start));
    return null;
  end if;
  select * into v_setting from public.team_setting where id = 1;
  -- A bi-weekly report always starts as a draft: the app writes the analysis,
  -- staff get 24 hours to hold or edit it, then it sends itself.
  v_approval := coalesce(v_cfg.require_approval, true) or (p_kind = 'weekly' and v_first) or p_kind = 'biweekly';
  insert into public.sales_report (
    placement_id, kind, period_start, period_end, status, approval_due_at, scheduled_for, summary, next_focus, auto_summary, auto_send_at
  ) values (
    p_placement, p_kind, v_start, p_end,
    case when v_approval then 'ready' else 'approved' end,
    case when p_kind = 'biweekly' then null when v_approval then now() + make_interval(hours => v_setting.report_approval_hours) else null end,
    case when v_approval then null else now() end,
    null, null, not v_approval,
    case when p_kind = 'biweekly' then now() + interval '24 hours' else null end
  ) returning id into v_id;
  if v_launch.deferred_period_start is not null then
    update public.placement_launch set deferred_period_start = null, updated_at = now() where placement_id = p_placement;
  end if;
  if not v_approval then
    v_summary := app.so_report_auto_summary(v_id);
    update public.sales_report set summary = v_summary, next_focus = 'Keep the current focus.' where id = v_id;
  else
    perform app.so_staff_alert('report_ready', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, p_end,
      case when p_kind = 'biweekly'
        then 'A bi-weekly client report is being drafted. It sends itself in 24 hours unless you hold it.'
        else format('A %s report is ready for review.', p_kind) end);
  end if;
  perform app.so_system_audit('workspace.report.opened', 'sales_report', v_id::text,
    format('Opened the %s report for %s to %s', p_kind, v_start, p_end),
    null, jsonb_build_object('status', (select status from public.sales_report where id = v_id), 'first', v_first), v_pl.case_file_id);
  return v_id;
end;
$$;

revoke all on function public.so_report_ensure(uuid, text, date, date) from public, anon, authenticated;
grant execute on function public.so_report_ensure(uuid, text, date, date) to service_role;

create or replace function app.so_report_client_json(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_client text;
  v_op text;
  v_manager text;
  v_keys text[] := array[]::text[];
  v_key text;
  v_headline jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
  v_outcomes jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
  v_wins jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_gaps jsonb := '[]'::jsonb;
  v_speed jsonb;
  v_results jsonb;
  v_note text;
  v_num jsonb;
  v_target numeric;
  v_metric public.activity_metric;
  v_out record;
  v_prev_start date;
  v_prev_end date;
  v_prev jsonb;
  v_day date;
  v_week_end date;
  v_week_start date;
  v_i integer;
  v_points integer;
  v_show jsonb;
  v_include_results boolean;
  v_eod_id uuid;
  v_text text;
  v_item jsonb;
begin
  select * into v_r from public.sales_report where id = p_report;
  if v_r.id is null then
    return null;
  end if;
  select * into v_pl from public.placement where id = v_r.placement_id;
  select * into v_cfg from public.sales_report_config where placement_id = v_pl.id;
  select c.name into v_client from public.client_case_file c where c.id = v_pl.case_file_id;
  select split_part(btrim(o.name), ' ', 1) into v_op from public.operator o where o.id = v_pl.operator_id;
  select coalesce(nullif(btrim(p.full_name), ''), 'Your manager') into v_manager
  from public.profile p where p.id = v_pl.manager_profile_id;
  v_include_results := v_pl.tracks_results and coalesce(v_cfg.include_results, true);

  if 'outbound_calling' = any (v_pl.activity_categories) then
    v_keys := v_keys || array['conversations_held', 'dials_made', 'connects'];
  end if;
  if 'follow_up' = any (v_pl.activity_categories) then
    v_keys := v_keys || array['texts_sent', 'replies_received'];
  end if;
  if 'reactivation' = any (v_pl.activity_categories) then
    v_keys := v_keys || array['reactivation_responses', 'reactivated_bookings'];
  end if;
  if v_include_results then
    v_keys := v_keys || array['show_rate', 'closes'];
  end if;

  foreach v_key in array v_keys loop
    exit when jsonb_array_length(v_headline) >= 5;
    if v_key = 'positive_outcomes' then
      continue;
    end if;
    v_num := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, v_key, null, false);
    v_target := app.so_client_target(v_pl.id, v_key, v_r.period_end, v_r.kind, v_r.period_start, v_r.period_end);
    if v_num is null and v_target is null then
      continue;
    end if;
    select * into v_metric from public.activity_metric where key = v_key;
    v_headline := v_headline || jsonb_build_array(jsonb_build_object(
      'key', v_key,
      'label', v_metric.label,
      'value', v_num -> 'value',
      'target', v_target,
      'pace', app.so_pace((v_num ->> 'value')::numeric, v_target),
      'reported', coalesce((v_num ->> 'reported')::boolean, false)
    ));
  end loop;

  v_prev_end := v_r.period_start - 1;
  v_prev_start := v_prev_end - (v_r.period_end - v_r.period_start);
  for v_out in
    select o.id, o.name from public.placement_outcome_type o
    where o.placement_id = v_pl.id and o.active
    order by o.sort_order, o.name
  loop
    v_num := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, 'positive_outcomes', v_out.id, false);
    v_prev := app.so_client_metric(v_pl.id, v_prev_start, v_prev_end, 'positive_outcomes', v_out.id, false);
    if v_num is null and v_prev is null then
      continue;
    end if;
    v_outcomes := v_outcomes || jsonb_build_array(jsonb_build_object(
      'name', v_out.name,
      'value', v_num -> 'value',
      'previous', v_prev -> 'value',
      'reported', coalesce((v_num ->> 'reported')::boolean, false)
    ));
  end loop;

  for v_metric in
    select * from public.activity_metric m
    where m.active and m.key <> 'positive_outcomes'
      and (
        (m.category = 'outbound' and 'outbound_calling' = any (v_pl.activity_categories))
        or (m.category = 'follow_up' and 'follow_up' = any (v_pl.activity_categories))
        or (m.category = 'reactivation' and 'reactivation' = any (v_pl.activity_categories))
      )
      and (v_include_results or m.category <> 'results')
    order by m.sort_order
  loop
    v_num := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, v_metric.key, null, v_metric.by_outcome);
    v_target := app.so_client_target(v_pl.id, v_metric.key, v_r.period_end, v_r.kind, v_r.period_start, v_r.period_end);
    if v_num is null and v_target is null then
      continue;
    end if;
    v_activity := v_activity || jsonb_build_array(jsonb_build_object(
      'category', v_metric.category,
      'label', v_metric.label,
      'value', v_num -> 'value',
      'target', v_target,
      'reported', coalesce((v_num ->> 'reported')::boolean, false)
    ));
  end loop;

  if coalesce(v_cfg.include_speed, true) then
    v_num := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, 'speed_to_lead_seconds', null, false);
    select jsonb_build_object(
      'median', v_num -> 'value',
      'leads', count(*),
      'not_touched', count(*) filter (where l.state = 'not_touched'),
      'reported', coalesce((v_num ->> 'reported')::boolean, false)
    ) into v_speed
    from public.sales_ghl_lead l
    where l.placement_id = v_pl.id
      and (l.created_at at time zone v_pl.time_zone)::date between v_r.period_start and v_r.period_end;
    if v_speed is null or ((v_speed ->> 'leads')::integer = 0 and v_num is null) then
      v_speed := case when v_num is null then null else jsonb_build_object(
        'median', v_num -> 'value', 'leads', 0, 'not_touched', 0,
        'reported', coalesce((v_num ->> 'reported')::boolean, false)
      ) end;
    end if;
  end if;

  if v_include_results then
    select count(*) into v_points
    from public.activity_day d
    where d.placement_id = v_pl.id and d.work_date between v_r.period_start and v_r.period_end
      and app.so_client_metric(v_pl.id, d.work_date, d.work_date, 'show_rate', null, false) is not null;
    if v_r.kind in ('weekly', 'biweekly') and v_points < 3 then
      v_show := app.so_client_metric(v_pl.id, v_r.period_end - 29, v_r.period_end, 'show_rate', null, false);
      v_note := case when v_r.kind = 'biweekly'
        then 'Show rate uses the last 30 days. These two weeks are too small to read on their own.'
        else 'Show rate uses the last 30 days. This week is too small to read on its own.' end;
    else
      v_show := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, 'show_rate', null, false);
      v_note := null;
    end if;
    v_num := app.so_client_metric(v_pl.id, v_r.period_start, v_r.period_end, 'closes', null, false);
    v_results := jsonb_build_object(
      'show_rate', v_show -> 'value',
      'show_reported', coalesce((v_show ->> 'reported')::boolean, false),
      'closes', v_num -> 'value',
      'closes_reported', coalesce((v_num ->> 'reported')::boolean, false),
      'window', case when v_note is null then 'period' else '30_days' end
    );
  end if;

  if v_r.kind in ('weekly', 'biweekly') then
    for v_i in reverse 3..0 loop
      v_week_end := v_r.period_end - (v_i * 7);
      v_week_start := v_week_end - 6;
      if not exists (
        select 1 from public.sales_eod e
        where e.placement_id = v_pl.id and e.submitted_at is not null
          and e.work_date between v_week_start and v_week_end
      ) then
        continue;
      end if;
      v_trend := v_trend || jsonb_build_array(jsonb_build_object(
        'start', v_week_start,
        'end', v_week_end,
        'conversations', app.so_client_metric(v_pl.id, v_week_start, v_week_end, 'conversations_held', null, false) -> 'value',
        'outcomes', app.so_client_metric(v_pl.id, v_week_start, v_week_end, 'positive_outcomes', null, true) -> 'value'
      ));
    end loop;
  end if;

  if cardinality(v_r.win_eod_ids) > 0 then
    for v_text in
      select btrim(e.wins) from public.sales_eod e
      where e.id = any (v_r.win_eod_ids) and e.placement_id = v_pl.id and btrim(coalesce(e.wins, '')) <> ''
      order by e.work_date
    loop
      v_wins := v_wins || jsonb_build_array(left(v_text, 2000));
    end loop;
  else
    for v_text in
      select btrim(e.wins) from public.sales_eod e
      where e.placement_id = v_pl.id and e.submitted_at is not null
        and e.work_date between v_r.period_start and v_r.period_end
        and btrim(coalesce(e.wins, '')) <> ''
      order by e.work_date desc
      limit 3
    loop
      v_wins := v_wins || jsonb_build_array(left(v_text, 2000));
    end loop;
  end if;

  if coalesce(v_cfg.include_plan, true) then
    select e.id, e.tomorrow_plan, e.plan_items into v_eod_id, v_text, v_item
    from public.sales_eod e
    where e.placement_id = v_pl.id and e.submitted_at is not null
      and e.work_date between v_r.period_start and v_r.period_end
    order by e.work_date desc
    limit 1;
    if v_text is not null and btrim(v_text) <> '' then
      v_plan := v_plan || jsonb_build_array(left(btrim(v_text), 2000));
    end if;
    if v_item is not null then
      for v_num in select value from jsonb_array_elements(v_item) loop
        if length(btrim(coalesce(v_num ->> 'text', ''))) > 0 then
          v_plan := v_plan || jsonb_build_array(left(btrim(v_num ->> 'text'), 500));
        end if;
      end loop;
    end if;
  end if;

  for v_day in
    select g::date from generate_series(v_r.period_start, v_r.period_end, interval '1 day') g
    where extract(isodow from g)::smallint = any (v_pl.working_days)
      and g::date >= v_pl.start_date
    order by 1
  loop
    if exists (select 1 from public.sales_excused_day x where x.placement_id = v_pl.id and x.work_date = v_day) then
      v_gaps := v_gaps || jsonb_build_array(jsonb_build_object('date', v_day, 'label', 'Scheduled day off'));
    elsif not exists (
      select 1 from public.sales_eod e
      where e.placement_id = v_pl.id and e.work_date = v_day and e.submitted_at is not null
    ) then
      v_gaps := v_gaps || jsonb_build_array(jsonb_build_object('date', v_day, 'label', 'No report submitted'));
    end if;
  end loop;

  return jsonb_build_object(
    'test', v_r.test,
    'kind', v_r.kind,
    'client', v_client,
    'operator', v_op,
    'role', 'Sales Operator',
    'manager', coalesce(v_manager, 'Your manager'),
    'period_start', v_r.period_start,
    'period_end', v_r.period_end,
    'headline', v_headline,
    'outcomes', v_outcomes,
    'activity', v_activity,
    'speed', v_speed,
    'results', v_results,
    'trend', v_trend,
    'wins', v_wins,
    'summary', nullif(btrim(coalesce(v_r.summary, '')), ''),
    'next_focus', nullif(btrim(coalesce(v_r.next_focus, '')), ''),
    'plan', v_plan,
    'gaps', v_gaps,
    'show_rate_note', v_note
  );
end;
$$;

revoke all on function app.so_report_client_json(uuid) from public, anon, authenticated;

create or replace function public.so_report_sweep()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_setting public.team_setting;
  v_local timestamp;
  v_dow integer;
  v_send_dow integer;
  v_back integer;
  v_send_date date;
  v_send_ts timestamptz;
  v_start date;
  v_end date;
  v_cur date;
  v_len integer;
  v_r public.sales_report;
  v_n integer := 0;
begin
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    perform app.so_require_team_staff();
  end if;
  perform set_config('app.report_sweep', 'on', true);
  select * into v_setting from public.team_setting where id = 1;
  for v_pl in
    select * from public.placement p where p.status = 'active' and p.placement_type is not null
  loop
    select * into v_cfg from public.sales_report_config where placement_id = v_pl.id;
    v_local := now() at time zone v_pl.time_zone;

    if coalesce(v_cfg.weekly_enabled, false) then
      v_dow := extract(isodow from v_local)::integer;
      v_send_dow := coalesce(v_cfg.send_dow, v_setting.report_weekly_dow);
      v_back := (v_dow - v_send_dow + 7) % 7;
      v_send_date := v_local::date - v_back;
      v_send_ts := (v_send_date + coalesce(v_cfg.send_time, v_setting.report_weekly_time)::time) at time zone v_pl.time_zone;
      if v_send_ts > now() then
        v_send_date := v_send_date - 7;
      end if;
      v_end := v_send_date - 1;
      v_start := v_end - 6;
      if public.so_report_ensure(v_pl.id, 'weekly', v_start, v_end) is not null then
        v_n := v_n + 1;
      end if;
    end if;

    -- Bi-weekly: the last completed 2-week pay period, opened from the send
    -- time on the Monday that starts the next period.
    if coalesce(v_cfg.biweekly_enabled, true) then
      select pp.period_start into v_cur from app.pay_period(v_local::date) pp;
      select pp.period_start, pp.period_days into v_start, v_len from app.pay_period(v_cur - 1) pp;
      v_send_ts := (v_cur + coalesce(v_cfg.send_time, v_setting.report_weekly_time)::time) at time zone v_pl.time_zone;
      if v_len = 14 and now() >= v_send_ts then
        if public.so_report_ensure(v_pl.id, 'biweekly', v_start, v_start + 13) is not null then
          v_n := v_n + 1;
        end if;
      end if;
    end if;
  end loop;

  for v_r in
    select * from public.sales_report r
    where r.status = 'ready' and r.approval_due_at is not null and r.approval_due_at <= now() and r.approval_alerted_at is null and not r.test
  loop
    select * into v_pl from public.placement where id = v_r.placement_id;
    perform app.so_staff_alert('report_approval_due', v_pl.operator_id, v_pl.id, null, v_r.period_end,
      format('The %s report for %s to %s was not approved within the window. It was not sent.', v_r.kind, v_r.period_start, v_r.period_end));
    update public.sales_report set approval_alerted_at = now(), updated_at = now() where id = v_r.id;
    insert into public.sales_delivery (report_id, placement_id, channel, destination, status, subject_type, subject_id, payload)
    values (v_r.id, v_r.placement_id, 'discord', 'escalations', 'retrying', 'report', v_r.id::text || ':approval',
      jsonb_build_object('text', format('Report not approved: %s to %s. It was not sent.', v_r.period_start, v_r.period_end)))
    on conflict (channel, destination, subject_type, subject_id) do nothing;
  end loop;

  -- Bi-weekly drafts send themselves once the 24-hour window is up, unless a
  -- person held them. A draft without its analysis or recipients is not sent;
  -- staff are told once.
  for v_r in
    select * from public.sales_report r
    where r.kind = 'biweekly' and r.status = 'ready' and not r.test
      and r.auto_send_at is not null and r.auto_send_at <= now()
  loop
    select * into v_pl from public.placement where id = v_r.placement_id;
    if length(btrim(coalesce(v_r.summary, ''))) < 1 or length(btrim(coalesce(v_r.next_focus, ''))) < 1
       or coalesce(cardinality(app.so_report_recipients(v_r.placement_id)), 0) < 1 then
      if v_r.approval_alerted_at is null then
        perform app.so_staff_alert('report_approval_due', v_pl.operator_id, v_pl.id, null, v_r.period_end,
          format('The bi-weekly report for %s to %s could not send itself: %s.', v_r.period_start, v_r.period_end,
            case when coalesce(cardinality(app.so_report_recipients(v_r.placement_id)), 0) < 1 then 'the seat has no report recipient'
                 else 'its analysis is not written yet' end));
        update public.sales_report set approval_alerted_at = now(), updated_at = now() where id = v_r.id;
      end if;
      continue;
    end if;
    update public.sales_report set
      status = 'approved',
      approved_at = now(),
      scheduled_for = now(),
      hold_note = null,
      updated_at = now()
    where id = v_r.id and status = 'ready';
    perform app.so_system_audit('workspace.report.auto_sent', 'sales_report', v_r.id::text,
      format('The bi-weekly report for %s to %s sent itself after 24 hours with no hold', v_r.period_start, v_r.period_end),
      null, null, v_pl.case_file_id);
  end loop;

  perform set_config('app.report_sweep', 'off', true);
  return v_n;
end;
$$;

-- What the app needs to analyse a bi-weekly report: the client view, each
-- working day's EOD, every metric as the operator reported it, as GoHighLevel
-- shows it and as verified, the mismatches, and the GoHighLevel link state.
-- Service role only; the analysis never goes to the client as-is.
create or replace function public.so_report_analysis_data(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_pl public.placement;
  v_link public.sales_ghl_link;
  v_prev_start date;
  v_prev_end date;
begin
  select * into v_r from public.sales_report where id = p_report;
  if v_r.id is null then
    return null;
  end if;
  select * into v_pl from public.placement where id = v_r.placement_id;
  select * into v_link from public.sales_ghl_link where placement_id = v_pl.id;
  v_prev_end := v_r.period_start - 1;
  v_prev_start := v_prev_end - (v_r.period_end - v_r.period_start);

  return jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_r.id, 'kind', v_r.kind, 'period_start', v_r.period_start, 'period_end', v_r.period_end,
      'status', v_r.status, 'auto_send_at', v_r.auto_send_at
    ),
    'client', app.so_report_client_json(v_r.id),
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'operator', (select o.name from public.operator o where o.id = v_pl.operator_id),
      'client', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'start_date', v_pl.start_date,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'categories', to_jsonb(v_pl.activity_categories),
      'tracks_results', v_pl.tracks_results
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', g.d,
        'status', coalesce(e.status, case when g.d < v_pl.start_date then 'before_start' else 'none' end),
        'submitted', e.submitted_at is not null,
        'late', coalesce(e.was_late, false),
        'excused', exists (select 1 from public.sales_excused_day x where x.placement_id = v_pl.id and x.work_date = g.d),
        'hours', e.hours_worked,
        'wins', left(coalesce(e.wins, ''), 1200),
        'blockers', left(coalesce(e.blockers, ''), 800),
        'plan', left(coalesce(e.tomorrow_plan, ''), 600),
        'needs_help', coalesce(e.needs_help, false)
      ) order by g.d)
      from (
        select gs::date as d from generate_series(v_r.period_start, v_r.period_end, interval '1 day') gs
        where extract(isodow from gs)::smallint = any (v_pl.working_days)
      ) g
      left join lateral (
        select * from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = g.d order by e.created_at desc limit 1
      ) e on true
    ), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(m order by (m ->> 'sort')::integer, m ->> 'label')
      from (
        select jsonb_build_object(
          'key', am.key,
          'label', am.label,
          'unit', am.unit,
          'source', am.source,
          'sort', am.sort_order,
          'operator', (select sum(v.value) from public.activity_value v join public.activity_day d on d.id = v.activity_day_id
                       where d.placement_id = v_pl.id and d.work_date between v_r.period_start and v_r.period_end
                         and v.metric_key = am.key and v.source = 'operator'),
          'ghl', (select sum(v.value) from public.activity_value v join public.activity_day d on d.id = v.activity_day_id
                  where d.placement_id = v_pl.id and d.work_date between v_r.period_start and v_r.period_end
                    and v.metric_key = am.key and v.source = 'ghl'),
          'verified', (select sum(v.value) from public.activity_verified v join public.activity_day d on d.id = v.activity_day_id
                       where d.placement_id = v_pl.id and d.work_date between v_r.period_start and v_r.period_end
                         and v.metric_key = am.key and v.basis = 'ghl'),
          'previous', (select sum(v.value) from public.activity_value v join public.activity_day d on d.id = v.activity_day_id
                       where d.placement_id = v_pl.id and d.work_date between v_prev_start and v_prev_end
                         and v.metric_key = am.key and v.source = 'operator'),
          'target', app.so_client_target(v_pl.id, am.key, v_r.period_end, v_r.kind, v_r.period_start, v_r.period_end)
        ) as m
        from public.activity_metric am
        where am.active
          and exists (
            select 1 from public.activity_value v join public.activity_day d on d.id = v.activity_day_id
            where d.placement_id = v_pl.id and d.work_date between v_prev_start and v_r.period_end and v.metric_key = am.key
          )
      ) x
    ), '[]'::jsonb),
    'mismatches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', mm.work_date,
        'metric', am.label,
        'outcome', ot.name,
        'operator', mm.operator_value,
        'ghl', mm.ghl_value,
        'gap', mm.gap,
        'status', mm.status,
        'decision', mm.decision
      ) order by mm.work_date, am.sort_order)
      from public.activity_mismatch mm
      join public.activity_metric am on am.key = mm.metric_key
      left join public.placement_outcome_type ot on ot.id = mm.outcome_type_id
      where mm.placement_id = v_pl.id and mm.work_date between v_r.period_start and v_r.period_end
    ), '[]'::jsonb),
    'ghl', jsonb_build_object(
      'linked', v_link.placement_id is not null and v_link.disconnected_at is null and v_link.ghl_user_id is not null,
      'status', v_link.status,
      'last_success_at', v_link.last_success_at,
      'last_error', v_link.last_error,
      'synced_days', (select count(*) from public.sales_ghl_day sd
                      where sd.placement_id = v_pl.id and sd.work_date between v_r.period_start and v_r.period_end
                        and cardinality(sd.complete_metrics) > 0)
    ),
    'staff_emails', (
      select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
      from (
        select lower(btrim(x)) as e
        from public.sales_report_config c, unnest(coalesce(c.extra_cc, '{}')) x
        where c.placement_id = v_pl.id
        union
        select lower(btrim(p.email)) from public.profile p where p.id = v_pl.manager_profile_id
      ) s
      where e like '%@%'
    )
  );
end;
$$;

-- Save the app's analysis on a bi-weekly draft. Only while it is still a
-- draft, so a person's edit or hold is never overwritten.
create or replace function public.so_report_save_analysis(
  p_report uuid,
  p_summary text,
  p_next_focus text,
  p_analysis jsonb,
  p_integrity jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.sales_report set
    summary = case when summary is null or btrim(summary) = '' then nullif(btrim(coalesce(p_summary, '')), '') else summary end,
    next_focus = case when next_focus is null or btrim(next_focus) = '' then nullif(btrim(coalesce(p_next_focus, '')), '') else next_focus end,
    analysis = p_analysis,
    integrity = p_integrity,
    analyzed_at = now(),
    updated_at = now()
  where id = p_report and kind = 'biweekly' and status = 'ready';
  return found;
end;
$$;

-- Bi-weekly drafts that still need their analysis, or their draft email to staff.
create or replace function public.so_report_biweekly_due(p_limit integer default 5)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'analyzed', r.analyzed_at is not null, 'draft_sent', r.draft_sent_at is not null)), '[]'::jsonb)
  from (
    select * from public.sales_report r
    where r.kind = 'biweekly' and r.status = 'ready' and not r.test
      and (r.analyzed_at is null or r.draft_sent_at is null)
    order by r.created_at
    limit greatest(coalesce(p_limit, 5), 1)
  ) r;
$$;

create or replace function public.so_report_mark_draft_sent(p_report uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.sales_report set draft_sent_at = now(), updated_at = now() where id = p_report and draft_sent_at is null;
$$;

revoke all on function public.so_report_sweep() from public, anon;
grant execute on function public.so_report_sweep() to authenticated, service_role;
revoke all on function public.so_report_analysis_data(uuid) from public, anon, authenticated;
revoke all on function public.so_report_save_analysis(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.so_report_biweekly_due(integer) from public, anon, authenticated;
revoke all on function public.so_report_mark_draft_sent(uuid) from public, anon, authenticated;
grant execute on function public.so_report_analysis_data(uuid) to service_role;
grant execute on function public.so_report_save_analysis(uuid, text, text, jsonb, jsonb) to service_role;
grant execute on function public.so_report_biweekly_due(integer) to service_role;
grant execute on function public.so_report_mark_draft_sent(uuid) to service_role;
