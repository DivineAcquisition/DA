-- Sales Operator dashboard.
--
-- The first screen of an Active placement: client card, today's EOD, tasks,
-- and numbers against target. Reads the Prompt 1 records. Does not build the
-- EOD form, reminders, GHL sync, client reports, or scoring.
--
-- Reused, not replaced:
--   operator_task           VA tasks already live here. New columns say whether
--                           a task is system, manager, or (later) GHL, plus
--                           priority and a due time. System tasks cannot be
--                           checked off by hand.
--   operator_notification   workspace alerts, told apart by kind. A new task
--                           writes one. kind task_assigned joins the Prompt 1
--                           kinds (manager_message, eod_reminder, eod_late,
--                           target_update, feedback_received).
--   activity_day / value    quick log writes the operator source only.
--   activity_target         override wins, then the admin default. A zero or
--                           a missing number is not a target.
--   sales_eod               status is read from the row. This prompt does not
--                           move a row to Late or Missed; that is the deadline
--                           flow.
--   team_setting            certification warning and grace are editable here.
--
-- Operators still have no direct read of workspace tables. Everything they
-- see comes through the functions below, scoped to their own operator row.
-- View-as can read and cannot write.

-- Certification warning and grace columns, and the GHL source for show rate and
-- closes, are owned by the Prompt 1 decisions migration, which runs after this
-- file. This migration only reads them.

-- Show rate and closes come from GHL. Operators cannot log them. The sync is later.
update public.activity_metric
set source = 'ghl',
    operator_editable = false,
    description = case key
      when 'show_rate' then 'Share of booked appointments that showed, from GHL. Tracked only when the placement tracks results.'
      else 'Booked appointments that became a sale, from GHL. Tracked only when the placement tracks results.'
    end
where key in ('show_rate', 'closes');

-- 2. Tasks: extend the existing table -----------------------------------------------

alter table public.operator_task
  add column if not exists source text not null default 'manager',
  add column if not exists due_time text,
  add column if not exists priority text not null default 'normal',
  add column if not exists system_key text,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'operator_task_source_chk') then
    alter table public.operator_task add constraint operator_task_source_chk
      check (source in ('system', 'manager', 'ghl'));
    alter table public.operator_task add constraint operator_task_priority_chk
      check (priority in ('normal', 'high'));
    alter table public.operator_task add constraint operator_task_due_time_chk
      check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end
$$;

create unique index if not exists operator_task_system_key_uq
  on public.operator_task (placement_id, system_key) where system_key is not null;

comment on column public.operator_task.source is
  'system: created for the EOD and completed by the EOD. manager: assigned by a person. ghl: reserved for the GHL sync.';
comment on column public.operator_task.system_key is
  'Stable id for a system task, eod:YYYY-MM-DD. Null on manager tasks.';

-- 3. Quick-log history ---------------------------------------------------------------

