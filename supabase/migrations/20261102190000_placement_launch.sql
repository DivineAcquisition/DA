-- Launch layer for every placement: checklist gates, health checks, first week,
-- launch summaries, the first client report, and the 30-day review.

create table public.placement_launch (
  placement_id uuid primary key references public.placement (id) on delete cascade,
  summary_enabled boolean not null default true,
  summary_days smallint not null default 5 check (summary_days in (5, 10)),
  combine_short_week boolean not null default true,
  test_report_at timestamptz,
  test_report_by uuid,
  intro_not_needed boolean not null default false,
  intro_not_needed_by uuid,
  intro_not_needed_at timestamptz,
  deferred_period_start date,
  updated_at timestamptz not null default now()
);

create table public.placement_launch_confirm (
  placement_id uuid not null references public.placement (id) on delete cascade,
  item text not null,
  confirmed_by uuid,
  confirmed_at timestamptz not null default now(),
  primary key (placement_id, item)
);

create table public.placement_health_check (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  ran_at timestamptz not null default now(),
  work_date date not null,
  source text not null check (source in ('manual', 'auto')),
  overall text not null check (overall in ('pass', 'warn', 'fail')),
  results jsonb not null,
  ran_by uuid
);

create index placement_health_recent_idx on public.placement_health_check (placement_id, ran_at desc);

create table public.placement_launch_review (
  placement_id uuid primary key references public.placement (id) on delete cascade,
  decision text not null check (decision in ('keep', 'adjust', 'coach', 'escalate')),
  note text not null,
  decided_by uuid,
  decided_at timestamptz not null default now()
);

alter table public.activity_mismatch
  add column if not exists first_week boolean not null default false,
  add column if not exists setup_resolved_at timestamptz,
  add column if not exists setup_resolved_by uuid;

comment on table public.placement_launch is
  'Launch settings for one placement. Summaries default on for five working days. A short first week is combined with the next week.';
comment on column public.activity_mismatch.first_week is
  'The mismatch fell in the launch window. DA Admin can resolve it as a setup issue.';

alter table public.placement_launch enable row level security;
alter table public.placement_launch_confirm enable row level security;
alter table public.placement_health_check enable row level security;
alter table public.placement_launch_review enable row level security;

revoke all on public.placement_launch from anon, authenticated;
revoke all on public.placement_launch_confirm from anon, authenticated;
revoke all on public.placement_health_check from anon, authenticated;
revoke all on public.placement_launch_review from anon, authenticated;

grant select, insert, update, delete on public.placement_launch to service_role;
grant select, insert, update, delete on public.placement_launch_confirm to service_role;
grant select, insert, update, delete on public.placement_health_check to service_role;
grant select, insert, update, delete on public.placement_launch_review to service_role;

alter table public.workspace_alert drop constraint if exists workspace_alert_kind_chk;
alter table public.workspace_alert
  add constraint workspace_alert_kind_chk
    check (kind in (
      'cert_grace', 'placement_review',
      'eod_submitted', 'eod_needs_help', 'eod_late', 'eod_manager', 'eod_missed',
      'eod_escalated', 'eod_edited', 'eod_feedback', 'ghl_sync',
      'report_ready', 'report_sent', 'report_held', 'report_approval_due',
      'report_failed', 'report_empty', 'client_feedback', 'client_feedback_low',
      'launch_health', 'launch_targets', 'launch_review'
    ));

create unique index if not exists workspace_alert_launch_targets_once
  on public.workspace_alert (placement_id) where kind = 'launch_targets';
create unique index if not exists workspace_alert_launch_review_once
  on public.workspace_alert (placement_id) where kind = 'launch_review';

-- Working-day number, counting from the start date. Null when the date is not a working day.
create or replace function app.placement_workday_number(p public.placement, p_day date)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := p.start_date;
  v_n integer := 0;
  v_guard integer := 0;
begin
  if p_day is null or p.start_date is null or p_day < p.start_date then
    return null;
  end if;
  while v_day <= p_day and v_guard < 400 loop
    if extract(isodow from v_day)::smallint = any (p.working_days) then
      v_n := v_n + 1;
      if v_day = p_day then
        return v_n;
      end if;
    end if;
    v_day := v_day + 1;
    v_guard := v_guard + 1;
  end loop;
  return null;
end;
$$;

create or replace function app.placement_days_elapsed(p public.placement, p_day date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p.start_date, p_day, interval '1 day') g
  where extract(isodow from g)::smallint = any (p.working_days);
$$;

create or replace function app.placement_launch_row(p_placement uuid)
returns public.placement_launch
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.placement_launch;
begin
  insert into public.placement_launch (placement_id) values (p_placement)
  on conflict (placement_id) do nothing;
  select * into v from public.placement_launch where placement_id = p_placement;
  return v;
end;
$$;

