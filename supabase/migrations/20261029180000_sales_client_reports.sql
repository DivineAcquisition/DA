-- Client reports. The client payload is assembled here, and it is the only
-- shape the email, the PDF, and the feedback page are allowed to render.
-- Blockers, mismatches, pay, notes, and credentials are not columns of that
-- payload. Destinations are optional and one-way.

-- 1. Settings ----------------------------------------------------------------------

alter table public.team_setting
  add column if not exists report_reply_to text,
  add column if not exists report_weekly_dow smallint not null default 1
    check (report_weekly_dow between 1 and 7),
  add column if not exists report_weekly_time text not null default '09:00'
    check (report_weekly_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column if not exists report_approval_hours integer not null default 24
    check (report_approval_hours between 1 and 168),
  add column if not exists report_low_rating smallint not null default 2
    check (report_low_rating between 1 and 5),
  add column if not exists report_page_origin text,
  add column if not exists report_drive_enabled boolean not null default false,
  add column if not exists report_discord_enabled boolean not null default false,
  add column if not exists report_airtable_enabled boolean not null default false,
  add column if not exists report_clickup_enabled boolean not null default false,
  add column if not exists report_drive_folder_id text,
  add column if not exists report_discord_ops_secret uuid,
  add column if not exists report_discord_ops_last4 text,
  add column if not exists report_discord_esc_secret uuid,
  add column if not exists report_discord_esc_last4 text,
  add column if not exists report_airtable_base_id text,
  add column if not exists report_airtable_secret uuid,
  add column if not exists report_airtable_last4 text,
  add column if not exists report_clickup_folder_id text,
  add column if not exists report_clickup_secret uuid,
  add column if not exists report_clickup_last4 text,
  add column if not exists report_clickup_escalation_list_id text,
  add column if not exists report_clickup_users jsonb not null default '{}'::jsonb,
  add column if not exists report_fail_alert_after integer not null default 3
    check (report_fail_alert_after between 1 and 20);

comment on column public.team_setting.report_page_origin is
  'Origin of the client feedback page. Null uses the operator workspace domain (team_setting.base_url).';
comment on column public.team_setting.report_reply_to is
  'Address clients reply to. Falls back to team_setting.reply_to, then the monitored Resend address.';
comment on column public.team_setting.report_drive_folder_id is
  'The DA Client Reports Shared Drive, or a folder inside it. The service account must be a Content Manager. Files are not shared publicly.';

-- 2. Per placement ------------------------------------------------------------------

create table if not exists public.sales_report_config (
  placement_id uuid primary key references public.placement (id) on delete cascade,
  weekly_enabled boolean not null default true,
  daily_enabled boolean not null default false,
  send_dow smallint check (send_dow is null or send_dow between 1 and 7),
  send_time text check (send_time is null or send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  require_approval boolean not null default true,
  include_speed boolean not null default true,
  include_plan boolean not null default true,
  include_results boolean,
  cc_manager boolean not null default true,
  recipient_emails text[] not null default '{}',
  extra_emails text[] not null default '{}',
  extra_cc text[] not null default '{}',
  discord_webhook_secret uuid,
  discord_webhook_last4 text,
  updated_by uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.sales_report_config is
  'Who receives this placement''s client report, and which sections are included. Recipients are chosen from the case file, not retyped as the source of truth.';

create table if not exists public.sales_report (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'daily')),
  period_start date not null,
  period_end date not null,
  status text not null default 'ready' check (status in ('draft', 'ready', 'approved', 'scheduled', 'sent', 'held', 'failed')),
  test boolean not null default false,
  test_to text,
  summary text,
  next_focus text,
  win_eod_ids uuid[] not null default '{}',
  hold_note text,
  approved_by uuid references public.profile (id) on delete set null,
  approved_at timestamptz,
  scheduled_for timestamptz,
  approval_due_at timestamptz,
  approval_alerted_at timestamptz,
  sent_at timestamptz,
  send_claimed_at timestamptz,
  email_attempts integer not null default 0,
  resend_count integer not null default 0,
  resend_pending boolean not null default false,
  resend_emails text[],
  drive_file_id text,
  drive_url text,
  token_id uuid,
  auto_summary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create unique index if not exists sales_report_period_idx
  on public.sales_report (placement_id, kind, period_start, period_end)
  where not test;

comment on table public.sales_report is
  'One client report. status ready is Ready for Review. A test row is emailed to the person who clicked Send test, with no token.';

create table if not exists public.sales_report_skip (
  placement_id uuid not null references public.placement (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'daily')),
  period_start date not null,
  period_end date not null,
  alerted_at timestamptz not null default now(),
  primary key (placement_id, kind, period_start, period_end)
);

comment on table public.sales_report_skip is
  'A period with no submitted EOD. No report is sent. The manager is alerted once.';

create table if not exists public.sales_report_feedback (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.sales_report (id) on delete cascade,
  token_id uuid not null references public.client_feedback_token (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  working text,
  change_note text,
  inaccurate boolean not null default false,
  inaccurate_note text,
  author_name text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.sales_report_feedback is
  'Each client submission on one report. The operator can read the rating and comments. They cannot reply.';

create table if not exists public.sales_delivery (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.sales_report (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete cascade,
  channel text not null check (channel in ('email', 'pdf', 'drive', 'discord', 'airtable', 'clickup')),
  destination text not null,
  status text not null default 'retrying' check (status in ('sent', 'retrying', 'failed')),
  subject_type text not null,
  subject_id text not null,
  attempt integer not null default 0,
  error text,
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_delivery_once_idx
  on public.sales_delivery (channel, destination, subject_type, subject_id);

comment on table public.sales_delivery is
  'Every outbound item. A failure retries on its own and does not stop the other channels. payload is internal and is not returned to managers.';

create table if not exists public.sales_token_event (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.client_feedback_token (id) on delete cascade,
  kind text not null check (kind in ('view', 'submit')),
  created_at timestamptz not null default now()
);

alter table public.client_feedback_token
  add column if not exists report_id uuid references public.sales_report (id) on delete set null;

alter table public.sales_report
  drop constraint if exists sales_report_token_fk;
alter table public.sales_report
  add constraint sales_report_token_fk
  foreign key (token_id) references public.client_feedback_token (id) on delete set null;

-- View As can open the reports page. The clock may create a report. A person
-- viewing as someone else still cannot approve, hold, or edit settings.
create or replace function app.so_block_impersonated_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.eod_sweep', true) = 'on' or current_setting('app.report_sweep', true) = 'on' then
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

do $$
declare t text;
begin
  foreach t in array array['sales_report_config', 'sales_report', 'sales_report_feedback', 'sales_delivery', 'sales_report_skip', 'sales_token_event'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop trigger if exists %I on public.%I', t || '_view_as', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function app.so_block_impersonated_write()', t || '_view_as', t);
  end loop;
end $$;

alter table public.workspace_alert drop constraint if exists workspace_alert_kind_chk;
alter table public.workspace_alert
  add constraint workspace_alert_kind_chk
    check (kind in (
      'cert_grace', 'placement_review',
      'eod_submitted', 'eod_needs_help', 'eod_late', 'eod_manager', 'eod_missed',
      'eod_escalated', 'eod_edited', 'eod_feedback', 'ghl_sync',
      'report_ready', 'report_sent', 'report_held', 'report_approval_due',
      'report_failed', 'report_empty', 'client_feedback', 'client_feedback_low'
    ));

-- 3. Client numbers -----------------------------------------------------------------
-- Verified value when one exists. Otherwise the operator's number, labelled
-- later as Operator reported. Never both, and never a mismatch.

create or replace function app.so_client_metric(
  p_placement uuid, p_start date, p_end date, p_metric text, p_outcome uuid default null, p_any boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day uuid;
  v_unit text;
  v_value numeric;
  v_verified boolean;
  v_sum numeric := 0;
  v_count integer := 0;
  v_reported boolean := false;
  v_part numeric;
  v_part_verified boolean;
  v_row record;
begin
  select m.unit into v_unit from public.activity_metric m where m.key = p_metric;
  for v_day in
    select d.id from public.activity_day d
    where d.placement_id = p_placement and d.work_date between p_start and p_end
  loop
    v_value := null;
    v_verified := true;
    for v_row in
      select v.value, v.basis, v.outcome_type_id
      from public.activity_verified v
      where v.activity_day_id = v_day and v.metric_key = p_metric
        and (p_any or v.outcome_type_id is not distinct from p_outcome)
    loop
      v_part := v_row.value;
      v_part_verified := v_row.basis in ('ghl', 'operator');
      if v_value is null then
        v_value := 0;
      end if;
      v_value := v_value + v_part;
      v_verified := v_verified and v_part_verified;
    end loop;
    if v_value is null then
      select coalesce(sum(av.value), null) into v_part
      from public.activity_value av
      where av.activity_day_id = v_day and av.metric_key = p_metric and av.source = 'operator'
        and (p_any or av.outcome_type_id is not distinct from p_outcome);
      if v_part is not null then
        v_value := v_part;
        v_verified := false;
      end if;
    end if;
    if v_value is not null then
      v_sum := v_sum + v_value;
      v_count := v_count + 1;
      v_reported := v_reported or not v_verified;
    end if;
  end loop;
  if v_count = 0 then
    return null;
  end if;
  return jsonb_build_object(
    'value', case when v_unit = 'percent' then round(v_sum / v_count, 1) else v_sum end,
    'reported', v_reported
  );
end;
$$;

revoke all on function app.so_client_metric(uuid, date, date, text, uuid, boolean) from public, anon, authenticated;

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
    return v_t.weekly;
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

create or replace function app.so_pace(p_value numeric, p_target numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_target is null or p_target = 0 or p_value is null then null
    when p_value >= p_target then 'met'
    when p_value >= p_target * 0.8 then 'on_track'
    else 'behind'
  end;
$$;

revoke all on function app.so_pace(numeric, numeric) from public, anon, authenticated;

-- The only object a client output may render. Keys are an allow-list.
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

-- 4. Contacts and placement settings ------------------------------------------------

create or replace function app.so_clean_emails(p text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
  o text[] := '{}';
begin
  if p is null then
    return '{}';
  end if;
  foreach v in array p loop
    v := lower(btrim(v));
    if v = '' then
      continue;
    end if;
    if v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'invalid_email: % is not an email address', v using errcode = '23514';
    end if;
    if not v = any (o) then
      o := o || v;
    end if;
  end loop;
  return o;
end;
$$;

revoke all on function app.so_clean_emails(text[]) from public, anon, authenticated;

create or replace function public.so_report_panel(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_cfg public.sales_report_config;
  v_contacts jsonb;
begin
  perform app.so_require_team_staff();
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    raise exception 'not_found: placement' using errcode = 'P0002';
  end if;
  select * into v_cfg from public.sales_report_config where placement_id = p_placement;
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'name', name, 'source', source) order by source, email), '[]'::jsonb)
  into v_contacts
  from (
    select lower(btrim(c.contact_email)) as email, c.contact_name as name, 'case_file' as source
    from public.client_case_file c
    where c.id = v_pl.case_file_id and c.contact_email is not null and btrim(c.contact_email) <> ''
    union
    select lower(btrim(p.email)), coalesce(a.full_name, p.full_name), 'account'
    from public.client_account a
    join public.profile p on p.id = a.profile_id
    where a.case_file_id = v_pl.case_file_id and a.state = 'active' and p.email is not null
  ) people
  where email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';

  return jsonb_build_object(
    'placement_id', v_pl.id,
    'client', (select name from public.client_case_file where id = v_pl.case_file_id),
    'tracks_results', v_pl.tracks_results,
    'time_zone', v_pl.time_zone,
    'contacts', v_contacts,
    'weekly_enabled', coalesce(v_cfg.weekly_enabled, true),
    'daily_enabled', coalesce(v_cfg.daily_enabled, false),
    'send_dow', v_cfg.send_dow,
    'send_time', v_cfg.send_time,
    'require_approval', coalesce(v_cfg.require_approval, true),
    'include_speed', coalesce(v_cfg.include_speed, true),
    'include_plan', coalesce(v_cfg.include_plan, true),
    'include_results', v_cfg.include_results,
    'cc_manager', coalesce(v_cfg.cc_manager, true),
    'recipient_emails', coalesce(to_jsonb(v_cfg.recipient_emails), '[]'::jsonb),
    'extra_emails', coalesce(to_jsonb(v_cfg.extra_emails), '[]'::jsonb),
    'extra_cc', coalesce(to_jsonb(v_cfg.extra_cc), '[]'::jsonb),
    'discord_set', v_cfg.discord_webhook_last4 is not null,
    'discord_last4', v_cfg.discord_webhook_last4
  );
end;
$$;

revoke all on function public.so_report_panel(uuid) from public, anon;
grant execute on function public.so_report_panel(uuid) to authenticated;

create or replace function public.so_report_save_config(p_placement uuid, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.sales_report_config;
  v_new public.sales_report_config;
  v_case uuid;
  s jsonb := p_body;
  v_recipients text[];
  v_extra text[];
  v_cc text[];
begin
  perform app.so_require_team_staff();
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change client reporting' using errcode = '42501';
  end if;
  select case_file_id into v_case from public.placement where id = p_placement;
  if v_case is null then
    raise exception 'not_found: placement' using errcode = 'P0002';
  end if;
  v_recipients := app.so_clean_emails(array(select jsonb_array_elements_text(coalesce(s -> 'recipient_emails', '[]'::jsonb))));
  v_extra := app.so_clean_emails(array(select jsonb_array_elements_text(coalesce(s -> 'extra_emails', '[]'::jsonb))));
  v_cc := app.so_clean_emails(array(select jsonb_array_elements_text(coalesce(s -> 'extra_cc', '[]'::jsonb))));
  select * into v_old from public.sales_report_config where placement_id = p_placement;
  insert into public.sales_report_config as c (
    placement_id, weekly_enabled, daily_enabled, send_dow, send_time, require_approval,
    include_speed, include_plan, include_results, cc_manager, recipient_emails, extra_emails, extra_cc, updated_by
  ) values (
    p_placement,
    coalesce((s ->> 'weekly_enabled')::boolean, true),
    coalesce((s ->> 'daily_enabled')::boolean, false),
    nullif(s ->> 'send_dow', '')::smallint,
    nullif(s ->> 'send_time', ''),
    coalesce((s ->> 'require_approval')::boolean, true),
    coalesce((s ->> 'include_speed')::boolean, true),
    coalesce((s ->> 'include_plan')::boolean, true),
    case when s ? 'include_results' and nullif(s ->> 'include_results', '') is not null then (s ->> 'include_results')::boolean else null end,
    coalesce((s ->> 'cc_manager')::boolean, true),
    v_recipients, v_extra, v_cc, auth.uid()
  )
  on conflict (placement_id) do update set
    weekly_enabled = excluded.weekly_enabled,
    daily_enabled = excluded.daily_enabled,
    send_dow = excluded.send_dow,
    send_time = excluded.send_time,
    require_approval = excluded.require_approval,
    include_speed = excluded.include_speed,
    include_plan = excluded.include_plan,
    include_results = excluded.include_results,
    cc_manager = excluded.cc_manager,
    recipient_emails = excluded.recipient_emails,
    extra_emails = excluded.extra_emails,
    extra_cc = excluded.extra_cc,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_new;
  perform app.audit('workspace.report.settings', 'sales_report_config', p_placement::text,
    'Changed client reporting for this placement',
    case when v_old.placement_id is null then null else jsonb_build_object(
      'weekly_enabled', v_old.weekly_enabled, 'daily_enabled', v_old.daily_enabled,
      'recipient_emails', v_old.recipient_emails, 'require_approval', v_old.require_approval
    ) end,
    jsonb_build_object(
      'weekly_enabled', v_new.weekly_enabled, 'daily_enabled', v_new.daily_enabled,
      'recipient_emails', v_new.recipient_emails, 'require_approval', v_new.require_approval
    ), v_case);
end;
$$;

revoke all on function public.so_report_save_config(uuid, jsonb) from public, anon;
grant execute on function public.so_report_save_config(uuid, jsonb) to authenticated;

-- Secrets go to the Vault. The row keeps the last four characters only.
create or replace function public.so_report_store_secret(p_kind text, p_value text, p_placement uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
  v_last4 text;
  v_value text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin stores a destination secret' using errcode = '42501';
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a connection' using errcode = '42501';
  end if;
  if v_value is null or v_value = 'stored' then
    return;
  end if;
  if p_kind = 'placement_discord' then
    if p_placement is null then
      raise exception 'required: placement' using errcode = '23514';
    end if;
    perform app.so_require_team_staff();
  elsif p_kind not in ('discord_ops', 'discord_esc', 'airtable', 'clickup') then
    raise exception 'invalid: unknown destination' using errcode = '23514';
  end if;
  if v_value = 'clear' then
    if p_kind = 'discord_ops' then
      update public.team_setting set report_discord_ops_secret = null, report_discord_ops_last4 = null where id = 1;
    elsif p_kind = 'discord_esc' then
      update public.team_setting set report_discord_esc_secret = null, report_discord_esc_last4 = null where id = 1;
    elsif p_kind = 'airtable' then
      update public.team_setting set report_airtable_secret = null, report_airtable_last4 = null where id = 1;
    elsif p_kind = 'clickup' then
      update public.team_setting set report_clickup_secret = null, report_clickup_last4 = null where id = 1;
    else
      update public.sales_report_config set discord_webhook_secret = null, discord_webhook_last4 = null where placement_id = p_placement;
    end if;
    perform app.audit('workspace.report.secret', 'team_setting', coalesce(p_placement::text, '1'),
      format('Cleared the %s connection', p_kind), null, null, null);
    return;
  end if;
  v_last4 := right(v_value, 4);
  v_secret := vault.create_secret(v_value, 'sales-report-' || p_kind || '-' || coalesce(p_placement::text, 'global'), 'client report destination');
  if p_kind = 'discord_ops' then
    update public.team_setting set report_discord_ops_secret = v_secret, report_discord_ops_last4 = v_last4 where id = 1;
  elsif p_kind = 'discord_esc' then
    update public.team_setting set report_discord_esc_secret = v_secret, report_discord_esc_last4 = v_last4 where id = 1;
  elsif p_kind = 'airtable' then
    update public.team_setting set report_airtable_secret = v_secret, report_airtable_last4 = v_last4 where id = 1;
  elsif p_kind = 'clickup' then
    update public.team_setting set report_clickup_secret = v_secret, report_clickup_last4 = v_last4 where id = 1;
  else
    insert into public.sales_report_config (placement_id, discord_webhook_secret, discord_webhook_last4, updated_by)
    values (p_placement, v_secret, v_last4, auth.uid())
    on conflict (placement_id) do update set
      discord_webhook_secret = excluded.discord_webhook_secret,
      discord_webhook_last4 = excluded.discord_webhook_last4,
      updated_by = auth.uid(),
      updated_at = now();
  end if;
  perform app.audit('workspace.report.secret', 'team_setting', coalesce(p_placement::text, '1'),
    format('Stored the %s connection', p_kind), null, jsonb_build_object('last4', v_last4), null);
end;
$$;

revoke all on function public.so_report_store_secret(text, text, uuid) from public, anon;
grant execute on function public.so_report_store_secret(text, text, uuid) to authenticated;

create or replace function public.so_report_secret(p_kind text, p_placement uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind = 'discord_ops' then
    select report_discord_ops_secret into v_id from public.team_setting where id = 1;
  elsif p_kind = 'discord_esc' then
    select report_discord_esc_secret into v_id from public.team_setting where id = 1;
  elsif p_kind = 'airtable' then
    select report_airtable_secret into v_id from public.team_setting where id = 1;
  elsif p_kind = 'clickup' then
    select report_clickup_secret into v_id from public.team_setting where id = 1;
  elsif p_kind = 'placement_discord' then
    select discord_webhook_secret into v_id from public.sales_report_config where placement_id = p_placement;
  else
    return null;
  end if;
  if v_id is null then
    return null;
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where id = v_id);
end;
$$;

revoke all on function public.so_report_secret(text, uuid) from public, anon, authenticated;
grant execute on function public.so_report_secret(text, uuid) to service_role;