create table if not exists public.activity_value_change (
  id uuid primary key default gen_random_uuid(),
  activity_day_id uuid not null references public.activity_day (id) on delete cascade,
  metric_key text not null,
  outcome_type_id uuid,
  source text not null default 'operator' check (source = 'operator'),
  previous_value numeric(14, 2),
  new_value numeric(14, 2) not null check (new_value >= 0),
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists activity_value_change_day_idx
  on public.activity_value_change (activity_day_id, changed_at desc);

comment on table public.activity_value_change is
  'Every quick-log change to an operator-logged number, with the time it was saved. Append-only.';

create trigger activity_value_change_append_only
  before update or delete on public.activity_value_change
  for each row execute function app.so_append_only();

alter table public.activity_value_change enable row level security;
revoke all on public.activity_value_change from anon, authenticated;
grant select on public.activity_value_change to authenticated;
grant select, insert, update, delete on public.activity_value_change to service_role;

drop policy if exists activity_value_change_admin_read on public.activity_value_change;
create policy activity_value_change_admin_read on public.activity_value_change
  for select to authenticated using (app.is_admin());

drop policy if exists activity_value_change_manager_read on public.activity_value_change;
create policy activity_value_change_manager_read on public.activity_value_change
  for select to authenticated
  using (exists (
    select 1 from public.activity_day d
    where d.id = activity_day_id and app.so_manages_placement(d.placement_id)
  ));

-- 4. Working day, pace, edit window --------------------------------------------------

-- The operator's current working day in the placement zone.
-- A shift that crosses midnight still belongs to the day it started.
-- A calendar day that is not a working day resolves to the next working day.
-- Before the placement starts, the day is the first working day on or after the start.
create or replace function app.so_work_date(p public.placement, p_at timestamptz default now())
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone app.safe_tz(p.time_zone);
  v_day date := v_local::date;
  v_guard integer := 0;
begin
  if p.shift_end::time <= p.shift_start::time and v_local::time < p.shift_end::time then
    v_day := v_day - 1;
  end if;

  while not (extract(isodow from v_day)::smallint = any(p.working_days)) loop
    v_day := v_day + 1;
    v_guard := v_guard + 1;
    exit when v_guard > 7;
  end loop;

  if p.start_date is not null and v_day < p.start_date then
    v_day := p.start_date;
    v_guard := 0;
    while not (extract(isodow from v_day)::smallint = any(p.working_days)) loop
      v_day := v_day + 1;
      v_guard := v_guard + 1;
      exit when v_guard > 7;
    end loop;
  end if;

  return v_day;
end;
$$;

create or replace function app.so_previous_work_date(p public.placement, p_day date)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := p_day - 1;
  v_guard integer := 0;
begin
  while v_guard < 14 loop
    if extract(isodow from v_day)::smallint = any(p.working_days) then
      return v_day;
    end if;
    v_day := v_day - 1;
    v_guard := v_guard + 1;
  end loop;
  return p_day - 1;
end;
$$;

create or replace function app.so_next_shift_start(p public.placement, p_day date)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_day date := p_day + 1;
  v_guard integer := 0;
  v_bounds record;
begin
  while v_guard < 14 loop
    if extract(isodow from v_day)::smallint = any(p.working_days) then
      select * into v_bounds from app.shift_bounds(p, v_day);
      return v_bounds.starts_at;
    end if;
    v_day := v_day + 1;
    v_guard := v_guard + 1;
  end loop;
  return null;
end;
$$;

-- 0 before the shift, 1 after it, linear in between.
create or replace function app.so_day_fraction(p public.placement, p_day date, p_at timestamptz default now())
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_bounds record;
begin
  select * into v_bounds from app.shift_bounds(p, p_day);
  if v_bounds.starts_at is null or v_bounds.ends_at is null or v_bounds.ends_at <= v_bounds.starts_at then
    return 1;
  end if;
  if p_at <= v_bounds.starts_at then
    return 0;
  end if;
  if p_at >= v_bounds.ends_at then
    return 1;
  end if;
  return extract(epoch from (p_at - v_bounds.starts_at)) / extract(epoch from (v_bounds.ends_at - v_bounds.starts_at));
end;
$$;

-- met, on_track, behind, or null when there is no positive target.
create or replace function app.so_pace(p_value numeric, p_target numeric, p_fraction numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_target is null or p_target <= 0 then null
    when coalesce(p_value, 0) >= p_target then 'met'
    when coalesce(p_value, 0) + 0.0001 >= p_target * greatest(0::numeric, least(1::numeric, coalesce(p_fraction, 0))) then 'on_track'
    else 'behind'
  end;
$$;

create or replace function app.so_quick_log_open(p public.placement, p_eod public.sales_eod)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rule text;
  v_hours integer;
  v_next timestamptz;
begin
  if p_eod.id is null or p_eod.status in ('not_started', 'draft', 'late') then
    return true;
  end if;
  if p_eod.status = 'missed' then
    return false;
  end if;
  if p_eod.locked_at is not null and now() >= p_eod.locked_at then
    return false;
  end if;
  select eod_edit_rule, eod_edit_hours_after into v_rule, v_hours from public.team_setting where id = 1;
  if v_rule = 'never' then
    return false;
  end if;
  if v_rule = 'hours_after_submit' then
    return p_eod.submitted_at is not null
      and v_hours is not null
      and now() < p_eod.submitted_at + make_interval(hours => v_hours);
  end if;
  v_next := app.so_next_shift_start(p, p_eod.work_date);
  if v_next is null then
    return true;
  end if;
  return now() < v_next;
end;
$$;

revoke all on function app.so_work_date(public.placement, timestamptz) from public, anon, authenticated;
revoke all on function app.so_previous_work_date(public.placement, date) from public, anon, authenticated;
revoke all on function app.so_next_shift_start(public.placement, date) from public, anon, authenticated;
revoke all on function app.so_day_fraction(public.placement, date, timestamptz) from public, anon, authenticated;
revoke all on function app.so_pace(numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function app.so_quick_log_open(public.placement, public.sales_eod) from public, anon, authenticated;

-- 5. Small JSON helpers --------------------------------------------------------------

create or replace function app.so_viewer()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.impersonation := app.live_impersonation();
begin
  return jsonb_build_object(
    'view_as', v.id is not null,
    'actor_name', case when v.id is not null then app.profile_name(v.actor_profile_id) end,
    'actor_role', case when v.id is not null then (select pr.role::text from public.profile pr where pr.id = v.actor_profile_id) end,
    'expires_at', v.expires_at
  );
end;
$$;

create or replace function app.so_alert_kinds()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['manager_message', 'eod_reminder', 'eod_late', 'target_update', 'feedback_received', 'task_assigned'];
$$;

create or replace function app.so_alert_label(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'manager_message' then 'Manager message'
    when 'eod_reminder' then 'EOD reminder'
    when 'eod_late' then 'EOD late'
    when 'target_update' then 'Target update'
    when 'feedback_received' then 'Feedback'
    when 'task_assigned' then 'Task'
    else 'Alert'
  end;
$$;

create or replace function app.so_metric_group(p_key text, p_category text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key in ('dials_made', 'connects', 'speed_to_lead_seconds') or p_category = 'timing' then 'ghl'
    when p_category = 'outbound' then 'outbound'
    when p_category = 'follow_up' then 'follow_up'
    when p_category = 'reactivation' then 'reactivation'
    when p_category = 'results' then 'results'
    else null
  end;
$$;

create or replace function app.so_group_label(p_group text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_group
    when 'outbound' then 'Outbound'
    when 'ghl' then 'GHL activity'
    when 'follow_up' then 'Follow-up'
    when 'reactivation' then 'Reactivation'
    when 'results' then 'Results'
    else p_group
  end;
$$;

create or replace function app.so_value_sum(
  p_placement_id uuid,
  p_metric_key text,
  p_source text,
  p_outcome uuid,
  p_any_outcome boolean,
  p_from date,
  p_to date
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(v.value), 0)
  from public.activity_value v
  join public.activity_day d on d.id = v.activity_day_id
  where d.placement_id = p_placement_id
    and d.work_date between p_from and p_to
    and v.metric_key = p_metric_key
    and v.source = p_source
    and (
      (p_any_outcome and v.outcome_type_id is not null)
      or (not p_any_outcome and v.outcome_type_id is not distinct from p_outcome)
    );
$$;

create or replace function app.so_has_value(
  p_placement_id uuid,
  p_metric_key text,
  p_source text,
  p_from date,
  p_to date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_value v
    join public.activity_day d on d.id = v.activity_day_id
    where d.placement_id = p_placement_id
      and d.work_date between p_from and p_to
      and v.metric_key = p_metric_key
      and v.source = p_source
  );
$$;

create or replace function app.so_trend(
  p_placement_id uuid,
  p_metric_key text,
  p_source text,
  p_outcome uuid,
  p_any_outcome boolean,
  p_days date[]
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('date', day, 'value', val) order by day), '[]'::jsonb)
  from (
    select day,
      case
        when p_source = 'ghl' then (
          select sum(v.value)
          from public.activity_value v
          join public.activity_day d on d.id = v.activity_day_id
          where d.placement_id = p_placement_id and d.work_date = day
            and v.metric_key = p_metric_key and v.source = 'ghl'
            and (
              (p_any_outcome and v.outcome_type_id is not null)
              or (not p_any_outcome and v.outcome_type_id is not distinct from p_outcome)
            )
        )
        else coalesce((
          select sum(v.value)
          from public.activity_value v
          join public.activity_day d on d.id = v.activity_day_id
          where d.placement_id = p_placement_id and d.work_date = day
            and v.metric_key = p_metric_key and v.source = 'operator'
            and (
              (p_any_outcome and v.outcome_type_id is not null)
              or (not p_any_outcome and v.outcome_type_id is not distinct from p_outcome)
            )
        ), 0)
      end as val
    from unnest(coalesce(p_days, '{}'::date[])) as day
  ) points
  where p_source <> 'ghl' or val is not null;
$$;

revoke all on function app.so_viewer() from public, anon, authenticated;
revoke all on function app.so_alert_kinds() from public, anon, authenticated;
revoke all on function app.so_alert_label(text) from public, anon, authenticated;
revoke all on function app.so_metric_group(text, text) from public, anon, authenticated;
revoke all on function app.so_group_label(text) from public, anon, authenticated;
revoke all on function app.so_value_sum(uuid, text, text, uuid, boolean, date, date) from public, anon, authenticated;
revoke all on function app.so_has_value(uuid, text, text, date, date) from public, anon, authenticated;
revoke all on function app.so_trend(uuid, text, text, uuid, boolean, date[]) from public, anon, authenticated;

-- 6. Keep today's EOD row and the system tasks in step ------------------------------

create or replace function app.so_eod_complete_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' then
    update public.operator_task
       set completed_on = new.work_date,
           completed_at = coalesce(completed_at, new.submitted_at, now())
     where placement_id = new.placement_id
       and system_key = 'eod:' || new.work_date::text
       and completed_on is null;
  end if;
  return new;
end;
$$;

revoke all on function app.so_eod_complete_task() from public, anon, authenticated;

drop trigger if exists sales_eod_complete_system_task on public.sales_eod;
create trigger sales_eod_complete_system_task
  after insert or update of status on public.sales_eod
  for each row
  when (new.status = 'submitted')
  execute function app.so_eod_complete_task();

create or replace function app.so_upsert_system_task(
  p_operator_id uuid,
  p_placement_id uuid,
  p_day date,
  p_title text,
  p_due_time text,
  p_completed boolean,
  p_completed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := 'eod:' || p_day::text;
begin
  insert into public.operator_task (
    operator_id, placement_id, title, detail, due_on, due_time, source, priority, system_key,
    completed_on, completed_at
  ) values (
    p_operator_id, p_placement_id, p_title, '', p_day, p_due_time, 'system', 'normal', v_key,
    case when p_completed then p_day else null end,
    case when p_completed then coalesce(p_completed_at, now()) else null end
  )
  on conflict (placement_id, system_key) where system_key is not null
  do update set
    title = excluded.title,
    due_on = excluded.due_on,
    due_time = excluded.due_time,
    completed_on = coalesce(public.operator_task.completed_on, excluded.completed_on),
    completed_at = coalesce(public.operator_task.completed_at, excluded.completed_at);
end;
$$;

revoke all on function app.so_upsert_system_task(uuid, uuid, date, text, text, boolean, timestamptz) from public, anon, authenticated;

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
begin
  insert into public.activity_day (operator_id, placement_id, work_date)
  values (p_op, p.id, p_today)
  on conflict (operator_id, placement_id, work_date) do nothing;

  select id into v_day
  from public.activity_day
  where operator_id = p_op and placement_id = p.id and work_date = p_today;

  if not exists (select 1 from public.sales_eod where placement_id = p.id and work_date = p_today) then
    insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at, status)
    values (p_op, p.id, p_today, v_day, app.so_eod_deadline(p, p_today), 'not_started');
  end if;

  select * into v_eod from public.sales_eod where placement_id = p.id and work_date = p_today;
  perform app.so_upsert_system_task(
    p_op, p.id, p_today, 'Submit today''s EOD', v_due,
    v_eod.status = 'submitted', v_eod.submitted_at
  );

  v_yesterday := app.so_previous_work_date(p, p_today);
  select * into v_prev from public.sales_eod where placement_id = p.id and work_date = v_yesterday;
  if v_prev.status in ('late', 'draft') then
    perform app.so_upsert_system_task(p_op, p.id, v_yesterday, 'Submit yesterday''s EOD', v_due, false, null);
  elsif v_prev.status = 'submitted' then
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

-- 7. EOD card and certification banner ----------------------------------------------

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
begin
  select * into v_eod from public.sales_eod where placement_id = p.id and work_date = p_day;
  v_deadline := coalesce(v_eod.deadline_at, app.so_eod_deadline(p, p_day));
  if coalesce(v_eod.status, 'not_started') in ('not_started', 'draft') and v_deadline > now() then
    v_remaining := extract(epoch from (v_deadline - now()))::integer;
  end if;
  if v_eod.status = 'late' and v_deadline < now() then
    v_late := extract(epoch from (now() - v_deadline))::integer;
  end if;
  if v_eod.id is not null then
    select count(*)::integer into v_feedback from public.sales_eod_feedback where eod_id = v_eod.id;
  end if;
  return jsonb_build_object(
    'id', v_eod.id,
    'work_date', p_day,
    'status', coalesce(v_eod.status, 'not_started'),
    'deadline_at', v_deadline,
    'submitted_at', v_eod.submitted_at,
    'was_late', coalesce(v_eod.was_late, false),
    'feedback_count', v_feedback,
    'remaining_seconds', v_remaining,
    'late_seconds', v_late
  );
end;
$$;

revoke all on function app.so_eod_card(public.placement, date) from public, anon, authenticated;

create or replace function app.so_cert_banner(p_profile uuid, p_level smallint, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_warning integer := 14;
  v_grace integer := 7;
  v_recert date;
begin
  select coalesce(cert_warning_days, 14), coalesce(cert_grace_days, 7)
    into v_warning, v_grace
  from public.team_setting where id = 1;
  if v_warning is null then v_warning := 14; end if;
  if v_grace is null then v_grace := 7; end if;

  select c.recertify_on into v_recert
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = p_profile
    and e.status <> 'withdrawn'
    and c.level = p_level
  order by c.recertify_on desc nulls first
  limit 1;

  if v_recert is null then
    return null;
  end if;
  if p_day > v_recert and p_day <= v_recert + v_grace then
    return jsonb_build_object(
      'phase', 'grace',
      'recertify_on', v_recert,
      'grace_ends_on', v_recert + v_grace
    );
  end if;
  if p_day >= v_recert - v_warning and p_day <= v_recert then
    return jsonb_build_object(
      'phase', 'warning',
      'recertify_on', v_recert,
      'grace_ends_on', v_recert + v_grace
    );
  end if;
  return null;
end;
$$;

revoke all on function app.so_cert_banner(uuid, smallint, date) from public, anon, authenticated;

-- 8. Operator dashboard --------------------------------------------------------------

create or replace function app.so_refuse_view_as()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if app.is_impersonating() then
    raise exception 'view_as_read_only: View-as is read-only. Exit to let the operator do this.'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.so_refuse_view_as() from public, anon, authenticated;

create or replace function public.so_dashboard()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_viewer jsonb := app.so_viewer();
  v_op public.operator;
  v_pl public.placement;
  v_today date;
  v_yesterday date;
  v_local date;
  v_level smallint;
  v_today_card jsonb;
  v_yesterday_card jsonb;
  v_eod public.sales_eod;
  v_outcomes jsonb;
begin
  perform app.portal_view_audit('workspace');
  v_ws := public.so_workspace();
  select * into v_op from public.operator where profile_id = app.acting_profile();

  if v_ws ->> 'state' is distinct from 'active' then
    if v_ws ->> 'state' = 'paused' and v_op.id is not null then
      select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
      if v_pl.id is not null then
        v_local := (now() at time zone app.safe_tz(v_pl.time_zone))::date;
        v_level := app.so_certification_level(v_op.profile_id);
        return v_ws || jsonb_build_object(
          'viewer', v_viewer,
          'operator_id', v_op.id,
          );
      end if;
    end if;
    return v_ws || jsonb_build_object('viewer', v_viewer, 'operator_id', v_op.id);
  end if;

  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_today := app.so_work_date(v_pl, now());
  v_yesterday := app.so_previous_work_date(v_pl, v_today);
  v_local := (now() at time zone app.safe_tz(v_pl.time_zone))::date;
  v_level := app.so_certification_level(v_op.profile_id);
  perform app.so_sync_day(v_op.id, v_pl, v_today);

  v_today_card := app.so_eod_card(v_pl, v_today);
  v_yesterday_card := app.so_eod_card(v_pl, v_yesterday);
  if v_yesterday_card ->> 'status' not in ('late', 'draft', 'missed') then
    v_yesterday_card := null;
  end if;

  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_today;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id, 'name', o.name, 'definition', o.definition
         ) order by o.sort_order, o.name), '[]'::jsonb)
    into v_outcomes
  from public.placement_outcome_type o
  where o.placement_id = v_pl.id and o.active;

  return jsonb_build_object(
    'state', 'active',
    'operator_name', coalesce(nullif(btrim(v_op.name), ''), v_op.email),
    'operator_id', v_op.id,
    'certification_level', v_level,
    'viewer', v_viewer,
    'today', v_today,
    'yesterday', v_yesterday,
    'certification', app.so_cert_banner(v_op.profile_id, v_level, v_local),
    'quick_log_open', app.so_quick_log_open(v_pl, v_eod) and not app.is_impersonating(),
    'placement', jsonb_build_object(
      'id', v_pl.id,
      'client_name', (select cf.name from public.client_case_file cf where cf.id = v_pl.case_file_id),
      'manager_name', (select coalesce(nullif(btrim(p.full_name), ''), p.email) from public.profile p where p.id = v_pl.manager_profile_id),
      'placement_type', v_pl.placement_type,
      'time_zone', v_pl.time_zone,
      'working_days', to_jsonb(v_pl.working_days),
      'shift_start', v_pl.shift_start,
      'shift_end', v_pl.shift_end,
      'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
      'campaign_summary', v_pl.campaign_summary,
      'outcomes', v_outcomes
    ),
    'eod', jsonb_build_object('today', v_today_card, 'yesterday', v_yesterday_card)
  );
end;
$$;

revoke all on function public.so_dashboard() from public, anon;
grant execute on function public.so_dashboard() to authenticated;

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
  v_today_pending boolean;
  v_week_pending boolean;
  v_today_value numeric;
  v_week_value numeric;
  v_any boolean := p_metric.by_outcome;
begin
  v_target := app.so_target(p.id, p_metric.key, p_today);
  v_daily := case when v_target.daily is not null and v_target.daily > 0 then v_target.daily else null end;
  v_weekly := case when v_target.weekly is not null and v_target.weekly > 0 then v_target.weekly else null end;

  v_today_pending := p_metric.source = 'ghl' and not app.so_has_value(p.id, p_metric.key, 'ghl', p_today, p_today);
  v_week_pending := p_metric.source = 'ghl' and not app.so_has_value(p.id, p_metric.key, 'ghl', p_week_start, p_today);

  if p_metric.source = 'ghl' then
    v_today_value := case when v_today_pending then null else app.so_value_sum(p.id, p_metric.key, 'ghl', null, v_any, p_today, p_today) end;
    v_week_value := case when v_week_pending then null else app.so_value_sum(p.id, p_metric.key, 'ghl', null, v_any, p_week_start, p_today) end;
  else
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
    'today_display', case when v_today_pending then 'pending_sync' else 'number' end,
    'week_display', case when v_week_pending then 'pending_sync' else 'number' end,
    'today', v_today_value,
    'week', v_week_value,
    'target_today', v_daily,
    'target_week', v_weekly,
    'target_layer_today', case when v_daily is null then null else v_target.layer end,
    'target_layer_week', case when v_weekly is null then null else v_target.layer end,
    'pace_today', case when v_today_pending then null else app.so_pace(v_today_value, v_daily, p_day_fraction) end,
    'pace_week', case when v_week_pending then null else app.so_pace(v_week_value, v_weekly, p_week_fraction) end,
    'trend', case
      when p_metric.source = 'ghl' then app.so_trend(p.id, p_metric.key, 'ghl', null, v_any, p_trend)
      else app.so_trend(p.id, p_metric.key, 'operator', null, v_any, p_trend)
    end
  );
end;
$$;

revoke all on function app.so_metric_payload(public.placement, public.activity_metric, date, date, date[], numeric, numeric) from public, anon, authenticated;

create or replace function app.so_task_overdue(p_due date, p_time text, p_today date, p_tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_due is null then false
    when p_time is not null then ((p_due + p_time::time) at time zone app.safe_tz(p_tz)) < now()
    else p_due < p_today
  end;
$$;

revoke all on function app.so_task_overdue(date, text, date, text) from public, anon, authenticated;

create or replace function public.so_dashboard_board()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb := public.so_workspace();
  v_op public.operator;
  v_pl public.placement;
  v_today date;
  v_week_start date;
  v_week_end date;
  v_trend date[] := '{}';
  v_cursor date;
  v_guard integer := 0;
  v_day_fraction numeric;
  v_week_total numeric := 0;
  v_week_elapsed numeric := 0;
  v_week_fraction numeric := 0;
  v_eod public.sales_eod;
  v_open boolean;
  v_message text;
  v_outbound jsonb := '[]'::jsonb;
  v_ghl jsonb := '[]'::jsonb;
  v_follow jsonb := '[]'::jsonb;
  v_react jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_metric public.activity_metric;
  v_group text;
  v_payload jsonb;
  v_tasks jsonb;
  v_alerts jsonb;
  v_unread integer := 0;
  v_done integer := 0;
  v_outcomes jsonb;
  v_any boolean := false;
begin
  if v_ws ->> 'state' is distinct from 'active' then
    return jsonb_build_object(
      'state', v_ws ->> 'state',
      'view_as', app.is_impersonating(),
      'quick_log_open', false,
      'quick_log_message', null,
      'tasks', '[]'::jsonb,
      'done_today', 0,
      'alerts', '[]'::jsonb,
      'unread_alerts', 0,
      'any_logged', false,
      'groups', '[]'::jsonb,
      'outcomes', '[]'::jsonb
    );
  end if;

  select * into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_today := app.so_work_date(v_pl, now());
  perform app.so_sync_day(v_op.id, v_pl, v_today);

  v_week_start := date_trunc('week', v_today::timestamp)::date;
  v_week_end := v_week_start + 6;
  v_day_fraction := app.so_day_fraction(v_pl, v_today, now());

  select count(*)::numeric,
         coalesce(sum(case
           when g::date < v_today then 1::numeric
           when g::date = v_today then v_day_fraction
           else 0::numeric
         end), 0)
    into v_week_total, v_week_elapsed
  from generate_series(v_week_start, v_week_end, interval '1 day') g
  where extract(isodow from g)::smallint = any(v_pl.working_days)
    and g::date >= v_pl.start_date;
  if v_week_total > 0 then
    v_week_fraction := v_week_elapsed / v_week_total;
  end if;

  v_cursor := v_today;
  while coalesce(array_length(v_trend, 1), 0) < 7 and v_guard < 28 loop
    exit when v_cursor < v_pl.start_date;
    if extract(isodow from v_cursor)::smallint = any(v_pl.working_days) then
      v_trend := array[v_cursor] || v_trend;
    end if;
    v_cursor := v_cursor - 1;
    v_guard := v_guard + 1;
  end loop;

  for v_metric in
    select * from public.activity_metric where active order by sort_order, key
  loop
    v_group := app.so_metric_group(v_metric.key, v_metric.category);
    continue when v_group is null;
    continue when v_group in ('outbound', 'ghl') and not ('outbound_calling' = any(v_pl.activity_categories));
    continue when v_group = 'follow_up' and not ('follow_up' = any(v_pl.activity_categories));
    continue when v_group = 'reactivation' and not ('reactivation' = any(v_pl.activity_categories));
    continue when v_group = 'results' and not v_pl.tracks_results;
    v_payload := app.so_metric_payload(v_pl, v_metric, v_today, v_week_start, v_trend, v_day_fraction, v_week_fraction);
    if v_group = 'outbound' then v_outbound := v_outbound || jsonb_build_array(v_payload);
    elsif v_group = 'ghl' then v_ghl := v_ghl || jsonb_build_array(v_payload);
    elsif v_group = 'follow_up' then v_follow := v_follow || jsonb_build_array(v_payload);
    elsif v_group = 'reactivation' then v_react := v_react || jsonb_build_array(v_payload);
    elsif v_group = 'results' then v_results := v_results || jsonb_build_array(v_payload);
    end if;
  end loop;

  if jsonb_array_length(v_outbound) > 0 then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('key', 'outbound', 'label', app.so_group_label('outbound'), 'metrics', v_outbound));
  end if;
  if jsonb_array_length(v_ghl) > 0 then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('key', 'ghl', 'label', app.so_group_label('ghl'), 'metrics', v_ghl));
  end if;
  if jsonb_array_length(v_follow) > 0 then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('key', 'follow_up', 'label', app.so_group_label('follow_up'), 'metrics', v_follow));
  end if;
  if jsonb_array_length(v_react) > 0 then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('key', 'reactivation', 'label', app.so_group_label('reactivation'), 'metrics', v_react));
  end if;
  if jsonb_array_length(v_results) > 0 then
    v_groups := v_groups || jsonb_build_array(jsonb_build_object('key', 'results', 'label', app.so_group_label('results'), 'metrics', v_results));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'name', o.name,
           'today', app.so_value_sum(v_pl.id, 'positive_outcomes', 'operator', o.id, false, v_today, v_today),
           'week', app.so_value_sum(v_pl.id, 'positive_outcomes', 'operator', o.id, false, v_week_start, v_today),
           'trend', app.so_trend(v_pl.id, 'positive_outcomes', 'operator', o.id, false, v_trend)
         ) order by o.sort_order, o.name), '[]'::jsonb)
    into v_outcomes
  from public.placement_outcome_type o
  where o.placement_id = v_pl.id and o.active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'title', t.title,
           'note', nullif(t.detail, ''),
           'source', t.source,
           'created_by', case
             when t.source = 'system' or t.assigned_by is null then 'System'
             else coalesce(app.profile_name(t.assigned_by), 'Manager')
           end,
           'due_on', t.due_on,
           'due_time', t.due_time,
           'priority', t.priority,
           'overdue', app.so_task_overdue(t.due_on, t.due_time, v_today, v_pl.time_zone)
         ) order by
           case when app.so_task_overdue(t.due_on, t.due_time, v_today, v_pl.time_zone) then 0 else 1 end,
           case when t.priority = 'high' then 0 else 1 end,
           t.due_on nulls last,
           t.due_time nulls last,
           t.created_at
         ), '[]'::jsonb)
    into v_tasks
  from public.operator_task t
  where t.operator_id = v_op.id
    and t.placement_id = v_pl.id
    and t.completed_on is null
    and (t.due_on is null or t.due_on <= v_today);

  select count(*)::integer into v_done
  from public.operator_task t
  where t.operator_id = v_op.id and t.placement_id = v_pl.id and t.completed_on = v_today;

  select count(*)::integer into v_unread
  from public.operator_notification n
  where n.operator_id = v_op.id and n.read_at is null and n.kind = any(app.so_alert_kinds());

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'kind', n.kind,
           'type_label', app.so_alert_label(n.kind),
           'text', case when length(btrim(n.body)) > 0 then n.body else n.title end,
           'from', coalesce(
             case when n.created_by is not null then app.profile_name(n.created_by) end,
             nullif(btrim(n.sent_by), ''),
             'System'
           ),
           'created_at', n.created_at,
           'href', case when n.link_path like '/workspace/operator/workspace%' then n.link_path end
         ) order by n.created_at desc), '[]'::jsonb)
    into v_alerts
  from (
    select *
    from public.operator_notification
    where operator_id = v_op.id and read_at is null and kind = any(app.so_alert_kinds())
    order by created_at desc
    limit 3
  ) n;

  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_today;
  v_open := app.so_quick_log_open(v_pl, v_eod);
  if app.is_impersonating() then
    v_open := false;
    v_message := 'View-as is read-only. Exit to let the operator do this.';
  elsif not v_open then
    v_message := 'Today''s numbers are locked.';
  end if;

  select exists (
    select 1
    from public.activity_value v
    join public.activity_day d on d.id = v.activity_day_id
    where d.placement_id = v_pl.id and d.work_date = v_today and v.source = 'operator'
  ) into v_any;

  return jsonb_build_object(
    'state', 'active',
    'today', v_today,
    'week_start', v_week_start,
    'week_through', v_today,
    'view_as', app.is_impersonating(),
    'quick_log_open', v_open,
    'quick_log_message', v_message,
    'tasks', v_tasks,
    'done_today', v_done,
    'alerts', v_alerts,
    'unread_alerts', v_unread,
    'any_logged', v_any,
    'groups', v_groups,
    'outcomes', v_outcomes
  );