-- Checklist. blocking stops activation. open is what the list counts.
-- two_days items turn red after the second working day and do not block activation.
create or replace function app.placement_checklist(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_w public.placement_wizard;
  v_launch public.placement_launch;
  v_offer jsonb := '{}'::jsonb;
  v_map jsonb := '{}'::jsonb;
  v_stage text;
  v_role text;
  v_profile uuid;
  v_ready boolean;
  v_agreement boolean;
  v_cert boolean;
  v_offer_ok boolean;
  v_recipients integer := 0;
  v_outcomes integer := 0;
  v_mapped integer := 0;
  v_today date;
  v_elapsed integer := 0;
  v_href text;
  v_op text;
  v_items jsonb := '[]'::jsonb;
  v_intro boolean;
begin
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    return '[]'::jsonb;
  end if;
  select * into v_w from public.placement_wizard where placement_id = p_placement;
  select * into v_launch from public.placement_launch where placement_id = p_placement;
  select o.profile_id, j.stage into v_profile, v_stage
  from public.operator o
  left join public.operator_journey j on j.operator_id = o.id
  where o.id = v_pl.operator_id;
  v_offer := coalesce(v_w.payload -> 'offer', '{}'::jsonb);
  v_today := (now() at time zone v_pl.time_zone)::date;
  v_elapsed := coalesce(app.placement_days_elapsed(v_pl, v_today), 0);
  v_href := '/workspace/sales-ops/placements/' || p_placement::text;
  v_op := '/workspace/team/workspace/operators/' || v_pl.operator_id::text;
  v_ready := app.hire_ready(v_pl.operator_id)
    or (v_stage in ('placed', 'paused') and v_pl.status in ('active', 'paused', 'scheduled', 'ended'))
    or (v_stage is null and v_pl.status <> 'draft');
  v_agreement := (v_stage is null and v_pl.status <> 'draft') or app.hire_agreement_signed(v_pl.operator_id);
  v_cert := (v_stage is null and v_pl.status <> 'draft')
    or coalesce(app.cert_override_access(v_pl.operator_id), false)
    or (v_profile is not null and coalesce(app.so_certification_level(v_profile), 0) >= 1);
  v_offer_ok := length(btrim(coalesce(v_offer ->> 'one_liner', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'service_area', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'ideal_customer', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'booking_rules', ''))) > 0
    and length(btrim(coalesce(v_offer ->> 'never', ''))) > 0;
  if not v_offer_ok and v_w.id is null and nullif(btrim(coalesce(v_pl.campaign_summary, '')), '') is not null then
    v_offer_ok := true;
  end if;
  select count(*) into v_outcomes from public.placement_outcome_type o where o.placement_id = p_placement and o.active;
  select coalesce(cardinality(c.recipient_emails) + cardinality(c.extra_emails), 0) into v_recipients
  from public.sales_report_config c where c.placement_id = p_placement;
  v_recipients := coalesce(v_recipients, 0);
  select l.mapping into v_map from public.sales_ghl_link l where l.placement_id = p_placement;
  v_map := coalesce(v_map, '{}'::jsonb);
  if jsonb_typeof(v_map -> 'outcomes') = 'array' then
    select count(*) into v_mapped from jsonb_array_elements(v_map -> 'outcomes') item
    where nullif(item ->> 'calendar_id', '') is not null or nullif(item ->> 'stage_id', '') is not null;
  end if;
  v_intro := coalesce(v_launch.intro_not_needed, false)
    or coalesce(v_w.payload #>> '{reporting,intro}', 'activation') = 'none'
    or exists (
      select 1 from public.email_log e
      where e.placement_id = p_placement and e.template = 'client.operator_introduction'
        and e.status in ('sent', 'delivered', 'queued', 'delayed')
    )
    or exists (
      select 1 from public.placement_mail_job j
      where j.placement_id = p_placement and j.kind = 'client.operator_introduction' and j.sent_at is not null
    );

  v_items := jsonb_build_array(
    jsonb_build_object('key', 'readiness', 'gate', 'activation', 'automatic', true,
      'label', 'Operator readiness is complete.',
      'fix', 'Finish the readiness checklist, or have DA Admin waive it with a reason.',
      'href', v_op, 'met', v_ready),
    jsonb_build_object('key', 'agreement', 'gate', 'activation', 'automatic', true,
      'label', 'The operator agreement is signed.',
      'fix', 'The operator signs the agreement, or DA Admin waives it with a reason.',
      'href', v_op, 'met', v_agreement),
    jsonb_build_object('key', 'certification', 'gate', 'activation', 'automatic', true,
      'label', 'Certification is current, or an override is active.',
      'fix', 'Finish Academy Level 1, or ask DA Admin for an override.',
      'href', v_op, 'met', v_cert),
    jsonb_build_object('key', 'schedule', 'gate', 'activation', 'automatic', true,
      'label', 'Schedule is complete: time zone, working days, shift, and EOD deadline.',
      'fix', 'Set the time zone, at least one working day, the shift, and the EOD deadline.',
      'href', v_href || '?tab=schedule',
      'met', v_pl.time_zone is not null and cardinality(v_pl.working_days) > 0
        and v_pl.shift_start is not null and v_pl.shift_end is not null
        and coalesce(v_pl.eod_deadline, v_pl.shift_end) is not null
        and (v_w.id is null or coalesce((v_w.payload ->> 'schedule_confirmed')::boolean, false) or v_pl.status <> 'draft')),
    jsonb_build_object('key', 'outcomes', 'gate', 'activation', 'automatic', true,
      'label', 'At least one positive outcome is defined.',
      'fix', 'Add one positive outcome and what counts as that win.',
      'href', v_href || '?tab=schedule', 'met', v_outcomes > 0),
    jsonb_build_object('key', 'offer', 'gate', 'activation', 'automatic', true,
      'label', 'The offer brief has its required fields.',
      'fix', 'Write the business line, service area, ideal customer, booking rules, and what never to do.',
      'href', v_href || '?tab=offer', 'met', v_offer_ok),
    jsonb_build_object('key', 'recipients', 'gate', 'activation', 'automatic', true,
      'label', 'At least one client report recipient is chosen.',
      'fix', 'Pick a contact on the client, or add an extra recipient.',
      'href', v_href || '?tab=reporting', 'met', v_recipients > 0),
    jsonb_build_object('key', 'ghl_test', 'gate', 'activation', 'automatic', true,
      'label', 'The GHL connection test passed.',
      'fix', 'DA Admin runs Test connection on the GHL step until the sub-account answers.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.ghl_connection c
        where c.case_file_id = v_pl.case_file_id and c.retired_at is null and c.replaces_id is null
          and c.level = 'location' and c.status = 'healthy' and c.last_success_at is not null
      )),
    jsonb_build_object('key', 'ghl_user', 'gate', 'activation', 'automatic', true,
      'label', 'The operator''s GHL user is mapped.',
      'fix', 'Choose the operator''s own user in the client sub-account.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.sales_ghl_link l
        where l.placement_id = p_placement and nullif(btrim(coalesce(l.ghl_user_id, '')), '') is not null
      )),
    jsonb_build_object('key', 'ghl_signin', 'gate', 'activation', 'automatic', false,
      'label', 'The operator confirmed they can sign in to this client''s GHL with their own user.',
      'fix', 'The operator opens their workspace and confirms the GHL sign-in.',
      'href', '/workspace/operator/workspace',
      'met', exists (
        select 1 from public.placement_ghl_readiness r
        where r.operator_id = v_pl.operator_id and r.client_case_file_id = v_pl.case_file_id
          and r.operator_confirmed_at is not null
      ) or exists (
        select 1 from public.placement_launch_confirm c
        where c.placement_id = p_placement and c.item = 'ghl_signin'
      )),
    jsonb_build_object('key', 'one_active', 'gate', 'activation', 'automatic', true,
      'label', 'This operator does not already have another open placement.',
      'fix', 'Pause or end the other open placement before this one is activated.',
      'href', v_op,
      'met', not exists (
        select 1 from public.placement other
        where other.operator_id = v_pl.operator_id and other.id <> v_pl.id and other.status in ('active', 'scheduled')
      )),
    jsonb_build_object('key', 'outcome_mapping', 'gate', 'two_days', 'automatic', true,
      'label', 'Every positive outcome is mapped in GHL.',
      'fix', 'Map each outcome to a calendar or stage. This is due within two working days.',
      'href', v_href || '?tab=ghl', 'met', v_outcomes > 0 and v_mapped >= v_outcomes),
    jsonb_build_object('key', 'speed', 'gate', 'two_days', 'automatic', true,
      'label', 'Speed-to-lead leads are mapped.',
      'fix', 'Choose the leads used for speed-to-lead. This is due within two working days.',
      'href', v_href || '?tab=ghl',
      'met', jsonb_typeof(v_map #> '{speed,ids}') = 'array' and jsonb_array_length(v_map #> '{speed,ids}') > 0),
    jsonb_build_object('key', 'first_sync', 'gate', 'two_days', 'automatic', true,
      'label', 'The first sync returned real activity for this operator.',
      'fix', 'Wait for the next GHL sync, or confirm the operator''s user is the one placing calls and texts.',
      'href', v_href || '?tab=ghl',
      'met', exists (
        select 1 from public.activity_value val
        join public.activity_day d on d.id = val.activity_day_id
        where d.placement_id = p_placement and val.source = 'ghl' and val.value > 0
          and val.metric_key in ('dials_made', 'texts_sent', 'emails_sent', 'conversations_held', 'connects')
      )),
    jsonb_build_object('key', 'first_eod', 'gate', 'two_days', 'automatic', true,
      'label', 'The first EOD is submitted.',
      'fix', 'The operator submits an end of day.',
      'href', '/workspace/team/workspace/eods',
      'met', exists (
        select 1 from public.sales_eod e where e.placement_id = p_placement and e.submitted_at is not null
      )),
    jsonb_build_object('key', 'test_report', 'gate', 'first_report', 'automatic', false,
      'label', 'The manager sent a test report to themselves and reviewed it.',
      'fix', 'Send a test report from Client reporting, then confirm you reviewed it.',
      'href', v_href || '?tab=reporting',
      'met', v_launch.test_report_at is not null or exists (
        select 1 from public.sales_report r where r.placement_id = p_placement and r.test
      )),
    jsonb_build_object('key', 'introduction', 'gate', 'first_report', 'automatic', true,
      'label', 'The client introduction was sent, or marked not needed.',
      'fix', 'Send the introduction from the reporting step, or mark it not needed.',
      'href', v_href || '?tab=reporting', 'met', v_intro)
  );
  if 'reactivation' = any (v_pl.activity_categories) then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'key', 'reactivation', 'gate', 'two_days', 'automatic', true,
      'label', 'The reactivation list is mapped.',
      'fix', 'Map the reactivation list. This is due within two working days.',
      'href', v_href || '?tab=ghl',
      'met', jsonb_typeof(v_map #> '{reactivation,ids}') = 'array' and jsonb_array_length(v_map #> '{reactivation,ids}') > 0
    ));
  end if;

  return coalesce((
    select jsonb_agg(
      item || jsonb_build_object(
        'waived', w.reason is not null,
        'waiver_reason', w.reason,
        'overdue', (item ->> 'gate') = 'two_days' and coalesce((item ->> 'met')::boolean, false) = false and w.reason is null and v_elapsed > 2,
        'blocking', (item ->> 'gate') = 'activation' and coalesce((item ->> 'met')::boolean, false) = false and w.reason is null,
        'open', coalesce((item ->> 'met')::boolean, false) = false and w.reason is null and (
          (item ->> 'gate') = 'activation'
          or ((item ->> 'gate') = 'two_days' and v_elapsed > 2)
          or ((item ->> 'gate') = 'first_report' and v_pl.status in ('active', 'paused', 'scheduled'))
        ),
        'checked_at', conf.confirmed_at,
        'checked_by', coalesce(nullif(btrim(pr.full_name), ''), pr.email)
      )
      order by item ->> 'key')
    from jsonb_array_elements(v_items) item
    left join public.placement_launch_waiver w on w.placement_id = p_placement and w.item = item ->> 'key'
    left join public.placement_launch_confirm conf on conf.placement_id = p_placement and conf.item = item ->> 'key'
    left join public.profile pr on pr.id = conf.confirmed_by
  ), '[]'::jsonb);
end;
$$;

create or replace function app.placement_open_count(p_placement uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from jsonb_array_elements(app.placement_checklist(p_placement)) item
  where coalesce((item ->> 'open')::boolean, false);
$$;

-- Health check. Reads live rows only. Writes nothing except when the run function stores the result.
create or replace function app.placement_health_results(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_profile uuid;
  v_stage text;
  v_role text;
  v_status text;
  v_interval integer;
  v_last timestamptz;
  v_healthy boolean;
  v_today date;
  v_prev date;
  v_elapsed integer;
  v_eod public.sales_eod;
  v_deadline timestamptz;
  v_bounced integer;
  v_delivered integer;
  v_stray integer;
  v_recipients integer;
  v_mismatches integer;
  v_outcome_gap integer;
  v_items jsonb := '[]'::jsonb;
  v_result text;
  v_reason text;
begin
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    return '[]'::jsonb;
  end if;
  select o.profile_id, o.status::text, j.stage, coalesce(j.role_kind, 'sales_operator')
    into v_profile, v_status, v_stage, v_role
  from public.operator o
  left join public.operator_journey j on j.operator_id = o.id
  where o.id = v_pl.operator_id;
  v_today := app.so_work_date(v_pl, now());
  v_prev := app.so_previous_work_date(v_pl, v_today);
  v_elapsed := coalesce(app.placement_days_elapsed(v_pl, (now() at time zone v_pl.time_zone)::date), 0);
  select ghl_sync_interval_minutes into v_interval from public.team_setting where id = 1;
  v_interval := coalesce(v_interval, 15);

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'access', 'area', 'Access', 'admin_only', false,
    'result', case
      when v_profile is not null and app.effective_state(v_profile) = 'active'
        and (v_stage = 'placed' or v_status = 'placed')
        and (coalesce(app.so_certification_level(v_profile), 0) >= 1 or coalesce(app.cert_override_access(v_pl.operator_id), false))
      then 'pass' else 'fail' end,
    'reason', case
      when v_profile is null then 'The operator has no account yet.'
      when app.effective_state(v_profile) is distinct from 'active' then 'The account is not active.'
      when v_stage is distinct from 'placed' and v_status is distinct from 'placed' then 'The stage is not Placed.'
      when coalesce(app.so_certification_level(v_profile), 0) < 1 and not coalesce(app.cert_override_access(v_pl.operator_id), false) then 'Certification is missing and there is no active override.'
      else 'The operator can open the workspace.'
    end
  ));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'navigation', 'area', 'Access', 'admin_only', false,
    'result', case when v_role = 'sales_operator' then 'pass' else 'fail' end,
    'reason', case when v_role = 'sales_operator' then 'Navigation is the sales operator navigation.' else 'This account is still on VA navigation.' end
  ));

  select c.status = 'healthy' and c.last_success_at is not null, l.last_success_at
    into v_healthy, v_last
  from public.placement pl
  left join public.ghl_connection c on c.case_file_id = pl.case_file_id and c.retired_at is null and c.replaces_id is null and c.level = 'location'
  left join public.sales_ghl_link l on l.placement_id = pl.id
  where pl.id = p_placement
  limit 1;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'ghl_sync', 'area', 'Data', 'admin_only', false,
    'result', case
      when coalesce(v_healthy, false) and v_last is not null and v_last >= now() - make_interval(mins => v_interval * 2) then 'pass'
      when coalesce(v_healthy, false) then 'warn'
      else 'fail' end,
    'reason', case
      when not coalesce(v_healthy, false) then 'The GHL connection is not healthy.'
      when v_last is null then 'GHL has not synced yet.'
      when v_last < now() - make_interval(mins => v_interval * 2) then 'The last sync is older than two sync intervals.'
      else 'The last sync is inside two sync intervals.'
    end
  ));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'activity', 'area', 'Data', 'admin_only', false,
    'result', case
      when exists (
        select 1 from public.activity_value val
        join public.activity_day d on d.id = val.activity_day_id
        where d.placement_id = p_placement and d.work_date = v_prev and val.source = 'ghl' and val.value > 0
          and val.metric_key in ('dials_made', 'texts_sent', 'emails_sent', 'conversations_held', 'connects')
      ) then 'pass'
      when v_elapsed <= 1 then 'warn'
      else 'fail' end,
    'reason', case
      when exists (
        select 1 from public.activity_value val
        join public.activity_day d on d.id = val.activity_day_id
        where d.placement_id = p_placement and d.work_date = v_prev and val.source = 'ghl' and val.value > 0
          and val.metric_key in ('dials_made', 'texts_sent', 'emails_sent', 'conversations_held', 'connects')
      ) then 'GHL activity arrived on the last working day.'
      when v_elapsed <= 1 then 'The first working day is still open, so there is no finished day of activity yet.'
      else 'No call, text, or email from this operator''s GHL user on the last working day.' end
  ));

  select count(*) into v_outcome_gap
  from public.placement_outcome_type o
  where o.placement_id = p_placement and o.active
    and not exists (
      select 1 from public.activity_value val
      join public.activity_day d on d.id = val.activity_day_id
      where d.placement_id = p_placement and val.outcome_type_id = o.id and val.value > 0
        and d.work_date >= v_today - 14
    );
  v_result := case
    when v_outcome_gap = 0 then 'pass'
    when v_elapsed <= 5 then 'warn'
    else 'fail' end;
  v_reason := case
    when v_outcome_gap = 0 then 'Each mapped outcome has a result in the recent working days.'
    when v_elapsed <= 5 then v_outcome_gap::text || ' outcome(s) have no result yet. That is a warning in week one.'
    else v_outcome_gap::text || ' outcome(s) have no result in the recent working days.'
  end;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'outcomes', 'area', 'Data', 'admin_only', false, 'result', v_result, 'reason', v_reason
  ));
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'automation', 'area', 'Data', 'admin_only', false,
    'result', case when exists (
      select 1 from public.sales_ghl_evidence e
      where e.placement_id = p_placement and e.ghl_type ~* 'workflow|automation|campaign|bulk'
    ) then 'fail' else 'pass' end,
    'reason', case when exists (
      select 1 from public.sales_ghl_evidence e
      where e.placement_id = p_placement and e.ghl_type ~* 'workflow|automation|campaign|bulk'
    ) then 'An automation message was stored in the count.' else 'Workflow and automation messages are dropped before they are counted.' end
  ));

  select * into v_eod from public.sales_eod where placement_id = p_placement and work_date = v_today;
  v_deadline := app.so_eod_deadline(v_pl, v_today);
  if extract(isodow from v_today)::smallint <> all (v_pl.working_days) then
    v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'eod_today', 'area', 'EOD', 'admin_only', false, 'result', 'pass', 'reason', 'Today is not a working day.'));
  elsif v_eod.id is null then
    v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'eod_today', 'area', 'EOD', 'admin_only', false, 'result', 'fail', 'reason', 'Today''s EOD has not been opened.'));
  elsif v_eod.deadline_at is distinct from v_deadline then
    v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'eod_today', 'area', 'EOD', 'admin_only', false, 'result', 'warn', 'reason', 'Today''s EOD deadline does not match the placement clock.'));
  else
    v_items := v_items || jsonb_build_array(jsonb_build_object('key', 'eod_today', 'area', 'EOD', 'admin_only', false, 'result', 'pass', 'reason', 'Today''s EOD exists and the deadline matches the shift.'));
  end if;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'eod_steps', 'area', 'EOD', 'admin_only', false,
    'result', case when exists (
      select 1 from public.team_setting s
      where s.eod_reminder_minutes_before is not null and s.eod_late_minutes_after is not null
        and s.eod_manager_alert_minutes_after is not null and s.eod_missed_rule is not null
    ) then 'pass' else 'fail' end,
    'reason', 'Reminder, late, manager alert, and missed steps use the workspace clock.'
  ));

  select count(*) filter (where status = 'bounced'),
         count(*) filter (where status in ('delivered', 'sent'))
    into v_bounced, v_delivered
  from public.email_log
  where operator_id = v_pl.operator_id and created_at > now() - interval '14 days';
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'email_delivery', 'area', 'Email', 'admin_only', false,
    'result', case when v_bounced > 0 then 'fail' when v_delivered = 0 then 'warn' else 'pass' end,
    'reason', case
      when v_bounced > 0 then v_bounced::text || ' recent email(s) bounced.'
      when v_delivered = 0 then 'No recent email to this operator has been delivered yet.'
      else 'Recent emails to the operator were sent or delivered.'
    end
  ));
  select count(*) into v_stray from public.email_log e
  where e.purpose = 'client' and (e.placement_id = p_placement or e.client_id = v_pl.case_file_id)
    and e.template not in ('client.operator_introduction', 'client.placement_paused', 'client-report', 'client-report-test')
    and e.status in ('queued', 'sent', 'delivered', 'delayed');
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'email_client', 'area', 'Email', 'admin_only', false,
    'result', case when v_stray > 0 then 'fail' else 'pass' end,
    'reason', case when v_stray > 0 then 'An email went to the client outside the introduction and the client report.' else 'Client email is limited to the introduction and the reports this placement allows.' end
  ));

  select coalesce(cardinality(c.recipient_emails) + cardinality(c.extra_emails), 0) into v_recipients
  from public.sales_report_config c where c.placement_id = p_placement;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'report_next', 'area', 'Reporting', 'admin_only', false,
    'result', case when coalesce(v_recipients, 0) > 0 then 'pass' else 'fail' end,
    'reason', case when coalesce(v_recipients, 0) > 0 then 'The next client report has recipients. Approval follows the placement, and the first report always needs approval.' else 'The client report has no recipient.' end
  ));

  select count(*) into v_mismatches from public.activity_mismatch m
  where m.placement_id = p_placement and m.status = 'open' and m.setup_resolved_at is null;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key', 'mismatches', 'area', 'Integrity', 'admin_only', true,
    'result', case when v_mismatches = 0 then 'pass' else 'warn' end,
    'reason', v_mismatches::text || ' open mismatch(es) so far. First-week rows are setup issues until DA Admin resolves them.'
  ));
  return v_items;
