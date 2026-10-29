-- Sales Operator GHL sync and the DA Admin mismatch audit.
--
-- Reads the existing per-client Private Integration Token (ghl_connection /
-- ghl_location). Never stores a token here. The Next worker pulls GHL and
-- writes counts through so_apply_ghl_day. Operators and managers cannot read
-- mismatches, evidence, or credentials.

alter table public.team_setting
  add column if not exists ghl_sync_interval_minutes integer not null default 15
    check (ghl_sync_interval_minutes between 5 and 240),
  add column if not exists ghl_connect_seconds integer not null default 10
    check (ghl_connect_seconds between 1 and 600),
  add column if not exists ghl_conversation_seconds integer not null default 60
    check (ghl_conversation_seconds between 1 and 3600),
  add column if not exists ghl_reply_window_days integer not null default 7
    check (ghl_reply_window_days between 1 and 90),
  add column if not exists ghl_noshow_window_days integer not null default 7
    check (ghl_noshow_window_days between 1 and 90),
  add column if not exists ghl_stl_pause_outside_shift boolean not null default true,
  add column if not exists ghl_stl_notouch_hours integer not null default 24
    check (ghl_stl_notouch_hours between 1 and 168),
  add column if not exists ghl_backfill_days integer not null default 30
    check (ghl_backfill_days between 1 and 90),
  add column if not exists ghl_sync_fail_after integer not null default 3
    check (ghl_sync_fail_after between 1 and 20);

create table if not exists public.sales_ghl_link (
  placement_id uuid primary key references public.placement (id) on delete cascade,
  ghl_user_id text,
  status text not null default 'disconnected' check (status in ('connected', 'needs_attention', 'disconnected')),
  mapping jsonb not null default '{}'::jsonb,
  mapping_effective_on date,
  catalog jsonb not null default '{}'::jsonb,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  sync_requested_at timestamptz,
  rerun_from date,
  rerun_to date,
  updated_at timestamptz not null default now()
);

comment on table public.sales_ghl_link is
  'Which GHL user this placement is. The sub-account token stays on ghl_connection. Disconnecting stops the sync and keeps history.';

create table if not exists public.sales_ghl_day (
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  complete_metrics text[] not null default '{}',
  synced_at timestamptz not null default now(),
  primary key (placement_id, work_date)
);

comment on table public.sales_ghl_day is
  'Metrics whose GHL pull for this day finished. Anything missing stays Pending sync or Sync delayed, and is not compared.';

create table if not exists public.sales_ghl_evidence (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  metric_key text not null,
  outcome_type_id uuid,
  ghl_id text not null,
  ghl_type text not null,
  happened_at timestamptz,
  contact_id text,
  unique (placement_id, work_date, metric_key, ghl_id)
);

comment on table public.sales_ghl_evidence is
  'GHL record ids behind a count. No message bodies, recordings, or transcripts.';

create table if not exists public.sales_ghl_lead (
  placement_id uuid not null references public.placement (id) on delete cascade,
  contact_id text not null,
  created_at timestamptz not null,
  first_touch_at timestamptz,
  seconds integer,
  state text not null check (state in ('waiting', 'touched', 'not_touched')),
  primary key (placement_id, contact_id)
);