end;
$$;

revoke all on function public.so_dashboard_board() from public, anon;
grant execute on function public.so_dashboard_board() to authenticated;

-- 9. Operator writes -----------------------------------------------------------------

create or replace function public.so_log_activity(
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
  v_ws jsonb;
  v_op public.operator;
  v_pl public.placement;
  v_today date;
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
  perform app.so_sync_day(v_op.id, v_pl, v_today);
  select * into v_eod from public.sales_eod where placement_id = v_pl.id and work_date = v_today;
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

  select id into v_day from public.activity_day
  where operator_id = v_op.id and placement_id = v_pl.id and work_date = v_today;

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

revoke all on function public.so_log_activity(text, uuid, numeric, text) from public, anon;
grant execute on function public.so_log_activity(text, uuid, numeric, text) to authenticated;

create or replace function public.so_complete_task(p_task_id uuid)
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
  v_row public.operator_task;
  v_today date;
begin
  perform app.so_refuse_view_as();
  v_ws := public.so_workspace();
  if v_ws ->> 'state' is distinct from 'active' then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_op from public.operator where profile_id = app.acting_profile();
  select * into v_pl from public.placement where id = (v_ws #>> '{placement,id}')::uuid;
  v_today := app.so_work_date(v_pl, now());

  select * into v_row
  from public.operator_task
  where id = p_task_id and operator_id = v_op.id and placement_id = v_pl.id and completed_on is null
  for update;
  if v_row.id is null then
    raise exception 'task_not_found: that task is already done, or not yours' using errcode = 'P0002';
  end if;
  if v_row.source is distinct from 'manager' then
    raise exception 'system_task: this task completes itself. You cannot check it off.' using errcode = '42501';
  end if;

  update public.operator_task
     set completed_on = v_today, completed_at = now()
   where id = v_row.id;

  perform app.audit('workspace.task.completed', 'operator_task', v_row.id::text,
    format('Completed the task %s', v_row.title),
    null, jsonb_build_object('completed_on', v_today), v_pl.case_file_id, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.so_complete_task(uuid) from public, anon;
grant execute on function public.so_complete_task(uuid) to authenticated;

-- The existing portal check-off uses the same rule.
create or replace function public.portal_complete_task(p_task_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_row public.operator_task;
begin
  perform app.require('portal.tasks.complete');
  v_op := app.portal_operator();
  select * into v_row
  from public.operator_task
  where id = p_task_id and operator_id = v_op.id and completed_on is null
  for update;
  if v_row.id is null then
    raise exception 'task_not_found: that task is already done, or not yours' using errcode = 'P0002';
  end if;
  if v_row.source is distinct from 'manager' then
    raise exception 'system_task: this task completes itself. You cannot check it off.' using errcode = '42501';
  end if;
  update public.operator_task
     set completed_on = (now() at time zone app.safe_tz(v_op.time_zone))::date,
         completed_at = now()
   where id = v_row.id;
  perform app.audit('task.completed', 'operator_task', v_row.id::text, format('Completed the task %s', v_row.title),
    null, null, null, v_op.profile_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.so_mark_alerts_read(p_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_op public.operator;
  v_count integer;
begin
  perform app.so_refuse_view_as();
  v_ws := public.so_workspace();
  if v_ws ->> 'state' is distinct from 'active' then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_op from public.operator where profile_id = app.acting_profile();
  if p_id is not null and not exists (
    select 1 from public.operator_notification n
    where n.id = p_id and n.operator_id = v_op.id and n.kind = any(app.so_alert_kinds())
  ) then
    raise exception 'not_found: that alert is not yours' using errcode = 'P0002';
  end if;
  update public.operator_notification
     set read_at = now()
   where operator_id = v_op.id
     and read_at is null
     and kind = any(app.so_alert_kinds())
     and (p_id is null or id = p_id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.so_mark_alerts_read(uuid) from public, anon;
grant execute on function public.so_mark_alerts_read(uuid) to authenticated;

create or replace function public.so_alerts()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_op public.operator;
  v_rows jsonb;
begin
  perform app.portal_view_audit('workspace_alerts');
  v_ws := public.so_workspace();
  if v_ws ->> 'state' not in ('active', 'paused') then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  select * into v_op from public.operator where profile_id = app.acting_profile();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id,
           'kind', n.kind,
           'type_label', app.so_alert_label(n.kind),
           'text', case when length(btrim(n.body)) > 0 then n.body else n.title end,
           'from', coalesce(
             case when n.created_by is not null then app.profile_name(n.created_by) end,
             nullif(btrim(n.sent_by), ''),
             'System'
           ),
           'created_at', n.created_at,
           'read', n.read_at is not null,
           'href', case when n.link_path like '/workspace/operator/workspace%' then n.link_path end
         ) order by n.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select *
    from public.operator_notification
    where operator_id = v_op.id and kind = any(app.so_alert_kinds())
    order by created_at desc
    limit 200
  ) n;
  return v_rows;
end;
$$;

revoke all on function public.so_alerts() from public, anon;
grant execute on function public.so_alerts() to authenticated;

-- 10. EOD history, read-only ---------------------------------------------------------

create or replace function public.so_note_view(p_tab text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.portal_view_audit(left(coalesce(nullif(btrim(coalesce(p_tab, '')), ''), 'workspace'), 60));
end;
$$;

revoke all on function public.so_note_view(text) from public, anon;
grant execute on function public.so_note_view(text) to authenticated;

-- Banner data for the read-only screens. Does not write an audit row;
-- the screen's own read does that.
create or replace function public.so_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_zone text;
begin
  select * into v_op from public.operator where profile_id = app.acting_profile();
  select pl.time_zone into v_zone
  from public.placement pl
  where pl.operator_id = v_op.id and pl.placement_type is not null and pl.status in ('active', 'paused')
  order by (pl.status = 'active') desc, pl.created_at desc
  limit 1;
  return jsonb_build_object(
    'viewer', app.so_viewer(),
    'operator_id', v_op.id,
    'operator_name', coalesce(nullif(btrim(v_op.name), ''), v_op.email),
    'time_zone', v_zone
  );
end;
$$;

revoke all on function public.so_session() from public, anon;
grant execute on function public.so_session() to authenticated;

create or replace function public.so_eod_list()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ws jsonb;
  v_pl_id uuid;
  v_op uuid;
  v_rows jsonb;
begin
  perform app.portal_view_audit('workspace_history');
  v_ws := public.so_workspace();
  if v_ws ->> 'state' not in ('active', 'paused') then
    raise exception 'no_workspace: the workspace is not open on this account' using errcode = '42501';
  end if;
  v_pl_id := (v_ws #>> '{placement,id}')::uuid;
  select id into v_op from public.operator where profile_id = app.acting_profile();
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', e.id,
           'work_date', e.work_date,
           'status', e.status,
           'was_late', e.was_late,
           'has_feedback', exists (select 1 from public.sales_eod_feedback f where f.eod_id = e.id)
         ) order by e.work_date desc), '[]'::jsonb)
    into v_rows
  from public.sales_eod e
  where e.placement_id = v_pl_id and e.operator_id = v_op and e.status <> 'not_started';
  return v_rows;
end;
$$;

revoke all on function public.so_eod_list() from public, anon;
grant execute on function public.so_eod_list() to authenticated;

create or replace function app.so_eod_numbers(p public.placement, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb := '[]'::jsonb;
  v_metric public.activity_metric;
  v_group text;
  v_pending boolean;
  v_value numeric;
  v_outcome record;
begin
  for v_metric in select * from public.activity_metric where active and not by_outcome order by sort_order, key loop
    v_group := app.so_metric_group(v_metric.key, v_metric.category);
    continue when v_group is null;
    continue when v_group in ('outbound', 'ghl') and not ('outbound_calling' = any(p.activity_categories));
    continue when v_group = 'follow_up' and not ('follow_up' = any(p.activity_categories));
    continue when v_group = 'reactivation' and not ('reactivation' = any(p.activity_categories));
    continue when v_group = 'results' and not p.tracks_results;
    if v_metric.source = 'ghl' then
      v_pending := not app.so_has_value(p.id, v_metric.key, 'ghl', p_day, p_day);
      v_value := case when v_pending then null else app.so_value_sum(p.id, v_metric.key, 'ghl', null, false, p_day, p_day) end;
    else
      v_pending := false;
      v_value := app.so_value_sum(p.id, v_metric.key, 'operator', null, false, p_day, p_day);
    end if;
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'group', app.so_group_label(v_group),
      'label', v_metric.label,
      'unit', v_metric.unit,
      'display', case when v_pending then 'pending_sync' else 'number' end,
      'value', v_value
    ));
  end loop;

  if 'outbound_calling' = any(p.activity_categories) then
    for v_outcome in
      select id, name, sort_order from public.placement_outcome_type
      where placement_id = p.id and active order by sort_order, name
    loop
      v_rows := v_rows || jsonb_build_array(jsonb_build_object(
        'group', 'Outbound',
        'label', v_outcome.name,
        'unit', 'count',
        'display', 'number',
        'value', app.so_value_sum(p.id, 'positive_outcomes', 'operator', v_outcome.id, false, p_day, p_day)
      ));
    end loop;
  end if;
  return v_rows;
end;
$$;

revoke all on function app.so_eod_numbers(public.placement, date) from public, anon, authenticated;

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
           'author_kind', f.author_kind,
           'author_name', case f.author_kind
             when 'client' then 'Client'
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
    'hours_worked', v_eod.hours_worked,
    'note_to_manager', v_eod.note_to_manager,
    'numbers', app.so_eod_numbers(v_pl, v_eod.work_date),
    'feedback', v_feedback
  );
end;
$$;

revoke all on function public.so_eod_read(uuid) from public, anon;
grant execute on function public.so_eod_read(uuid) to authenticated;

-- 11. Staff tasks --------------------------------------------------------------------

create or replace function app.so_require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.so_require_staff() from public, anon, authenticated;

create or replace function public.so_task_roster()
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
      'placement_id', pl.id,
      'operator_id', o.id,
      'operator_name', o.name,
      'client_name', cf.name,
      'status', app.so_status_label(pl.status),
      'manager_name', coalesce(nullif(btrim(m.full_name), ''), m.email)
    ) order by o.name, cf.name)
    from public.placement pl
    join public.operator o on o.id = pl.operator_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    left join public.profile m on m.id = pl.manager_profile_id
    where pl.placement_type is not null
      and pl.status in ('draft', 'active', 'paused')
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_task_roster() from public, anon;
grant execute on function public.so_task_roster() to authenticated;