end;
$$;

create or replace function app.placement_health_overall(p_results jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from jsonb_array_elements(p_results) item
      where coalesce((item ->> 'admin_only')::boolean, false) = false and item ->> 'result' = 'fail'
    ) then 'fail'
    when exists (
      select 1 from jsonb_array_elements(p_results) item
      where coalesce((item ->> 'admin_only')::boolean, false) = false and item ->> 'result' = 'warn'
    ) then 'warn'
    else 'pass'
  end;
$$;

create or replace function public.so_launch_health_run(p_placement uuid, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_results jsonb;
  v_overall text;
  v_id uuid;
  v_day date;
  v_name text;
  v_client text;
  v_email text;
  v_source text := case when p_source = 'auto' then 'auto' else 'manual' end;
begin
  if v_source = 'auto' and current_setting('app.launch_sweep', true) is distinct from 'on' then
    raise exception 'permission_denied: automatic health checks run on the launch clock' using errcode = '42501';
  end if;
  if v_source = 'manual' then
    if app.is_impersonating() then
      raise exception 'view_as_read_only: exit View As to run a health check' using errcode = '42501';
    end if;
    if not app.is_admin() and not app.so_manages_placement(p_placement) and not exists (
      select 1 from public.placement_wizard w where w.placement_id = p_placement and w.created_by = auth.uid()
    ) then
      raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
    end if;
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  v_day := (now() at time zone v_pl.time_zone)::date;
  v_results := app.placement_health_results(p_placement);
  v_overall := app.placement_health_overall(v_results);
  insert into public.placement_health_check (placement_id, work_date, source, overall, results, ran_by)
  values (p_placement, v_day, v_source, v_overall, v_results, auth.uid())
  returning id into v_id;
  if v_overall = 'fail' then
    select o.name, c.name, coalesce(p.email, o.email)
      into v_name, v_client, v_email
    from public.operator o
    join public.client_case_file c on c.id = v_pl.case_file_id
    left join public.profile p on p.id = o.profile_id
    where o.id = v_pl.operator_id;
    perform app.so_staff_alert('launch_health', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, v_day,
      format('Health check failed for %s on %s.', v_name, v_client));
    if v_email is not null or v_pl.manager_profile_id is not null then
      perform app.placement_queue_mail(v_pl.id, 'alert.launch_health.' || v_day::text, v_day, jsonb_build_object(
        'to', (
          select coalesce(jsonb_agg(distinct addr), '[]'::jsonb)
          from (
            select m.email as addr from public.profile m where m.id = v_pl.manager_profile_id and m.email is not null
            union
            select p.email from public.profile p where p.role in ('admin', 'owner') and p.state = 'active' and p.email is not null
          ) people
        ),
        'operator', v_name, 'client', v_client, 'overall', v_overall, 'results', v_results,
        'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id
      ));
    end if;
  end if;
  perform app.so_system_audit('workspace.launch.health', 'placement_health_check', v_id::text,
    format('Health check %s', v_overall), null, jsonb_build_object('overall', v_overall, 'source', v_source), v_pl.case_file_id);
  return jsonb_build_object('id', v_id, 'overall', v_overall, 'results', v_results, 'ran_at', now());
end;
$$;

create or replace function public.so_launch_confirm(p_placement uuid, p_item text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_self boolean;
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to confirm a launch item' using errcode = '42501';
  end if;
  if p_item not in ('ghl_signin', 'test_report', 'introduction') then
    raise exception 'invalid: that item is checked by the system' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  select exists (select 1 from public.operator o where o.id = v_pl.operator_id and o.profile_id = auth.uid()) into v_self;
  if p_item = 'ghl_signin' and not v_self and not app.is_admin() and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if p_item <> 'ghl_signin' and not app.is_admin() and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  insert into public.placement_launch_confirm (placement_id, item, confirmed_by)
  values (p_placement, p_item, auth.uid())
  on conflict (placement_id, item) do update set confirmed_by = auth.uid(), confirmed_at = now();
  perform app.placement_launch_row(p_placement);
  if p_item = 'test_report' then
    update public.placement_launch set test_report_at = now(), test_report_by = auth.uid(), updated_at = now() where placement_id = p_placement;
  elsif p_item = 'introduction' then
    update public.placement_launch set intro_not_needed = true, intro_not_needed_by = auth.uid(), intro_not_needed_at = now(), updated_at = now() where placement_id = p_placement;
  elsif p_item = 'ghl_signin' then
    insert into public.placement_ghl_readiness (operator_id, placement_id, client_case_file_id, operator_confirmed_at)
    values (v_pl.operator_id, p_placement, v_pl.case_file_id, now())
    on conflict (operator_id, client_case_file_id) do update
      set operator_confirmed_at = now(), placement_id = excluded.placement_id;
  end if;
  perform app.audit('workspace.launch.confirm', 'placement', p_placement::text,
    format('Confirmed launch item %s', p_item), null, jsonb_build_object('item', p_item), v_pl.case_file_id);
end;
$$;

create or replace function public.so_launch_settings(p_placement uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((p_body ->> 'summary_days')::integer, 5);
begin
  if app.is_impersonating() or (not app.is_admin() and not app.so_manages_placement(p_placement)) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if v_days not in (5, 10) then
    raise exception 'invalid: launch summaries run for 5 or 10 working days' using errcode = '23514';
  end if;
  perform app.placement_launch_row(p_placement);
  update public.placement_launch set
    summary_enabled = coalesce((p_body ->> 'summary_enabled')::boolean, summary_enabled),
    summary_days = v_days,
    combine_short_week = coalesce((p_body ->> 'combine_short_week')::boolean, combine_short_week),
    updated_at = now()
  where placement_id = p_placement;
  perform app.audit('workspace.launch.settings', 'placement', p_placement::text,
    'Updated launch summary settings', null, p_body, (select case_file_id from public.placement where id = p_placement));
end;
$$;

create or replace function public.so_launch_resolve_setup(p_mismatch uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.activity_mismatch;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: setup issues are DA Admin only' using errcode = '42501';
  end if;
  select * into v from public.activity_mismatch where id = p_mismatch;
  if v.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.activity_mismatch set
    setup_resolved_at = now(),
    setup_resolved_by = auth.uid(),
    status = case when status = 'open' then 'reviewed' else status end,
    notes = concat_ws(' ', notes, 'Resolved as a first-week setup issue.')
  where id = p_mismatch;
  perform app.audit('workspace.launch.setup', 'activity_mismatch', p_mismatch::text,
    'Resolved a first-week mismatch as a setup issue', null, jsonb_build_object('placement_id', v.placement_id),
    (select case_file_id from public.placement where id = v.placement_id));
end;
$$;

create or replace function public.so_launch_review(p_placement uuid, p_decision text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_decision text := lower(btrim(coalesce(p_decision, '')));
begin
  if app.is_impersonating() or (not app.is_admin() and not app.so_manages_placement(p_placement)) then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if v_decision not in ('keep', 'adjust', 'coach', 'escalate') then
    raise exception 'invalid: the decision is keep, adjust, coach, or escalate' using errcode = '23514';
  end if;
  if v_note is null or length(v_note) < 8 then
    raise exception 'reason_required: the review needs a note' using errcode = '23514';
  end if;
  insert into public.placement_launch_review (placement_id, decision, note, decided_by)
  values (p_placement, v_decision, v_note, auth.uid())
  on conflict (placement_id) do update
    set decision = excluded.decision, note = excluded.note, decided_by = auth.uid(), decided_at = now();
  perform app.audit('workspace.launch.review', 'placement', p_placement::text,
    format('30-day review: %s. %s', v_decision, v_note), null, jsonb_build_object('decision', v_decision),
    (select case_file_id from public.placement where id = p_placement));
end;
$$;

-- First client report always needs approval. A short first week waits for the next week.
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
  if p_kind not in ('weekly', 'daily') or p_end < p_start then
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
  v_approval := coalesce(v_cfg.require_approval, true) or (p_kind = 'weekly' and v_first);
  insert into public.sales_report (
    placement_id, kind, period_start, period_end, status, approval_due_at, scheduled_for, summary, next_focus, auto_summary
  ) values (
    p_placement, p_kind, v_start, p_end,
    case when v_approval then 'ready' else 'approved' end,
    case when v_approval then now() + make_interval(hours => v_setting.report_approval_hours) else null end,
    case when v_approval then null else now() end,
    null, null, not v_approval
  ) returning id into v_id;
  if v_launch.deferred_period_start is not null then
    update public.placement_launch set deferred_period_start = null, updated_at = now() where placement_id = p_placement;
  end if;
  if not v_approval then
    v_summary := app.so_report_auto_summary(v_id);
    update public.sales_report set summary = v_summary, next_focus = 'Keep the current focus.' where id = v_id;
  else
    perform app.so_staff_alert('report_ready', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, p_end,
      format('A %s report is ready for review.', p_kind));
  end if;
  perform app.so_system_audit('workspace.report.opened', 'sales_report', v_id::text,
    format('Opened the %s report for %s to %s', p_kind, v_start, p_end),
    null, jsonb_build_object('status', (select status from public.sales_report where id = v_id), 'first', v_first), v_pl.case_file_id);
  return v_id;
end;
$$;

create or replace function public.so_launch_report_flag(p_report uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r public.sales_report;
  v_first boolean;
  v_name text;
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_r from public.sales_report where id = p_report;
  if v_r.id is null then
    return null;
  end if;
  v_first := v_r.kind = 'weekly' and not v_r.test and not exists (
    select 1 from public.sales_report earlier
    where earlier.placement_id = v_r.placement_id and earlier.kind = 'weekly' and not earlier.test
      and earlier.period_end < v_r.period_end
  );
  select split_part(btrim(o.name), ' ', 1) into v_name
  from public.operator o join public.placement pl on pl.operator_id = o.id
  where pl.id = v_r.placement_id;
  return jsonb_build_object('first', v_first, 'operator_first', v_name, 'placement_id', v_r.placement_id);
end;
$$;

create or replace function public.so_launch_operator()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_submitted boolean;
  v_tasks jsonb;
begin
  select pl.* into v_pl
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  where o.profile_id = app.acting_profile() and pl.status = 'active' and pl.placement_type is not null
  order by pl.start_date desc
  limit 1;
  if v_pl.id is null then
    return jsonb_build_object('show_welcome', false, 'show_guide', false);
  end if;
  v_submitted := exists (
    select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.submitted_at is not null
  );
  select coalesce(jsonb_agg(t.title order by t.created_at), '[]'::jsonb) into v_tasks
  from public.operator_task t
  where t.placement_id = v_pl.id and t.due_on = app.placement_first_work_day(v_pl) and t.source = 'manager';
  return jsonb_build_object(
    'show_welcome', not v_submitted,
    'show_guide', not v_submitted,
    'client', (select name from public.client_case_file where id = v_pl.case_file_id),
    'manager', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
    'shift', v_pl.shift_start || '–' || v_pl.shift_end || ' ' || v_pl.time_zone,
    'deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
    'tasks', coalesce(v_tasks, '[]'::jsonb),
    'day_number', app.placement_days_elapsed(v_pl, (now() at time zone v_pl.time_zone)::date)
  );
end;
$$;

create or replace function public.so_launch_week(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_window integer := 5;
  v_data_days integer;
  v_admin boolean := app.is_admin();
begin
  if not v_admin and not app.so_manages_placement(p_placement) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    return null;
  end if;
  select count(*) into v_data_days
  from generate_series(v_pl.start_date, v_pl.start_date + 21, interval '1 day') g
  where app.placement_workday_number(v_pl, g::date) between 1 and 5
    and (
      exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = g::date and e.submitted_at is not null)
      or exists (
        select 1 from public.activity_value val
        join public.activity_day d on d.id = val.activity_day_id
        where d.placement_id = v_pl.id and d.work_date = g::date and val.value > 0
      )
    );
  if v_data_days < 3 then
    v_window := 10;
  end if;
  return jsonb_build_object(
    'window', v_window,
    'data_days', v_data_days,
    'is_admin', v_admin,
    'targets_set', exists (
      select 1 from public.activity_target t where t.placement_id = p_placement and t.layer = 'override'
    ),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', g::date,
        'number', app.placement_workday_number(v_pl, g::date),
        'eod_status', e.status,
        'eod_at', e.submitted_at,
        'needs_help', e.needs_help,
        'conversations', (
          select sum(val.value) from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and d.work_date = g::date and val.metric_key = 'conversations_held' and val.source = 'ghl'
        ),
        'dials', (
          select sum(val.value) from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and d.work_date = g::date and val.metric_key = 'dials_made' and val.source = 'ghl'
        ),
        'outcomes', (
          select coalesce(jsonb_object_agg(o.name, s.total), '{}'::jsonb)
          from (
            select val.outcome_type_id, sum(val.value) as total
            from public.activity_value val
            join public.activity_day d on d.id = val.activity_day_id
            where d.placement_id = v_pl.id and d.work_date = g::date and val.metric_key = 'positive_outcomes'
            group by val.outcome_type_id
          ) s
          join public.placement_outcome_type o on o.id = s.outcome_type_id
        ),
        'health', (
          select h.overall from public.placement_health_check h
          where h.placement_id = v_pl.id and h.work_date = g::date
          order by h.ran_at desc limit 1
        ),
        'feedback', e.reviewed_at is not null
      ) order by g::date)
      from generate_series(v_pl.start_date, v_pl.start_date + 40, interval '1 day') g
      left join public.sales_eod e on e.placement_id = v_pl.id and e.work_date = g::date
      where app.placement_workday_number(v_pl, g::date) between 1 and v_window
    ), '[]'::jsonb),
    'averages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'metric', m.key, 'label', m.label,
        'average', (
          select round(avg(val.value), 1)
          from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and val.metric_key = m.key and val.source = 'ghl' and val.outcome_type_id is null
            and app.placement_workday_number(v_pl, d.work_date) between 1 and v_window
        ),
        'template_daily', (
          select t.daily from public.activity_target t
          where t.layer = 'default' and t.metric_key = m.key
            and (t.placement_type is null or t.placement_type = v_pl.placement_type)
          order by t.placement_type nulls last, t.effective_from desc
          limit 1
        )
      ) order by m.sort_order)
      from public.activity_metric m
      where m.active and not m.by_outcome
    ), '[]'::jsonb),
    'mismatches', case when v_admin then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mm.id, 'date', mm.work_date, 'metric', mm.metric_key, 'gap', mm.gap,
        'setup', mm.setup_resolved_at is not null
      ) order by mm.work_date)
      from public.activity_mismatch mm
      where mm.placement_id = v_pl.id and mm.first_week
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.so_launch_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.problem desc, x.day_number nulls last, x.start_date)
    from (
      select pl.id as placement_id, op.name as operator, c.name as client, pl.start_date,
        case when pl.status = 'scheduled' then 'scheduled' when pl.status = 'draft' then 'draft' else pl.status::text end as display_status,
        app.placement_days_elapsed(pl, (now() at time zone pl.time_zone)::date) as day_number,
        app.placement_open_count(pl.id) as open_items,
        (select h.overall from public.placement_health_check h where h.placement_id = pl.id order by h.ran_at desc limit 1) as health,
        exists (select 1 from public.sales_eod e where e.placement_id = pl.id and e.submitted_at is not null) as first_eod,
        exists (select 1 from public.activity_target t where t.placement_id = pl.id and t.layer = 'override') as targets_set,
        coalesce((
          select case
            when r.status = 'sent' then 'sent'
            when r.status in ('ready', 'approved', 'scheduled') then r.status
            else r.status end
          from public.sales_report r
          where r.placement_id = pl.id and r.kind = 'weekly' and not r.test
          order by r.period_end limit 1
        ), case when exists (select 1 from public.placement_launch l where l.placement_id = pl.id and l.deferred_period_start is not null) then 'combined' else 'not_opened' end) as first_report,
        case
          when rv.placement_id is not null then rv.decision
          when pl.start_date + 30 <= current_date then 'due'
          else 'waiting'
        end as review_status,
        (
          app.placement_open_count(pl.id) > 0
          or (select h.overall from public.placement_health_check h where h.placement_id = pl.id order by h.ran_at desc limit 1) = 'fail'
          or (pl.start_date + 30 <= current_date and rv.placement_id is null and pl.status = 'active')
        ) as problem
      from public.placement pl
      join public.operator op on op.id = pl.operator_id
      join public.client_case_file c on c.id = pl.case_file_id
      left join public.placement_launch_review rv on rv.placement_id = pl.id
      where pl.placement_type is not null
        and (app.is_admin() or pl.manager_profile_id = auth.uid())
        and (
          pl.status in ('draft', 'scheduled')
          or (pl.status in ('active', 'paused') and pl.start_date + 30 >= current_date)
        )
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.so_launch_attention_count()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if not app.is_admin() and not app.is_manager() then
    return 0;
  end if;
  select count(*) into v_n
  from jsonb_array_elements(public.so_launch_board()) item
  where coalesce((item ->> 'problem')::boolean, false);
  return coalesce(v_n, 0);
end;
$$;

create or replace function public.so_launch_sweep()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_local timestamp;
  v_today date;
  v_number integer;
  v_days integer;
  v_enabled boolean;
  v_deadline timestamptz;
  v_summary text;
  v_health text;
  v_name text;
  v_client text;
  v_manager_email text;
  v_data_days integer;
  v_window integer;
begin
  if auth.uid() is not null and not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  perform set_config('app.launch_sweep', 'on', true);
  for v_pl in
    select * from public.placement p
    where p.placement_type is not null and p.status in ('active', 'scheduled')
      and (auth.uid() is null or app.is_admin() or p.manager_profile_id = auth.uid())
  loop
    v_local := now() at time zone v_pl.time_zone;
    v_today := v_local::date;
    v_number := app.placement_workday_number(v_pl, v_today);
    select coalesce(l.summary_enabled, case when w.payload ->> 'launch_week' = 'false' then false else true end, true),
           coalesce(l.summary_days, 5)
      into v_enabled, v_days
    from public.placement p
    left join public.placement_launch l on l.placement_id = p.id
    left join public.placement_wizard w on w.placement_id = p.id
    where p.id = v_pl.id;

    if v_pl.status = 'active' and not exists (
      select 1 from public.operator_notification n
      where n.placement_id = v_pl.id and n.kind = 'launch_welcome'
    ) then
      select c.name into v_client from public.client_case_file c where c.id = v_pl.case_file_id;
      perform app.so_operator_alert(v_pl.operator_id, v_pl.id, 'launch_welcome',
        'Day 1 on ' || coalesce(v_client, 'your client'),
        'Your shift starts at ' || v_pl.shift_start || ' ' || v_pl.time_zone || '. Read the offer brief, then log the day.',
        '/workspace/operator/workspace');
    end if;

    if v_number between 1 and 5 and v_local::time >= time '10:00'
       and not exists (
         select 1 from public.placement_health_check h
         where h.placement_id = v_pl.id and h.work_date = v_today and h.source = 'auto'
       ) then
      perform public.so_launch_health_run(v_pl.id, 'auto');
    end if;

    v_deadline := app.so_eod_deadline(v_pl, v_today) + interval '30 minutes';
    if v_enabled and v_number between 1 and v_days and now() >= v_deadline
       and not exists (
         select 1 from public.placement_mail_job j
         where j.placement_id = v_pl.id and j.kind = 'alert.launch_day_summary.' || v_today::text
       ) then
      select e.status || case when e.submitted_at is null then '' else ' at ' || to_char(e.submitted_at at time zone v_pl.time_zone, 'HH24:MI') end,
             h.overall
        into v_summary, v_health
      from (select 1) s
      left join public.sales_eod e on e.placement_id = v_pl.id and e.work_date = v_today
      left join lateral (
        select overall from public.placement_health_check
        where placement_id = v_pl.id and work_date = v_today
        order by ran_at desc limit 1
      ) h on true;
      select o.name, c.name, m.email into v_name, v_client, v_manager_email
      from public.operator o
      join public.client_case_file c on c.id = v_pl.case_file_id
      left join public.profile m on m.id = v_pl.manager_profile_id
      where o.id = v_pl.operator_id;
      perform app.placement_queue_mail(v_pl.id, 'alert.launch_day_summary.' || v_today::text, v_today, jsonb_build_object(
        'to', case when v_manager_email is null then '[]'::jsonb else jsonb_build_array(v_manager_email) end,
        'operator', v_name, 'client', v_client, 'day', v_number, 'eod', coalesce(v_summary, 'No EOD opened'),
        'health', coalesce(v_health, 'not run'),
        'needs_help', exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = v_today and e.needs_help),
        'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id, 'admin', false
      ));
      perform app.placement_queue_mail(v_pl.id, 'alert.launch_day_summary.admin.' || v_today::text, v_today, jsonb_build_object(
        'to', coalesce((select jsonb_agg(p.email) from public.profile p where p.role in ('admin', 'owner') and p.state = 'active' and p.email is not null), '[]'::jsonb),
        'operator', v_name, 'client', v_client, 'day', v_number, 'eod', coalesce(v_summary, 'No EOD opened'),
        'health', coalesce(v_health, 'not run'),
        'mismatches', (select count(*) from public.activity_mismatch m where m.placement_id = v_pl.id and m.first_week and m.setup_resolved_at is null),
        'admin', true, 'operator_id', v_pl.operator_id, 'case_file_id', v_pl.case_file_id
      ));
    end if;

    select count(*) into v_data_days
    from generate_series(v_pl.start_date, v_today, interval '1 day') g
    where app.placement_workday_number(v_pl, g::date) between 1 and 5
      and exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = g::date and e.submitted_at is not null);
    v_window := case when v_data_days < 3 then 10 else 5 end;
    if v_pl.status = 'active' and v_number >= v_window
       and not exists (select 1 from public.activity_target t where t.placement_id = v_pl.id and t.layer = 'override')
       and not exists (select 1 from public.workspace_alert a where a.placement_id = v_pl.id and a.kind = 'launch_targets') then
      select o.name, c.name into v_name, v_client from public.operator o, public.client_case_file c
      where o.id = v_pl.operator_id and c.id = v_pl.case_file_id;
      perform app.so_staff_alert('launch_targets', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, v_today,
        format('Set targets for %s on %s. The first-week averages are on the operator page. Nothing is saved until you save them.', v_name, v_client));
    end if;

    if v_pl.status = 'active' and v_pl.start_date + 30 <= current_date
       and not exists (select 1 from public.placement_launch_review r where r.placement_id = v_pl.id)
       and not exists (select 1 from public.workspace_alert a where a.placement_id = v_pl.id and a.kind = 'launch_review') then
      select o.name, c.name into v_name, v_client from public.operator o, public.client_case_file c
      where o.id = v_pl.operator_id and c.id = v_pl.case_file_id;
      perform app.so_staff_alert('launch_review', v_pl.operator_id, v_pl.id, v_pl.manager_profile_id, current_date,
        format('The 30-day review is open for %s on %s.', v_name, v_client));
    end if;
  end loop;
  perform set_config('app.launch_sweep', 'off', true);