create table if not exists public.sales_ghl_sync_run (
  id bigint generated always as identity primary key,
  placement_id uuid not null references public.placement (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_read integer not null default 0,
  error text
);

create table if not exists public.activity_verified (
  activity_day_id uuid not null references public.activity_day (id) on delete cascade,
  metric_key text not null,
  outcome_type_id uuid,
  value numeric(14, 2) not null check (value >= 0),
  basis text not null check (basis in ('ghl', 'operator', 'unverified')),
  unique nulls not distinct (activity_day_id, metric_key, outcome_type_id)
);

comment on table public.activity_verified is
  'The number later reports use. GHL by default, the operator value when DA Admin accepts it, or the operator value marked unverified when GHL is not connected.';

alter table public.activity_mismatch
  add column if not exists decision text check (decision is null or decision in ('accept_ghl', 'accept_operator', 'dismiss')),
  add column if not exists decision_reason text,
  add column if not exists decision_note text,
  add column if not exists decision_by uuid references public.profile (id) on delete set null,
  add column if not exists decision_at timestamptz;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.activity_mismatch'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%reviewed%'
  loop
    execute format('alter table public.activity_mismatch drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.activity_mismatch
  drop constraint if exists activity_mismatch_status_chk;
alter table public.activity_mismatch
  add constraint activity_mismatch_status_chk
    check (status in ('open', 'reviewed', 'dismissed', 'resolved'));

do $$
declare t text;
begin
  foreach t in array array['sales_ghl_link', 'sales_ghl_day', 'sales_ghl_evidence', 'sales_ghl_lead', 'sales_ghl_sync_run', 'activity_verified'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_admin() and not app.is_impersonating())', t || '_admin', t);
  end loop;
end $$;

-- 2. Display ------------------------------------------------------------------------

create or replace function app.so_ghl_mapped(p_placement uuid, p_metric text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_metric
    when 'speed_to_lead_seconds' then jsonb_array_length(coalesce(l.mapping #> '{speed,ids}', '[]'::jsonb)) > 0
    when 'show_rate' then jsonb_array_length(coalesce(l.mapping -> 'show_calendar_ids', '[]'::jsonb)) > 0
    when 'closes' then jsonb_array_length(coalesce(l.mapping -> 'close_pipeline_ids', '[]'::jsonb)) > 0
    when 'reactivation_responses' then jsonb_array_length(coalesce(l.mapping #> '{reactivation,ids}', '[]'::jsonb)) > 0
    when 'reactivated_bookings' then jsonb_array_length(coalesce(l.mapping #> '{reactivation,ids}', '[]'::jsonb)) > 0
    when 'callback_requested' then jsonb_array_length(coalesce(l.mapping #> '{dispositions,callback_requested}', '[]'::jsonb)) > 0
    when 'not_interested' then jsonb_array_length(coalesce(l.mapping #> '{dispositions,not_interested}', '[]'::jsonb)) > 0
    when 'wrong_number' then jsonb_array_length(coalesce(l.mapping #> '{dispositions,wrong_number}', '[]'::jsonb)) > 0
    when 'do_not_call' then jsonb_array_length(coalesce(l.mapping #> '{dispositions,do_not_call}', '[]'::jsonb)) > 0
    when 'positive_outcomes' then jsonb_array_length(coalesce(l.mapping -> 'outcomes', '[]'::jsonb)) > 0
    else l.ghl_user_id is not null
  end
  from public.sales_ghl_link l
  where l.placement_id = p_placement;
$$;

revoke all on function app.so_ghl_mapped(uuid, text) from public, anon, authenticated;

create or replace function app.so_ghl_display(p_placement uuid, p_metric text, p_from date, p_to date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_link public.sales_ghl_link;
  v_source text;
  v_interval integer;
  v_loc boolean;
begin
  select source into v_source from public.activity_metric where key = p_metric;
  if v_source is distinct from 'ghl' and v_source is distinct from 'both' then
    return 'number';
  end if;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement;
  select exists (
    select 1 from public.placement pl
    join public.ghl_location loc on loc.case_file_id = pl.case_file_id
    join public.ghl_connection c on c.case_file_id = pl.case_file_id and c.retired_at is null and c.level = 'location'
    where pl.id = p_placement
  ) into v_loc;
  if v_link.placement_id is null or v_link.status = 'disconnected' or v_link.ghl_user_id is null or not v_loc then
    return 'pending_sync';
  end if;
  if not coalesce(app.so_ghl_mapped(p_placement, p_metric), false) then
    return 'pending_sync';
  end if;
  select ghl_sync_interval_minutes into v_interval from public.team_setting where id = 1;
  if v_link.status = 'needs_attention'
     or v_link.last_success_at is null
     or v_link.last_success_at < now() - make_interval(mins => coalesce(v_interval, 15) * 3) then
    return 'sync_delayed';
  end if;
  if exists (
    select 1 from generate_series(p_from, p_to, interval '1 day') d(day)
    where not exists (
      select 1 from public.sales_ghl_day s
      where s.placement_id = p_placement and s.work_date = d.day::date and p_metric = any (s.complete_metrics)
    )
  ) then
    return 'sync_delayed';
  end if;
  return 'number';
end;
$$;

revoke all on function app.so_ghl_display(uuid, text, date, date) from public, anon, authenticated;

create or replace function app.so_metric_payload(
  p public.placement,
  p_metric public.activity_metric,
  p_today date,
  p_week_start date,
  p_trend date[],
  p_day_fraction numeric,
  p_week_fraction numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.activity_target;
  v_daily numeric;
  v_weekly numeric;
  v_today_display text;
  v_week_display text;
  v_today_value numeric;
  v_week_value numeric;
  v_any boolean := p_metric.by_outcome;
  v_source text;
begin
  v_target := app.so_target(p.id, p_metric.key, p_today);
  v_daily := case when v_target.daily is not null and v_target.daily > 0 then v_target.daily else null end;
  v_weekly := case when v_target.weekly is not null and v_target.weekly > 0 then v_target.weekly else null end;
  v_source := case when p_metric.source = 'ghl' then 'ghl' else 'operator' end;
  if p_metric.source = 'ghl' then
    v_today_display := app.so_ghl_display(p.id, p_metric.key, p_today, p_today);
    v_week_display := app.so_ghl_display(p.id, p_metric.key, p_week_start, p_today);
    v_today_value := case when v_today_display = 'number' then app.so_value_sum(p.id, p_metric.key, 'ghl', null, v_any, p_today, p_today) else null end;
    v_week_value := case when v_week_display = 'number' then app.so_value_sum(p.id, p_metric.key, 'ghl', null, v_any, p_week_start, p_today) else null end;
  else
    v_today_display := 'number';
    v_week_display := 'number';
    v_today_value := app.so_value_sum(p.id, p_metric.key, 'operator', null, v_any, p_today, p_today);
    v_week_value := app.so_value_sum(p.id, p_metric.key, 'operator', null, v_any, p_week_start, p_today);
  end if;

  return jsonb_build_object(
    'key', p_metric.key,
    'label', p_metric.label,
    'unit', p_metric.unit,
    'section', case
      when p_metric.key in ('callback_requested', 'not_interested', 'wrong_number', 'do_not_call') then 'other'
      else 'primary'
    end,
    'operator_editable', p_metric.operator_editable and p_metric.source <> 'ghl',
    'by_outcome', p_metric.by_outcome,
    'today_display', v_today_display,
    'week_display', v_week_display,
    'today', v_today_value,
    'week', v_week_value,
    'target_today', v_daily,
    'target_week', v_weekly,
    'target_layer_today', case when v_daily is null then null else v_target.layer end,
    'target_layer_week', case when v_weekly is null then null else v_target.layer end,
    'pace_today', case when v_today_display = 'number' then app.so_pace(v_today_value, v_daily, p_day_fraction) else null end,
    'pace_week', case when v_week_display = 'number' then app.so_pace(v_week_value, v_weekly, p_week_fraction) else null end,
    'trend', case
      when v_source = 'ghl' and v_week_display = 'number' then app.so_trend(p.id, p_metric.key, 'ghl', null, v_any, p_trend)
      when v_source = 'operator' then app.so_trend(p.id, p_metric.key, 'operator', null, v_any, p_trend)
      else '[]'::jsonb
    end
  );
end;
$$;

revoke all on function app.so_metric_payload(public.placement, public.activity_metric, date, date, date[], numeric, numeric) from public, anon, authenticated;

-- 3. Apply a finished pull -----------------------------------------------------------

create or replace function public.so_apply_ghl_day(
  p_placement uuid, p_day date, p_counts jsonb, p_evidence jsonb, p_complete text[], p_leads jsonb default '[]'::jsonb, p_tasks jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_day uuid;
  v_item jsonb;
  v_metric text;
  v_value numeric;
  v_outcome uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (v_pl.operator_id, v_pl.id, p_day)
  on conflict (operator_id, placement_id, work_date) do nothing;
  select id into v_day from public.activity_day
  where operator_id = v_pl.operator_id and placement_id = v_pl.id and work_date = p_day;
  update public.activity_day set ghl_updated_at = now() where id = v_day;

  for v_item in select value from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    v_metric := v_item ->> 'metric';
    v_value := coalesce((v_item ->> 'value')::numeric, 0);
    v_outcome := nullif(v_item ->> 'outcome_type_id', '')::uuid;
    insert into public.activity_value (activity_day_id, metric_key, outcome_type_id, source, value)
    values (v_day, v_metric, v_outcome, 'ghl', v_value)
    on conflict (activity_day_id, metric_key, outcome_type_id, source) do update set value = excluded.value, updated_at = now();
  end loop;

  delete from public.sales_ghl_evidence where placement_id = p_placement and work_date = p_day;
  insert into public.sales_ghl_evidence (placement_id, work_date, metric_key, outcome_type_id, ghl_id, ghl_type, happened_at, contact_id)
  select p_placement, p_day, e ->> 'metric', nullif(e ->> 'outcome_type_id', '')::uuid, e ->> 'ghl_id', coalesce(e ->> 'ghl_type', 'record'),
         nullif(e ->> 'at', '')::timestamptz, e ->> 'contact_id'
  from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) e
  where coalesce(e ->> 'ghl_id', '') <> '';

  insert into public.sales_ghl_day (placement_id, work_date, complete_metrics, synced_at)
  values (p_placement, p_day, coalesce(p_complete, '{}'), now())
  on conflict (placement_id, work_date) do update
    set complete_metrics = excluded.complete_metrics, synced_at = now();

  insert into public.sales_ghl_lead (placement_id, contact_id, created_at, first_touch_at, seconds, state)
  select p_placement, l ->> 'contact_id', (l ->> 'created_at')::timestamptz, nullif(l ->> 'first_touch_at', '')::timestamptz,
         nullif(l ->> 'seconds', '')::integer, l ->> 'state'
  from jsonb_array_elements(coalesce(p_leads, '[]'::jsonb)) l
  where coalesce(l ->> 'contact_id', '') <> ''
  on conflict (placement_id, contact_id) do update
    set first_touch_at = excluded.first_touch_at, seconds = excluded.seconds, state = excluded.state, created_at = excluded.created_at;

  insert into public.operator_task (
    operator_id, placement_id, title, detail, due_on, source, system_key, completed_on, completed_at
  )
  select v_pl.operator_id, p_placement, left(coalesce(t ->> 'title', 'GHL task'), 140), '',
         nullif(t ->> 'due_on', '')::date, 'ghl', 'ghl:' || (t ->> 'id'),
         case when coalesce(t ->> 'completed', '') = 'true' then nullif(t ->> 'due_on', '')::date else null end,
         case when coalesce(t ->> 'completed', '') = 'true' then now() else null end
  from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) t
  where coalesce(t ->> 'id', '') <> ''
  on conflict (placement_id, system_key) where system_key is not null do update
    set title = excluded.title,
        completed_on = coalesce(public.operator_task.completed_on, excluded.completed_on),
        completed_at = coalesce(public.operator_task.completed_at, excluded.completed_at);
end;
$$;

revoke all on function public.so_apply_ghl_day(uuid, date, jsonb, jsonb, text[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.so_apply_ghl_day(uuid, date, jsonb, jsonb, text[], jsonb, jsonb) to service_role;

create or replace function public.so_ghl_sync_result(p_placement uuid, p_ok boolean, p_error text, p_records integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fail integer;
  v_limit integer;
  v_link public.sales_ghl_link;
  v_pl public.placement;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select ghl_sync_fail_after into v_limit from public.team_setting where id = 1;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement for update;
  if v_link.placement_id is null or v_link.status = 'disconnected' then
    return;
  end if;
  v_fail := case when p_ok then 0 else v_link.consecutive_failures + 1 end;
  update public.sales_ghl_link set
    last_sync_at = now(),
    last_success_at = case when p_ok then now() else last_success_at end,
    last_error = case when p_ok then null else left(coalesce(p_error, 'Sync failed'), 400) end,
    consecutive_failures = v_fail,
    status = case
      when not p_ok and v_fail >= coalesce(v_limit, 3) then 'needs_attention'
      when p_ok and status = 'needs_attention' then 'connected'
      else status
    end,
    sync_requested_at = null,
    rerun_from = case when p_ok then null else rerun_from end,
    rerun_to = case when p_ok then null else rerun_to end
  where placement_id = p_placement;
  insert into public.sales_ghl_sync_run (placement_id, finished_at, records_read, error)
  values (p_placement, now(), coalesce(p_records, 0), case when p_ok then null else left(coalesce(p_error, 'Sync failed'), 400) end);
  if not p_ok and v_fail >= coalesce(v_limit, 3) then
    select * into v_pl from public.placement where id = p_placement;
    perform app.so_staff_alert('eod_late', v_pl.operator_id, v_pl.id, null, current_date,
      format('GHL sync needs attention for this placement. %s', left(coalesce(p_error, 'Sync failed'), 180)));
  end if;
end;
$$;

revoke all on function public.so_ghl_sync_result(uuid, boolean, text, integer) from public, anon, authenticated;
grant execute on function public.so_ghl_sync_result(uuid, boolean, text, integer) to service_role;

-- The staff alert kind list may not include a sync kind. Use a workspace_alert insert that matches the existing check.
-- so_staff_alert uses kind eod_late which is the wrong meaning. Replace the call above with a direct insert of a dedicated kind if allowed.
-- The workspace_alert check includes specific kinds. eod_late is allowed but misleading.
-- Leave a plain audit instead when the kind would be wrong. The function above calls so_staff_alert('eod_late'...).
-- Fix: do not misuse eod_late. Insert is skipped here by replacing the function body's alert with audit only if kind is unavailable.
-- Corrected below by overwriting the function.

create or replace function public.so_ghl_sync_result(p_placement uuid, p_ok boolean, p_error text, p_records integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fail integer;
  v_limit integer;
  v_link public.sales_ghl_link;
  v_pl public.placement;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select ghl_sync_fail_after into v_limit from public.team_setting where id = 1;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement for update;
  if v_link.placement_id is null or v_link.status = 'disconnected' then
    return;
  end if;
  v_fail := case when p_ok then 0 else v_link.consecutive_failures + 1 end;
  update public.sales_ghl_link set
    last_sync_at = now(),
    last_success_at = case when p_ok then now() else last_success_at end,
    last_error = case when p_ok then null else left(coalesce(p_error, 'Sync failed'), 400) end,
    consecutive_failures = v_fail,
    status = case
      when not p_ok and v_fail >= coalesce(v_limit, 3) then 'needs_attention'
      when p_ok then 'connected'
      else status
    end,
    sync_requested_at = null,
    rerun_from = case when p_ok then null else rerun_from end,
    rerun_to = case when p_ok then null else rerun_to end
  where placement_id = p_placement;
  insert into public.sales_ghl_sync_run (placement_id, finished_at, records_read, error)
  values (p_placement, now(), coalesce(p_records, 0), case when p_ok then null else left(coalesce(p_error, 'Sync failed'), 400) end);
  if not p_ok and v_fail = coalesce(v_limit, 3) then
    select * into v_pl from public.placement where id = p_placement;
    insert into public.workspace_alert (kind, operator_id, placement_id, manager_profile_id, period_on, summary)
    values ('ghl_sync', v_pl.operator_id, v_pl.id, null, current_date,
      format('GHL sync needs attention. %s', left(coalesce(p_error, 'Sync failed'), 180)));
    perform app.audit('workspace.ghl.needs_attention', 'sales_ghl_link', p_placement::text,
      'GHL sync needs attention', null, jsonb_build_object('error', p_error), v_pl.case_file_id);
  end if;
end;
$$;

-- 4. Mismatches ----------------------------------------------------------------------

create or replace function app.so_gap_is_mismatch(p_operator numeric, p_ghl numeric)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pct numeric;
  v_under integer;
  v_gap numeric;
  v_diff numeric;
  v_limit numeric;
begin
  select mismatch_tolerance_pct, mismatch_small_count_under, mismatch_small_count_gap
    into v_pct, v_under, v_gap
  from public.team_setting where id = 1;
  v_diff := abs(coalesce(p_operator, 0) - coalesce(p_ghl, 0));
  v_limit := greatest(
    greatest(coalesce(p_operator, 0), coalesce(p_ghl, 0)) * coalesce(v_pct, 10) / 100.0,
    case when greatest(coalesce(p_operator, 0), coalesce(p_ghl, 0)) < coalesce(v_under, 30) then coalesce(v_gap, 3) else 0 end
  );
  return v_diff > v_limit and v_diff > 0;
end;
$$;

revoke all on function app.so_gap_is_mismatch(numeric, numeric) from public, anon, authenticated;

create or replace function public.so_check_mismatches(p_placement uuid, p_day date, p_reason text default 'eod')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_day uuid;
  v_metric public.activity_metric;
  v_op numeric;
  v_ghl numeric;
  v_outcome uuid;
  v_count integer := 0;
  v_link public.sales_ghl_link;
begin
  select * into v_pl from public.placement where id = p_placement;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement and status = 'connected';
  if v_link.placement_id is null then
    return 0;
  end if;
  if v_link.mapping_effective_on is not null and p_day < v_link.mapping_effective_on and p_reason is distinct from 'rerun' then
    return 0;
  end if;
  select id into v_day from public.activity_day
  where placement_id = p_placement and work_date = p_day;
  if v_day is null then
    return 0;
  end if;

  for v_metric in select * from public.activity_metric where source = 'both' and active and not by_outcome loop
    if app.so_ghl_display(p_placement, v_metric.key, p_day, p_day) is distinct from 'number' then
      continue;
    end if;
    select value into v_op from public.activity_value
    where activity_day_id = v_day and metric_key = v_metric.key and source = 'operator' and outcome_type_id is null;
    select value into v_ghl from public.activity_value
    where activity_day_id = v_day and metric_key = v_metric.key and source = 'ghl' and outcome_type_id is null;
    if app.so_gap_is_mismatch(coalesce(v_op, 0), coalesce(v_ghl, 0)) then
      insert into public.activity_mismatch (operator_id, placement_id, work_date, metric_key, operator_value, ghl_value, gap, status)
      values (v_pl.operator_id, p_placement, p_day, v_metric.key, coalesce(v_op, 0), coalesce(v_ghl, 0), abs(coalesce(v_op, 0) - coalesce(v_ghl, 0)), 'open')
      on conflict (placement_id, work_date, metric_key, outcome_type_id) do update
        set operator_value = excluded.operator_value, ghl_value = excluded.ghl_value, gap = excluded.gap,
            status = case when activity_mismatch.decision is null then 'open' else activity_mismatch.status end;
      v_count := v_count + 1;
    else
      update public.activity_mismatch
         set status = 'resolved', notes = coalesce(notes, 'Resolved by reconciliation.')
       where placement_id = p_placement and work_date = p_day and metric_key = v_metric.key and outcome_type_id is null
         and status = 'open';
    end if;
    insert into public.activity_verified (activity_day_id, metric_key, outcome_type_id, value, basis)
    values (
      v_day, v_metric.key, null,
      case
        when exists (
          select 1 from public.activity_mismatch m
          where m.placement_id = p_placement and m.work_date = p_day and m.metric_key = v_metric.key
            and m.outcome_type_id is null and m.decision = 'accept_operator'
        ) then coalesce(v_op, 0)
        else coalesce(v_ghl, v_op, 0)
      end,
      case
        when app.so_ghl_display(p_placement, v_metric.key, p_day, p_day) is distinct from 'number' then 'unverified'
        when exists (
          select 1 from public.activity_mismatch m
          where m.placement_id = p_placement and m.work_date = p_day and m.metric_key = v_metric.key
            and m.outcome_type_id is null and m.decision = 'accept_operator'
        ) then 'operator'
        else 'ghl'
      end
    )
    on conflict (activity_day_id, metric_key, outcome_type_id) do update set value = excluded.value, basis = excluded.basis;
  end loop;

  for v_outcome in select id from public.placement_outcome_type where placement_id = p_placement and active loop
    if app.so_ghl_display(p_placement, 'positive_outcomes', p_day, p_day) is distinct from 'number' then
      exit;
    end if;
    select value into v_op from public.activity_value
    where activity_day_id = v_day and metric_key = 'positive_outcomes' and source = 'operator' and outcome_type_id = v_outcome;
    select value into v_ghl from public.activity_value
    where activity_day_id = v_day and metric_key = 'positive_outcomes' and source = 'ghl' and outcome_type_id = v_outcome;
    if app.so_gap_is_mismatch(coalesce(v_op, 0), coalesce(v_ghl, 0)) then
      insert into public.activity_mismatch (operator_id, placement_id, work_date, metric_key, outcome_type_id, operator_value, ghl_value, gap, status)
      values (v_pl.operator_id, p_placement, p_day, 'positive_outcomes', v_outcome, coalesce(v_op, 0), coalesce(v_ghl, 0), abs(coalesce(v_op, 0) - coalesce(v_ghl, 0)), 'open')
      on conflict (placement_id, work_date, metric_key, outcome_type_id) do update
        set operator_value = excluded.operator_value, ghl_value = excluded.ghl_value, gap = excluded.gap,
            status = case when activity_mismatch.decision is null then 'open' else activity_mismatch.status end;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.so_check_mismatches(uuid, date, text) from public, anon;
grant execute on function public.so_check_mismatches(uuid, date, text) to service_role;

create or replace function app.so_eod_mismatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    perform public.so_check_mismatches(new.placement_id, new.work_date, 'eod');
  end if;
  return new;
end;
$$;

drop trigger if exists sales_eod_mismatch on public.sales_eod;
create trigger sales_eod_mismatch
  after update of submitted_at on public.sales_eod
  for each row execute function app.so_eod_mismatch();

-- 5. Admin reads and decisions -------------------------------------------------------

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
      'placement_id', m.placement_id, 'operator_id', m.operator_id
    ) order by (m.status = 'open') desc, m.work_date desc)
    from public.activity_mismatch m
    join public.operator o on o.id = m.operator_id
    join public.placement pl on pl.id = m.placement_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    where (p_status is null or m.status = p_status)
      and (p_operator is null or m.operator_id = p_operator)
      and (p_placement is null or m.placement_id = p_placement)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_ghl_mismatches(text, uuid, uuid) from public, anon;
grant execute on function public.so_ghl_mismatches(text, uuid, uuid) to authenticated;

create or replace function public.so_ghl_mismatch(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.activity_mismatch;
  v_loc text;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: mismatches are DA Admin only' using errcode = '42501';
  end if;
  select * into v from public.activity_mismatch where id = p_id;
  if v.id is null then
    raise exception 'not_found: that mismatch does not exist' using errcode = 'P0002';
  end if;
  select location_id into v_loc from public.ghl_location loc
  join public.placement pl on pl.case_file_id = loc.case_file_id
  where pl.id = v.placement_id;
  return jsonb_build_object(
    'id', v.id, 'work_date', v.work_date, 'metric_key', v.metric_key,
    'operator_value', v.operator_value, 'ghl_value', v.ghl_value, 'gap', v.gap,
    'status', v.status, 'decision', v.decision, 'decision_reason', v.decision_reason,
    'decision_note', v.decision_note, 'decision_at', v.decision_at,
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ghl_id', e.ghl_id, 'ghl_type', e.ghl_type, 'happened_at', e.happened_at, 'contact_id', e.contact_id,
        'href', case when e.contact_id is null or v_loc is null then null
                     else 'https://app.gohighlevel.com/v2/location/' || v_loc || '/contacts/detail/' || e.contact_id end
      ) order by e.happened_at)
      from public.sales_ghl_evidence e
      where e.placement_id = v.placement_id and e.work_date = v.work_date and e.metric_key = v.metric_key
    ), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(jsonb_build_object('previous', c.previous_value, 'value', c.new_value, 'at', c.changed_at) order by c.changed_at)
      from public.activity_value_change c
      join public.activity_day d on d.id = c.activity_day_id
      where d.placement_id = v.placement_id and d.work_date = v.work_date and c.metric_key = v.metric_key
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.so_ghl_mismatch(uuid) from public, anon;
grant execute on function public.so_ghl_mismatch(uuid) to authenticated;

create or replace function public.so_ghl_decide(p_id uuid, p_decision text, p_reason text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.activity_mismatch;
  v_day uuid;
  v_basis text;
  v_value numeric;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: mismatches are DA Admin only' using errcode = '42501';
  end if;
  if p_decision not in ('accept_ghl', 'accept_operator', 'dismiss') then
    raise exception 'invalid: choose accept GHL, accept operator, or dismiss' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'required: write a note' using errcode = '23514';
  end if;
  if p_decision = 'accept_operator' and coalesce(p_reason, '') not in ('ghl_outage', 'mapping_error', 'operator_verified', 'other') then
    raise exception 'required: pick why the operator number stands' using errcode = '23514';
  end if;
  select * into v from public.activity_mismatch where id = p_id;
  if v.id is null then
    raise exception 'not_found: that mismatch does not exist' using errcode = 'P0002';
  end if;
  update public.activity_mismatch set
    decision = p_decision,
    decision_reason = nullif(btrim(coalesce(p_reason, '')), ''),
    decision_note = btrim(p_note),
    decision_by = auth.uid(),
    decision_at = now(),
    status = case when p_decision = 'dismiss' then 'dismissed' else 'reviewed' end,
    notes = btrim(p_note),
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_id;
  select id into v_day from public.activity_day where placement_id = v.placement_id and work_date = v.work_date;
  v_basis := case when p_decision = 'accept_operator' then 'operator' else 'ghl' end;
  v_value := case when p_decision = 'accept_operator' then coalesce(v.operator_value, 0) else coalesce(v.ghl_value, 0) end;
  if v_day is not null and p_decision <> 'dismiss' then
    insert into public.activity_verified (activity_day_id, metric_key, outcome_type_id, value, basis)
    values (v_day, v.metric_key, v.outcome_type_id, v_value, v_basis)
    on conflict (activity_day_id, metric_key, outcome_type_id) do update set value = excluded.value, basis = excluded.basis;
  end if;
  perform app.audit('workspace.ghl.mismatch', 'activity_mismatch', p_id::text,
    format('Mismatch %s', p_decision), null, jsonb_build_object('reason', p_reason, 'note', btrim(p_note)),
    (select case_file_id from public.placement where id = v.placement_id));
end;
$$;

revoke all on function public.so_ghl_decide(uuid, text, text, text) from public, anon;
grant execute on function public.so_ghl_decide(uuid, text, text, text) to authenticated;

create or replace function public.so_ghl_integrity(p_operator uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: integrity is DA Admin only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days_checked', (select count(distinct work_date) from public.sales_ghl_day d join public.placement pl on pl.id = d.placement_id where pl.operator_id = p_operator and d.work_date >= current_date - 30),
    'days_with_mismatch', (select count(distinct work_date) from public.activity_mismatch m where m.operator_id = p_operator and m.work_date >= current_date - 30 and m.status <> 'resolved'),
    'accept_ghl', (select count(*) from public.activity_mismatch m where m.operator_id = p_operator and m.decision = 'accept_ghl' and m.work_date >= current_date - 30),
    'accept_operator', (select count(*) from public.activity_mismatch m where m.operator_id = p_operator and m.decision = 'accept_operator' and m.work_date >= current_date - 30),
    'dismissed', (select count(*) from public.activity_mismatch m where m.operator_id = p_operator and m.decision = 'dismiss' and m.work_date >= current_date - 30)
  );
end;
$$;

revoke all on function public.so_ghl_integrity(uuid) from public, anon;
grant execute on function public.so_ghl_integrity(uuid) to authenticated;

-- 6. Placement connection screen -----------------------------------------------------

create or replace function public.so_ghl_panel(p_placement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_link public.sales_ghl_link;
  v_loc public.ghl_location;
  v_last4 text;
  v_health text;
  v_dup text;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: the GHL connection is DA Admin only' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if v_pl.id is null then
    raise exception 'not_found: that placement does not exist' using errcode = 'P0002';
  end if;
  select * into v_link from public.sales_ghl_link where placement_id = p_placement;
  select * into v_loc from public.ghl_location where case_file_id = v_pl.case_file_id;
  select c.token_last4, c.status::text into v_last4, v_health
  from public.ghl_connection c
  where c.case_file_id = v_pl.case_file_id and c.retired_at is null and c.replaces_id is null and c.level = 'location'
  limit 1;
  select pl2.id::text into v_dup
  from public.sales_ghl_link other
  join public.placement pl2 on pl2.id = other.placement_id
  where other.ghl_user_id = v_link.ghl_user_id and other.ghl_user_id is not null
    and other.placement_id <> p_placement and other.status = 'connected' and pl2.status = 'active'
  limit 1;
  return jsonb_build_object(
    'placement_id', p_placement,
    'case_file_id', v_pl.case_file_id,
    'location_id', v_loc.location_id,
    'location_name', v_loc.location_name,
    'token_last4', v_last4,
    'connection_health', v_health,
    'status', coalesce(v_link.status, 'disconnected'),
    'ghl_user_id', v_link.ghl_user_id,
    'duplicate_placement_id', v_dup,
    'last_success_at', v_link.last_success_at,
    'last_error', v_link.last_error,
    'mapping', coalesce(v_link.mapping, '{}'::jsonb),
    'catalog', coalesce(v_link.catalog, '{}'::jsonb),
    'tracks_results', v_pl.tracks_results,
    'missing', jsonb_build_array(
      case when v_loc.location_id is null then 'Sub-account' end,
      case when v_link.ghl_user_id is null then 'Operator GHL user' end,
      case when jsonb_array_length(coalesce(v_link.mapping -> 'outcomes', '[]'::jsonb)) = 0 then 'Positive outcomes' end,
      case when v_pl.tracks_results and jsonb_array_length(coalesce(v_link.mapping -> 'show_calendar_ids', '[]'::jsonb)) = 0 then 'Show-rate calendars' end,
      case when v_pl.tracks_results and jsonb_array_length(coalesce(v_link.mapping -> 'close_pipeline_ids', '[]'::jsonb)) = 0 then 'Close pipelines' end,
      case when jsonb_array_length(coalesce(v_link.mapping #> '{speed,ids}', '[]'::jsonb)) = 0 then 'Speed-to-lead leads' end
    )
  );
end;
$$;

revoke all on function public.so_ghl_panel(uuid) from public, anon;
grant execute on function public.so_ghl_panel(uuid) to authenticated;

create or replace function public.so_ghl_save_user(p_placement uuid, p_user text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: the GHL connection is DA Admin only' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  if not exists (select 1 from public.ghl_location where case_file_id = v_pl.case_file_id) then
    raise exception 'not_connected: connect the client sub-account first' using errcode = '23514';
  end if;
  insert into public.sales_ghl_link (placement_id, ghl_user_id, status, connected_at, sync_requested_at)
  values (p_placement, nullif(btrim(coalesce(p_user, '')), ''), 'connected', now(), now())
  on conflict (placement_id) do update
    set ghl_user_id = excluded.ghl_user_id,
        status = 'connected',
        connected_at = coalesce(public.sales_ghl_link.connected_at, now()),
        disconnected_at = null,
        sync_requested_at = now();
  perform app.audit('workspace.ghl.user', 'sales_ghl_link', p_placement::text,
    'Mapped the operator GHL user', null, jsonb_build_object('ghl_user_id', p_user), v_pl.case_file_id);
end;
$$;

revoke all on function public.so_ghl_save_user(uuid, text) from public, anon;
grant execute on function public.so_ghl_save_user(uuid, text) to authenticated;

create or replace function public.so_ghl_save_mapping(p_placement uuid, p_mapping jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_old jsonb;
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  if app.is_impersonating() then
    raise exception 'view_as_read_only: exit View As to change a mapping' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  select mapping into v_old from public.sales_ghl_link where placement_id = p_placement;
  insert into public.sales_ghl_link (placement_id, mapping, mapping_effective_on, sync_requested_at)
  values (p_placement, coalesce(p_mapping, '{}'::jsonb), current_date + 1, now())
  on conflict (placement_id) do update
    set mapping = excluded.mapping, mapping_effective_on = current_date + 1, sync_requested_at = now();
  perform app.audit('workspace.ghl.mapping', 'sales_ghl_link', p_placement::text,
    'Saved GHL mapping. It applies from the next day.', v_old, p_mapping, v_pl.case_file_id);
end;
$$;

revoke all on function public.so_ghl_save_mapping(uuid, jsonb) from public, anon;
grant execute on function public.so_ghl_save_mapping(uuid, jsonb) to authenticated;

create or replace function public.so_ghl_disconnect(p_placement uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin disconnects GHL' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  update public.sales_ghl_link
     set status = 'disconnected', disconnected_at = now(), sync_requested_at = null
   where placement_id = p_placement;
  perform app.audit('workspace.ghl.disconnected', 'sales_ghl_link', p_placement::text,
    'Disconnected GHL sync. History stays.', null, null, v_pl.case_file_id);
end;
$$;

revoke all on function public.so_ghl_disconnect(uuid) from public, anon;
grant execute on function public.so_ghl_disconnect(uuid) to authenticated;

create or replace function public.so_ghl_queue_rerun(p_placement uuid, p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
begin
  if not app.is_admin() or app.is_impersonating() then
    raise exception 'admin_required: only DA Admin re-runs history' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 90 then
    raise exception 'invalid: the range is at most 90 days' using errcode = '23514';
  end if;
  select * into v_pl from public.placement where id = p_placement;
  update public.sales_ghl_link
     set rerun_from = p_from, rerun_to = p_to, sync_requested_at = now()
   where placement_id = p_placement;
  perform app.audit('workspace.ghl.rerun', 'sales_ghl_link', p_placement::text,
    format('Queued a GHL re-count from %s to %s', p_from, p_to),
    null, jsonb_build_object('from', p_from, 'to', p_to), v_pl.case_file_id);
end;
$$;

revoke all on function public.so_ghl_queue_rerun(uuid, date, date) from public, anon;
grant execute on function public.so_ghl_queue_rerun(uuid, date, date) to authenticated;

create or replace function public.so_ghl_save_catalog(p_placement uuid, p_catalog jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  update public.sales_ghl_link set catalog = coalesce(p_catalog, '{}'::jsonb) where placement_id = p_placement;
end;
$$;

revoke all on function public.so_ghl_save_catalog(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.so_ghl_save_catalog(uuid, jsonb) to service_role;

create or replace function public.so_ghl_due()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_minutes integer;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  select ghl_sync_interval_minutes into v_minutes from public.team_setting where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'placement_id', l.placement_id,
      'case_file_id', pl.case_file_id,
      'ghl_user_id', l.ghl_user_id,
      'time_zone', pl.time_zone,
      'shift_start', pl.shift_start,
      'shift_end', pl.shift_end,
      'start_date', pl.start_date,
      'mapping', l.mapping,
      'rerun_from', l.rerun_from,
      'rerun_to', l.rerun_to,
      'backfill_days', (select ghl_backfill_days from public.team_setting where id = 1),
      'connect_seconds', (select ghl_connect_seconds from public.team_setting where id = 1),
      'conversation_seconds', (select ghl_conversation_seconds from public.team_setting where id = 1),
      'reply_window_days', (select ghl_reply_window_days from public.team_setting where id = 1)
    ))
    from public.sales_ghl_link l
    join public.placement pl on pl.id = l.placement_id
    where l.status in ('connected', 'needs_attention')
      and l.ghl_user_id is not null
      and pl.status = 'active'
      and (
        l.sync_requested_at is not null
        or l.last_success_at is null
        or l.last_success_at < now() - make_interval(mins => coalesce(v_minutes, 15))
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_ghl_due() from public, anon, authenticated;
grant execute on function public.so_ghl_due() to service_role;

create or replace function public.so_ghl_roster()
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
    select jsonb_agg(jsonb_build_object(
      'placement_id', pl.id,
      'connected', l.status = 'connected' and l.ghl_user_id is not null and loc.location_id is not null
    ))
    from public.placement pl
    left join public.sales_ghl_link l on l.placement_id = pl.id
    left join public.ghl_location loc on loc.case_file_id = pl.case_file_id
    where pl.placement_type is not null and pl.status in ('active', 'paused')
  ), '[]'::jsonb);
end;
$$;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.workspace_alert'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%eod_submitted%'
  loop
    execute format('alter table public.workspace_alert drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.workspace_alert drop constraint if exists workspace_alert_kind_chk;
alter table public.workspace_alert
  add constraint workspace_alert_kind_chk
    check (kind in (
      'cert_grace', 'placement_review',
      'eod_submitted', 'eod_needs_help', 'eod_late', 'eod_manager', 'eod_missed',
      'eod_escalated', 'eod_edited', 'eod_feedback', 'ghl_sync'
    ));

revoke all on function public.so_ghl_roster() from public, anon;
grant execute on function public.so_ghl_roster() to authenticated;

-- Settings fields. The existing save keeps every earlier field and adds these.
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
    'cert_warning_days', 'cert_grace_days', 'view_as_idle_minutes', 'placement_review_months',
    'ghl_sync_interval_minutes', 'ghl_connect_seconds', 'ghl_conversation_seconds',
    'ghl_reply_window_days', 'ghl_noshow_window_days', 'ghl_stl_pause_outside_shift',
    'ghl_stl_notouch_hours', 'ghl_backfill_days', 'ghl_sync_fail_after'];
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
    ghl_sync_interval_minutes = coalesce((s ->> 'ghl_sync_interval_minutes')::integer, ghl_sync_interval_minutes),
    ghl_connect_seconds = coalesce((s ->> 'ghl_connect_seconds')::integer, ghl_connect_seconds),
    ghl_conversation_seconds = coalesce((s ->> 'ghl_conversation_seconds')::integer, ghl_conversation_seconds),
    ghl_reply_window_days = coalesce((s ->> 'ghl_reply_window_days')::integer, ghl_reply_window_days),
    ghl_noshow_window_days = coalesce((s ->> 'ghl_noshow_window_days')::integer, ghl_noshow_window_days),
    ghl_stl_pause_outside_shift = coalesce((s ->> 'ghl_stl_pause_outside_shift')::boolean, ghl_stl_pause_outside_shift),
    ghl_stl_notouch_hours = coalesce((s ->> 'ghl_stl_notouch_hours')::integer, ghl_stl_notouch_hours),
    ghl_backfill_days = coalesce((s ->> 'ghl_backfill_days')::integer, ghl_backfill_days),
    ghl_sync_fail_after = coalesce((s ->> 'ghl_sync_fail_after')::integer, ghl_sync_fail_after),
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

create or replace function app.so_record_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source is distinct from 'operator' then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.value is not distinct from old.value then
    return new;
  end if;
  insert into public.activity_value_change (
    activity_day_id, metric_key, outcome_type_id, source, previous_value, new_value, changed_by
  ) values (
    new.activity_day_id, new.metric_key, new.outcome_type_id, new.source,
    case when tg_op = 'UPDATE' then old.value else null end,
    new.value, auth.uid()
  );
  return new;
end;
$$;

create or replace function app.so_team_metric(p_placement uuid, p_day date, p_key text, p_admin boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_metric public.activity_metric;
  v_day uuid;
  v_operator numeric;
  v_ghl numeric;
  v_daily numeric;
  v_weekly numeric;
  v_row jsonb;
  v_state text;
begin
  select * into v_metric from public.activity_metric where key = p_key;
  if v_metric.key is null then
    return jsonb_build_object('key', p_key, 'label', p_key, 'operator', null, 'daily_target', null, 'weekly_target', null, 'pace', false);
  end if;
  select d.id into v_day from public.activity_day d
  where d.placement_id = p_placement and d.work_date = p_day;
  select sum(val.value) into v_operator from public.activity_value val
  where val.activity_day_id = v_day and val.metric_key = p_key and val.source = 'operator';
  select t.daily, t.weekly into v_daily, v_weekly from app.so_target(p_placement, p_key, p_day) t;
  v_row := jsonb_build_object(
    'key', v_metric.key, 'label', v_metric.label, 'operator', v_operator,
    'daily_target', v_daily, 'weekly_target', v_weekly,
    'pace', v_metric.source <> 'ghl' and v_metric.operator_editable
  );
  if p_admin then
    v_state := app.so_ghl_display(p_placement, p_key, p_day, p_day);
    select sum(val.value) into v_ghl from public.activity_value val
    where val.activity_day_id = v_day and val.metric_key = p_key and val.source = 'ghl';
    v_row := v_row || jsonb_build_object('ghl', case when v_state = 'number' then v_ghl else null end, 'ghl_state', v_state);
  end if;
  return v_row;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sales-ghl-due') then
    perform cron.unschedule('sales-ghl-due');
  end if;
  perform cron.schedule('sales-ghl-due', '*/15 * * * *', 'select public.so_ghl_due()');
end $$;
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