create or replace function public.so_task_list(p_placement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
begin
  perform app.so_require_staff();
  select * into v_pl from public.placement where id = p_placement_id and placement_type is not null;
  if v_pl.id is null then
    raise exception 'not_found: that is not a workspace placement' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'note', nullif(t.detail, ''),
      'source', t.source,
      'priority', t.priority,
      'due_on', t.due_on,
      'due_time', t.due_time,
      'status', case when t.completed_on is null then 'open' else 'done' end,
      'created_by', case
        when t.source = 'system' or t.assigned_by is null then 'System'
        else coalesce(app.profile_name(t.assigned_by), 'Manager')
      end,
      'created_at', t.created_at,
      'completed_on', t.completed_on
    ) order by (t.completed_on is null) desc, t.due_on nulls last, t.created_at desc)
    from (
      select * from public.operator_task
      where placement_id = p_placement_id
      order by (completed_on is null) desc, created_at desc
      limit 100
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.so_task_list(uuid) from public, anon;
grant execute on function public.so_task_list(uuid) to authenticated;

create or replace function public.so_save_task(
  p_id uuid,
  p_operator_id uuid,
  p_placement_id uuid,
  p_title text,
  p_note text,
  p_due_on date,
  p_due_time text,
  p_priority text,
  p_done boolean default false
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_old public.operator_task;
  v_new public.operator_task;
  v_title text := btrim(coalesce(p_title, ''));
  v_note text := coalesce(nullif(btrim(coalesce(p_note, '')), ''), '');
  v_time text := nullif(btrim(coalesce(p_due_time, '')), '');
  v_priority text := coalesce(nullif(btrim(coalesce(p_priority, '')), ''), 'normal');
  v_today date;
begin
  perform app.so_require_staff();
  if length(v_title) not between 3 and 140 then
    raise exception 'title_required: the task title needs 3 to 140 characters' using errcode = '23514';
  end if;
  if length(v_note) > 500 then
    raise exception 'invalid: the note stays under 500 characters' using errcode = '23514';
  end if;
  if v_priority not in ('normal', 'high') then
    raise exception 'invalid: priority is normal or high' using errcode = '23514';
  end if;
  if v_time is not null and v_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'invalid: due time is HH:MM' using errcode = '23514';
  end if;
  if v_time is not null and p_due_on is null then
    raise exception 'invalid: a due time needs a due date' using errcode = '23514';
  end if;

  if p_id is null then
    select * into v_pl from public.placement where id = p_placement_id and placement_type is not null;
    if v_pl.id is null or v_pl.operator_id is distinct from p_operator_id then
      raise exception 'not_found: that placement is not this operator''s' using errcode = 'P0002';
    end if;
    if v_pl.status not in ('draft', 'active', 'paused') then
      raise exception 'ended: that placement has ended' using errcode = '23514';
    end if;
    select * into v_op from public.operator where id = p_operator_id;
    v_today := app.so_work_date(v_pl, now());
    insert into public.operator_task (
      operator_id, placement_id, title, detail, due_on, due_time, source, priority, assigned_by,
      completed_on, completed_at
    ) values (
      p_operator_id, p_placement_id, v_title, v_note, p_due_on, v_time, 'manager', v_priority, auth.uid(),
      case when coalesce(p_done, false) then v_today else null end,
      case when coalesce(p_done, false) then now() else null end
    ) returning * into v_new;

    if v_new.completed_on is null then
      insert into public.operator_notification (
        operator_id, placement_id, severity, title, body, sent_by, kind, created_by, required, urgency
      ) values (
        p_operator_id, p_placement_id,
        case when v_priority = 'high' then 'important'::public.notification_severity else 'informational'::public.notification_severity end,
        'New task',
        v_title || case when v_note = '' then '' else '. ' || v_note end,
        coalesce(app.profile_name(auth.uid()), 'Manager'),
        'task_assigned', auth.uid(), false, 'normal'
      );
    end if;

    perform app.audit('workspace.task.created', 'operator_task', v_new.id::text,
      format('Created the task %s', v_title),
      null,
      jsonb_build_object('operator_id', p_operator_id, 'placement_id', p_placement_id, 'title', v_title, 'priority', v_priority, 'due_on', p_due_on, 'due_time', v_time),
      v_pl.case_file_id, v_op.profile_id);
    return v_new.id;
  end if;

  select * into v_old from public.operator_task where id = p_id for update;
  if v_old.id is null then
    raise exception 'not_found: that task does not exist' using errcode = 'P0002';
  end if;
  if v_old.source is distinct from 'manager' then
    raise exception 'system_task: system tasks are not edited by hand' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = v_old.placement_id;
  select * into v_op from public.operator where id = v_old.operator_id;
  v_today := case when v_pl.id is null then current_date else app.so_work_date(v_pl, now()) end;

  update public.operator_task set
    title = v_title,
    detail = v_note,
    due_on = p_due_on,
    due_time = v_time,
    priority = v_priority,
    completed_on = case
      when coalesce(p_done, false) then coalesce(completed_on, v_today)
      else null
    end,
    completed_at = case
      when coalesce(p_done, false) then coalesce(completed_at, now())
      else null
    end
  where id = p_id
  returning * into v_new;

  perform app.audit('workspace.task.updated', 'operator_task', v_new.id::text,
    format('Edited the task %s', v_title),
    jsonb_build_object('title', v_old.title, 'detail', v_old.detail, 'due_on', v_old.due_on, 'due_time', v_old.due_time, 'priority', v_old.priority, 'completed_on', v_old.completed_on),
    jsonb_build_object('title', v_new.title, 'detail', v_new.detail, 'due_on', v_new.due_on, 'due_time', v_new.due_time, 'priority', v_new.priority, 'completed_on', v_new.completed_on),
    v_pl.case_file_id, v_op.profile_id);
  return v_new.id;
end;
$$;

revoke all on function public.so_save_task(uuid, uuid, uuid, text, text, date, text, text, boolean) from public, anon;
grant execute on function public.so_save_task(uuid, uuid, uuid, text, text, date, text, text, boolean) to authenticated;

create or replace function public.so_delete_task(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.operator_task;
  v_pl public.placement;
  v_profile uuid;
begin
  perform app.so_require_staff();
  select * into v_row from public.operator_task where id = p_id for update;
  if v_row.id is null then
    raise exception 'not_found: that task does not exist' using errcode = 'P0002';
  end if;
  if v_row.source is distinct from 'manager' then
    raise exception 'system_task: system tasks are not deleted by hand' using errcode = '42501';
  end if;
  select * into v_pl from public.placement where id = v_row.placement_id;
  select profile_id into v_profile from public.operator where id = v_row.operator_id;
  perform app.audit('workspace.task.deleted', 'operator_task', v_row.id::text,
    format('Deleted the task %s', v_row.title),
    jsonb_build_object('title', v_row.title, 'operator_id', v_row.operator_id, 'placement_id', v_row.placement_id),
    null, v_pl.case_file_id, v_profile);
  delete from public.operator_task where id = v_row.id;
end;
$$;

revoke all on function public.so_delete_task(uuid) from public, anon;
grant execute on function public.so_delete_task(uuid) to authenticated;

-- 12. Settings gain the certification window -----------------------------------------

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
    'eod_hours_worked_enabled', 'eod_note_to_manager_enabled', 'client_feedback_token_days',
    'speed_to_lead_target_seconds', 'target_override_min_pct', 'target_override_max_pct',
    'cert_warning_days', 'cert_grace_days'];
  s jsonb := p_settings;
  v_warn integer;
  v_grace integer;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes workspace settings' using errcode = '42501';
  end if;

  select * into v_old from public.team_setting where id = 1 for update;
  v_warn := coalesce((s ->> 'cert_warning_days')::integer, v_old.cert_warning_days);
  v_grace := coalesce((s ->> 'cert_grace_days')::integer, v_old.cert_grace_days);
  if v_warn is null or v_warn not between 0 and 90 then
    raise exception 'invalid: the certification warning is between 0 and 90 days' using errcode = '23514';
  end if;
  if v_grace is null or v_grace not between 0 and 90 then
    raise exception 'invalid: the certification grace period is between 0 and 90 days' using errcode = '23514';
  end if;

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
    client_feedback_token_days = coalesce((s ->> 'client_feedback_token_days')::integer, client_feedback_token_days),
    speed_to_lead_target_seconds = case when s ? 'speed_to_lead_target_seconds' then (s ->> 'speed_to_lead_target_seconds')::integer else speed_to_lead_target_seconds end,
    target_override_min_pct = case when s ? 'target_override_min_pct' then (s ->> 'target_override_min_pct')::integer else target_override_min_pct end,
    target_override_max_pct = case when s ? 'target_override_max_pct' then (s ->> 'target_override_max_pct')::integer else target_override_max_pct end,
    cert_warning_days = v_warn,
    cert_grace_days = v_grace,
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