end;
$$;

create or replace function app.mismatch_flag_first_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_n integer;
begin
  select * into v_pl from public.placement where id = new.placement_id;
  if v_pl.id is not null then
    v_n := app.placement_workday_number(v_pl, new.work_date);
    if v_n between 1 and 10 then
      new.first_week := true;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists activity_mismatch_first_week on public.activity_mismatch;
create trigger activity_mismatch_first_week
  before insert on public.activity_mismatch
  for each row execute function app.mismatch_flag_first_week();

revoke all on function public.so_launch_health_run(uuid, text) from public, anon;
revoke all on function public.so_launch_confirm(uuid, text) from public, anon;
revoke all on function public.so_launch_settings(uuid, jsonb) from public, anon;
revoke all on function public.so_launch_resolve_setup(uuid) from public, anon;
revoke all on function public.so_launch_review(uuid, text, text) from public, anon;
revoke all on function public.so_launch_report_flag(uuid) from public, anon;
revoke all on function public.so_launch_operator() from public, anon;
revoke all on function public.so_launch_week(uuid) from public, anon;
revoke all on function public.so_launch_board() from public, anon;
revoke all on function public.so_launch_attention_count() from public, anon;
revoke all on function public.so_launch_sweep() from public, anon;
revoke all on function public.so_report_ensure(uuid, text, date, date) from public, anon;

grant execute on function public.so_launch_health_run(uuid, text) to authenticated;
grant execute on function public.so_launch_confirm(uuid, text) to authenticated;
grant execute on function public.so_launch_settings(uuid, jsonb) to authenticated;
grant execute on function public.so_launch_resolve_setup(uuid) to authenticated;
grant execute on function public.so_launch_review(uuid, text, text) to authenticated;
grant execute on function public.so_launch_report_flag(uuid) to authenticated;
grant execute on function public.so_launch_operator() to authenticated;
grant execute on function public.so_launch_week(uuid) to authenticated;
grant execute on function public.so_launch_board() to authenticated;
grant execute on function public.so_launch_attention_count() to authenticated;
grant execute on function public.so_launch_sweep() to authenticated;
grant execute on function public.so_report_ensure(uuid, text, date, date) to service_role;

select cron.schedule('placement-launch-sweep', '*/15 * * * *', 'select public.so_launch_sweep()');

-- Days before the placement start are not shown as missed.
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
    if v_r.kind = 'weekly' and v_points < 3 then
      v_show := app.so_client_metric(v_pl.id, v_r.period_end - 29, v_r.period_end, 'show_rate', null, false);
      v_note := 'Show rate uses the last 30 days. This week is too small to read on its own.';
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

  if v_r.kind = 'weekly' then
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

-- The placement list counts overdue launch items as well as activation blockers.
create or replace function public.so_placement_board()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.start_date desc nulls last, x.operator)
    from (
      select pl.id as placement_id, w.id as wizard_id, op.name as operator, c.name as client,
        coalesce(nullif(btrim(m.full_name), ''), m.email) as manager,
        pl.start_date,
        case
          when pl.status = 'scheduled' then 'scheduled'
          when pl.status = 'draft' then 'draft'
          when pl.status = 'renewed' then 'ended'
          else pl.status::text
        end as display_status,
        case
          when not exists (
            select 1 from public.ghl_connection g
            where g.case_file_id = pl.case_file_id and g.retired_at is null and g.replaces_id is null and g.level = 'location'
          ) then 'not_connected'
          when l.status = 'connected' then 'connected'
          when l.status = 'needs_attention' then 'needs_attention'
          else 'disconnected'
        end as ghl_status,
        (
          select count(*) from jsonb_array_elements(app.placement_checklist(pl.id)) item
          where coalesce((item ->> 'open')::boolean, (item ->> 'blocking')::boolean)
        ) as open_items
      from public.placement pl
      join public.operator op on op.id = pl.operator_id
      join public.client_case_file c on c.id = pl.case_file_id
      left join public.profile m on m.id = pl.manager_profile_id
      left join public.placement_wizard w on w.placement_id = pl.id
      left join public.sales_ghl_link l on l.placement_id = pl.id
      where app.is_admin() or pl.manager_profile_id = auth.uid() or w.created_by = auth.uid()
      union all
      select null::uuid, w.id, op.name, c.name, null::text, null::date, 'draft', 'not_connected', null::bigint
      from public.placement_wizard w
      left join public.operator op on op.id = nullif(w.payload ->> 'operator_id', '')::uuid
      left join public.client_case_file c on c.id = nullif(w.payload ->> 'case_file_id', '')::uuid
      where w.placement_id is null and (app.is_admin() or w.created_by = auth.uid())
    ) x
  ), '[]'::jsonb);
end;
$$;


create or replace function public.so_report_test(p_placement uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_src public.sales_report;
  v_id uuid;
  v_start date;
  v_end date;
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to send a test' using errcode = '42501';
  end if;
  select email into v_email from public.profile where id = auth.uid();
  if v_email is null then
    raise exception 'required: your profile has no email' using errcode = '23514';
  end if;
  select * into v_src from public.sales_report
  where placement_id = p_placement and not test
  order by period_end desc limit 1;
  if v_src.id is null then
    v_end := (now() at time zone (select time_zone from public.placement where id = p_placement))::date - 1;
    v_start := v_end - 6;
  else
    v_start := v_src.period_start;
    v_end := v_src.period_end;
  end if;
  insert into public.sales_report (placement_id, kind, period_start, period_end, status, test, test_to, summary, next_focus, win_eod_ids, scheduled_for, approved_at, auto_summary)
  values (p_placement, coalesce(v_src.kind, 'weekly'), v_start, v_end, 'approved', true, lower(v_email),
    coalesce(v_src.summary, 'Test report.'), coalesce(v_src.next_focus, 'Test only.'), coalesce(v_src.win_eod_ids, '{}'), now(), now(), true)
  returning id into v_id;
  perform app.placement_launch_row(p_placement);
  update public.placement_launch set test_report_at = now(), test_report_by = auth.uid(), updated_at = now() where placement_id = p_placement;
  perform app.audit('workspace.report.test', 'sales_report', v_id::text, 'Queued a test report to the person who clicked it',
    null, jsonb_build_object('to', lower(v_email)), (select case_file_id from public.placement where id = p_placement));
  return v_id;
end;
$$;

revoke all on function public.so_report_test(uuid) from public, anon;
grant execute on function public.so_report_test(uuid) to authenticated;

create or replace function public.so_ghl_mismatches(p_status text default null, p_operator uuid default null, p_placement uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: mismatches are DA Admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'operator_name', o.name, 'client_name', cf.name, 'work_date', m.work_date,
      'metric_key', m.metric_key, 'operator_value', m.operator_value, 'ghl_value', m.ghl_value,
      'gap', m.gap, 'status', m.status, 'decision', m.decision, 'age_days', current_date - m.work_date,
      'placement_id', m.placement_id, 'operator_id', m.operator_id, 'first_week', m.first_week,
      'setup_resolved', m.setup_resolved_at is not null
    ) order by (m.status = 'open') desc, m.work_date desc)
    from public.activity_mismatch m
    join public.operator o on o.id = m.operator_id
    join public.placement pl on pl.id = m.placement_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    where (
        (p_status is null and m.setup_resolved_at is null)
        or (p_status = 'setup' and m.setup_resolved_at is not null)
        or (p_status is not null and p_status <> 'setup' and m.status = p_status and m.setup_resolved_at is null)
      )
      and (p_operator is null or m.operator_id = p_operator)
      and (p_placement is null or m.placement_id = p_placement)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_ghl_mismatches(text, uuid, uuid) from public, anon;
grant execute on function public.so_ghl_mismatches(text, uuid, uuid) to authenticated;

create or replace function public.so_launch_status(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v public.placement_launch;
  v_health public.placement_health_check;
  v_review public.placement_launch_review;
begin
  if not app.is_admin() and not app.so_manages_placement(p_placement) and not exists (
    select 1 from public.placement_wizard w where w.placement_id = p_placement and w.created_by = auth.uid()
  ) then
    raise exception 'out_of_scope' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  select * into v from public.placement_launch where placement_id = p_placement;
  select * into v_health from public.placement_health_check where placement_id = p_placement order by ran_at desc limit 1;
  select * into v_review from public.placement_launch_review where placement_id = p_placement;
  return jsonb_build_object(
    'summary_enabled', coalesce(v.summary_enabled, true),
    'summary_days', coalesce(v.summary_days, 5),
    'combine_short_week', coalesce(v.combine_short_week, true),
    'review_due', v_pl.start_date + 30 <= current_date,
    'review', case when v_review.placement_id is null then null else jsonb_build_object('decision', v_review.decision, 'note', v_review.note, 'at', v_review.decided_at) end,
    'health', case when v_health.id is null then null else jsonb_build_object('overall', v_health.overall, 'ran_at', v_health.ran_at, 'results', v_health.results) end
  );
end;
$$;

revoke all on function public.so_launch_status(uuid) from public, anon;
grant execute on function public.so_launch_status(uuid) to authenticated;
