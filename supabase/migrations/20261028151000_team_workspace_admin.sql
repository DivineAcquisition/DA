-- Team Workspace, the admin mirror of the operator workspace.
--
-- Reads the Sales Operator workspace records. It does not copy them.
-- Managers and DA Admin both see every operator. Mismatches, the GHL number
-- beside the logged number, pay, and GHL keys stay DA Admin only, in these
-- functions and in row security. The operator workspace address is the existing
-- team_setting.base_url, with room for a second live host and a retired host
-- that redirects.

-- 1. Settings ---------------------------------------------------------------------

alter table public.team_setting
  add column if not exists operator_workspace_also_active text[] not null default '{}',
  add column if not exists operator_workspace_retired text[] not null default '{}',
  add column if not exists team_workspace_refresh_minutes integer not null default 3,
  add column if not exists cert_warning_days integer not null default 14,
  add column if not exists cert_grace_days integer not null default 7,
  add column if not exists placement_review_months integer not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_setting_refresh_chk') then
    alter table public.team_setting add constraint team_setting_refresh_chk
      check (team_workspace_refresh_minutes between 1 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_setting_cert_warning_chk') then
    alter table public.team_setting add constraint team_setting_cert_warning_chk
      check (cert_warning_days between 0 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_setting_cert_grace_chk') then
    alter table public.team_setting add constraint team_setting_cert_grace_chk
      check (cert_grace_days between 0 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'team_setting_review_months_chk') then
    alter table public.team_setting add constraint team_setting_review_months_chk
      check (placement_review_months between 1 and 24);
  end if;
end
$$;

comment on column public.team_setting.base_url is
  'Canonical origin of the operator workspace. Emails, links, and redirects read this. Change it here when the host is renamed.';
comment on column public.team_setting.operator_workspace_also_active is
  'Extra origins that also serve the operator workspace during a changeover.';
comment on column public.team_setting.operator_workspace_retired is
  'Origins that redirect to base_url. A retired host no longer serves the workspace.';
comment on column public.team_setting.team_workspace_refresh_minutes is
  'How often the Team Workspace Today view reloads itself.';
comment on column public.team_setting.cert_warning_days is
  'Days before re-certification when the workspace shows a warning.';
comment on column public.team_setting.cert_grace_days is
  'Days after re-certification when access continues and the status is grace.';
comment on column public.team_setting.placement_review_months is
  'Review date is the placement start plus this many months. It is not the term end.';

-- 2. Quick-log history -------------------------------------------------------------

create table if not exists public.activity_value_change (
  id uuid primary key default gen_random_uuid(),
  activity_day_id uuid not null references public.activity_day (id) on delete cascade,
  metric_key text not null,
  outcome_type_id uuid,
  source text not null check (source in ('operator', 'ghl')),
  previous_value numeric(14, 2),
  new_value numeric(14, 2) not null,
  changed_by uuid references public.profile (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists activity_value_change_day_idx
  on public.activity_value_change (activity_day_id, changed_at desc);

comment on table public.activity_value_change is
  'Every change to a logged number, with the time. Append only. The Team Workspace reads it; nothing edits it.';

create or replace function app.so_record_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke all on function app.so_record_activity_change() from public, anon, authenticated;

drop trigger if exists activity_value_history on public.activity_value;
create trigger activity_value_history
  after insert or update of value on public.activity_value
  for each row execute function app.so_record_activity_change();

drop trigger if exists activity_value_change_append_only on public.activity_value_change;
create trigger activity_value_change_append_only
  before update or delete on public.activity_value_change
  for each row execute function app.so_append_only();

alter table public.activity_value_change enable row level security;
revoke all on public.activity_value_change from anon, authenticated;
grant select on public.activity_value_change to authenticated;

drop policy if exists activity_value_change_admin_read on public.activity_value_change;
create policy activity_value_change_admin_read on public.activity_value_change
  for select to authenticated using (app.is_admin());

drop policy if exists activity_value_change_manager_read on public.activity_value_change;
create policy activity_value_change_manager_read on public.activity_value_change
  for select to authenticated
  using (
    source = 'operator'
    and exists (
      select 1 from public.activity_day d
      where d.id = activity_day_id and app.so_manages_placement(d.placement_id)
    )
  );

-- Managers read the number the operator logged. The GHL number is DA Admin only.
drop policy if exists activity_value_manager_read on public.activity_value;
create policy activity_value_manager_read on public.activity_value
  for select to authenticated
  using (
    source = 'operator'
    and exists (
      select 1 from public.activity_day d
      where d.id = activity_day_id and app.so_manages_placement(d.placement_id)
    )
  );

-- 3. Helpers -----------------------------------------------------------------------

create or replace function app.so_require_team_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.is_admin();
begin
  if not v_admin and not app.is_manager() then
    raise exception 'permission_denied: managers and DA Admin only' using errcode = '42501';
  end if;
  return v_admin;
end;
$$;

revoke all on function app.so_require_team_staff() from public, anon, authenticated;

create or replace function app.so_origin(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := regexp_replace(btrim(coalesce(p, '')), '/+$', '');
begin
  if v = '' then
    return null;
  end if;
  if v !~* '^https?://' then
    v := 'https://' || v;
  end if;
  if v !~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]+)?$' then
    raise exception 'invalid_domain: enter a host only, with no path' using errcode = '23514';
  end if;
  return lower(v);
end;
$$;

revoke all on function app.so_origin(text) from public, anon, authenticated;

create or replace function app.so_local_minutes(p_tz text)
returns integer
language sql
stable
set search_path = ''
as $$
  select (
    extract(hour from (now() at time zone app.safe_tz(p_tz))) * 60
    + extract(minute from (now() at time zone app.safe_tz(p_tz)))
  )::integer;
$$;

revoke all on function app.so_local_minutes(text) from public, anon, authenticated;

-- On shift uses the existing shift window. Off shift is a working day outside
-- that window. Anything else is not a working day. The placement time zone decides.
create or replace function app.so_shift_status(p public.placement)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when app.on_shift_now(p) then 'on_shift'
    when extract(isodow from app.placement_today(p))::smallint = any (p.working_days) then 'off_shift'
    else 'not_working_day'
  end;
$$;

revoke all on function app.so_shift_status(public.placement) from public, anon, authenticated;

create or replace function app.so_cert_info(p_profile_id uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_warn integer;
  v_grace integer;
  v_level smallint;
  v_on date;
  v_state text;
begin
  if p_profile_id is null then
    return jsonb_build_object('state', 'none', 'level', null, 'recertify_on', null);
  end if;
  select s.cert_warning_days, s.cert_grace_days into v_warn, v_grace
  from public.team_setting s where s.id = 1;
  v_warn := coalesce(v_warn, 14);
  v_grace := coalesce(v_grace, 7);
  select c.level, c.recertify_on into v_level, v_on
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = p_profile_id
    and e.status <> 'withdrawn'
    and c.level >= 1
  order by (c.recertify_on is null or c.recertify_on + v_grace >= p_day) desc,
           c.level desc, c.recertify_on desc nulls last
  limit 1;
  if v_level is null then
    return jsonb_build_object('state', 'none', 'level', null, 'recertify_on', null);
  end if;
  if v_on is null or v_on > p_day + v_warn then
    v_state := 'current';
  elsif v_on >= p_day then
    v_state := 'warning';
  elsif v_on + v_grace >= p_day then
    v_state := 'grace';
  else
    v_state := 'lapsed';
  end if;
  return jsonb_build_object('state', v_state, 'level', v_level, 'recertify_on', v_on);
end;
$$;

revoke all on function app.so_cert_info(uuid, date) from public, anon, authenticated;

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
    'key', v_metric.key,
    'label', v_metric.label,
    'operator', v_operator,
    'daily_target', v_daily,
    'weekly_target', v_weekly,
    'pace', v_metric.source <> 'ghl' and v_metric.operator_editable
  );
  if p_admin then
    select sum(val.value) into v_ghl from public.activity_value val
    where val.activity_day_id = v_day and val.metric_key = p_key and val.source = 'ghl';
    v_row := v_row || jsonb_build_object('ghl', v_ghl);
  end if;
  return v_row;
end;
$$;

revoke all on function app.so_team_metric(uuid, date, text, boolean) from public, anon, authenticated;

create or replace function app.so_team_placement_row(p public.placement, p_admin boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_client text;
  v_manager text;
  v_day date := app.placement_today(p);
  v_cert jsonb;
  v_last timestamptz;
  v_kind text;
  v_open integer;
  v_overdue integer;
  v_unread integer;
  v jsonb;
begin
  select * into v_op from public.operator where id = p.operator_id;
  select cf.name into v_client from public.client_case_file cf where cf.id = p.case_file_id;
  select coalesce(nullif(btrim(m.full_name), ''), m.email) into v_manager
  from public.profile m where m.id = p.manager_profile_id;
  v_cert := app.so_cert_info(v_op.profile_id, v_day);

  select x.at, x.kind into v_last, v_kind
  from (
    select d.operator_updated_at as at, 'quick_log' as kind
    from public.activity_day d
    where d.operator_id = p.operator_id and d.placement_id = p.id and d.operator_updated_at is not null
    union all
    select ev.at, 'task'
    from public.audit_event ev
    join public.operator_task t on t.id::text = ev.entity_id
    where ev.action = 'task.completed' and t.operator_id = p.operator_id
    union all
    select l.at, 'sign_in'
    from public.login_event l
    where l.profile_id = v_op.profile_id and l.outcome = 'success'
    union all
    select ev.at, 'workspace'
    from public.audit_event ev
    where ev.action in ('workspace.opened', 'portal.opened') and ev.actor_profile_id = v_op.profile_id
  ) x
  where x.at is not null
  order by x.at desc
  limit 1;

  select count(*) filter (where t.completed_on is null),
         count(*) filter (where t.completed_on is null and t.due_on is not null and t.due_on < v_day)
    into v_open, v_overdue
  from public.operator_task t where t.operator_id = p.operator_id;
  select count(*) into v_unread from public.operator_notification n
  where n.operator_id = p.operator_id and n.read_at is null;

  v := jsonb_build_object(
    'operator_id', p.operator_id,
    'name', v_op.name,
    'email', v_op.email,
    'phone', v_op.phone,
    'placement_id', p.id,
    'client_id', p.case_file_id,
    'client_name', v_client,
    'placement_type', p.placement_type,
    'placement_status', p.status,
    'manager_id', p.manager_profile_id,
    'manager_name', v_manager,
    'shift_status', app.so_shift_status(p),
    'time_zone', p.time_zone,
    'shift_start', p.shift_start,
    'shift_end', p.shift_end,
    'local_minutes', app.so_local_minutes(p.time_zone),
    'working_day', extract(isodow from v_day)::smallint = any (p.working_days) or app.on_shift_now(p),
    'eod_status', coalesce((select e.status from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), 'not_started'),
    'was_late', coalesce((select e.was_late from public.sales_eod e where e.placement_id = p.id and e.work_date = v_day), false),
    'last_activity_at', v_last,
    'last_activity_kind', v_kind,
    'tasks_open', v_open,
    'tasks_overdue', v_overdue,
    'alerts_unread', v_unread,
    'certification', v_cert ->> 'state',
    'recertify_on', v_cert -> 'recertify_on',
    'metrics', (
      select coalesce(jsonb_agg(app.so_team_metric(p.id, v_day, k.metric_key, p_admin) order by k.ord), '[]'::jsonb)
      from (values
        ('conversations_held', 1),
        ('positive_outcomes', 2),
        ('texts_sent', 3),
        ('emails_sent', 4),
        ('reactivated_bookings', 5)
      ) as k(metric_key, ord)
    )
  );
  if p_admin then
    v := v || jsonb_build_object(
      'open_mismatch', exists (
        select 1 from public.activity_mismatch mm
        where mm.operator_id = p.operator_id and mm.status = 'open'
      )
    );
  end if;
  return v;
end;
$$;

revoke all on function app.so_team_placement_row(public.placement, boolean) from public, anon, authenticated;

-- 4. Reads -------------------------------------------------------------------------

create or replace function public.so_operator_workspace_hosts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'origin', s.base_url,
    'also_active', s.operator_workspace_also_active,
    'retired', s.operator_workspace_retired
  )
  from public.team_setting s
  where s.id = 1;
$$;

comment on function public.so_operator_workspace_hosts() is
  'Public host names for the operator workspace. No account data. The proxy uses it for links and redirects.';

revoke all on function public.so_operator_workspace_hosts() from public;
grant execute on function public.so_operator_workspace_hosts() to anon, authenticated;

create or replace function public.so_team_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_rows jsonb;
  v_summary jsonb;
  v_setting public.team_setting;
begin
  select coalesce(jsonb_agg(app.so_team_placement_row(pl, v_admin) order by o.name), '[]'::jsonb)
    into v_rows
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  where pl.placement_type is not null and pl.status in ('active', 'paused');

  select * into v_setting from public.team_setting where id = 1;

  v_summary := jsonb_build_object(
    'on_shift', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'shift_status' = 'on_shift'),
    'off_shift', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'shift_status' = 'off_shift'),
    'not_working_day', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'shift_status' = 'not_working_day'),
    'eod', jsonb_build_object(
      'submitted', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'eod_status' = 'submitted'),
      'draft', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'eod_status' = 'draft'),
      'not_started', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'eod_status' = 'not_started'),
      'late', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'eod_status' = 'late'),
      'missed', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'eod_status' = 'missed')
    ),
    'overdue_tasks', coalesce((select sum((r ->> 'tasks_overdue')::int) from jsonb_array_elements(v_rows) r), 0),
    'unread_alerts', coalesce((select sum((r ->> 'alerts_unread')::int) from jsonb_array_elements(v_rows) r), 0)
  );
  if v_admin then
    v_summary := v_summary || jsonb_build_object(
      'open_mismatches', (select count(*) from public.activity_mismatch mm where mm.status = 'open')
    );
  end if;

  return jsonb_build_object(
    'is_admin', v_admin,
    'refreshed_at', now(),
    'refresh_minutes', v_setting.team_workspace_refresh_minutes,
    'summary', v_summary,
    'operators', v_rows
  ) || case when v_admin then jsonb_build_object(
    'domain', jsonb_build_object(
      'origin', v_setting.base_url,
      'also_active', v_setting.operator_workspace_also_active,
      'retired', v_setting.operator_workspace_retired
    )
  ) else '{}'::jsonb end;
end;
$$;

revoke all on function public.so_team_today() from public, anon;
grant execute on function public.so_team_today() to authenticated;

create or replace function public.so_team_operators()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_rows jsonb;
begin
  select coalesce(jsonb_agg(
    case
      when picked.pl is null then jsonb_build_object(
        'operator_id', o.id,
        'name', o.name,
        'email', o.email,
        'phone', o.phone,
        'placement_id', null,
        'client_name', null,
        'placement_type', null,
        'placement_status', null,
        'manager_id', null,
        'manager_name', null,
        'shift_status', null,
        'time_zone', o.time_zone,
        'shift_start', null,
        'shift_end', null,
        'local_minutes', null,
        'working_day', false,
        'eod_status', null,
        'was_late', false,
        'last_activity_at', (
          select max(l.at) from public.login_event l
          where l.profile_id = o.profile_id and l.outcome = 'success'
        ),
        'last_activity_kind', case
          when exists (
            select 1 from public.login_event l
            where l.profile_id = o.profile_id and l.outcome = 'success'
          ) then 'sign_in'
          else null
        end,
        'tasks_open', (select count(*) from public.operator_task t where t.operator_id = o.id and t.completed_on is null),
        'tasks_overdue', (select count(*) from public.operator_task t where t.operator_id = o.id and t.completed_on is null and t.due_on is not null and t.due_on < current_date),
        'alerts_unread', (select count(*) from public.operator_notification n where n.operator_id = o.id and n.read_at is null),
        'certification', app.so_cert_info(o.profile_id, current_date) ->> 'state',
        'recertify_on', app.so_cert_info(o.profile_id, current_date) -> 'recertify_on',
        'metrics', '[]'::jsonb
      )
      else app.so_team_placement_row(picked.pl, v_admin)
    end
    order by o.name), '[]'::jsonb)
    into v_rows
  from public.operator o
  left join lateral (
    select p as pl
    from public.placement p
    where p.operator_id = o.id and p.placement_type is not null
    order by case p.status when 'active' then 0 when 'paused' then 1 when 'draft' then 2 else 3 end, p.start_date desc
    limit 1
  ) picked on true;

  return jsonb_build_object('is_admin', v_admin, 'operators', v_rows);
end;
$$;

revoke all on function public.so_team_operators() from public, anon;
grant execute on function public.so_team_operators() to authenticated;

create or replace function public.so_team_operator(p_operator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_op public.operator;
  v_pl public.placement;
  v_day date;
  v_week date;
  v_prev date;
  v_cert jsonb;
  v_months integer;
  v jsonb;
  v_placed boolean;
begin
  select * into v_op from public.operator where id = p_operator_id;
  if not found then
    raise exception 'not_found: that operator is not on the roster' using errcode = 'P0002';
  end if;
  select p.* into v_pl from public.placement p
  where p.operator_id = v_op.id and p.placement_type is not null
  order by case p.status when 'active' then 0 when 'paused' then 1 when 'draft' then 2 else 3 end, p.start_date desc
  limit 1;
  v_placed := found;

  v_day := case when v_placed then app.placement_today(v_pl) else current_date end;
  v_week := date_trunc('week', v_day)::date;
  v_prev := v_week - 7;
  v_cert := app.so_cert_info(v_op.profile_id, v_day);
  select placement_review_months into v_months from public.team_setting where id = 1;

  v := jsonb_build_object(
    'is_admin', v_admin,
    'operator', jsonb_build_object(
      'id', v_op.id,
      'name', v_op.name,
      'email', v_op.email,
      'phone', v_op.phone,
      'handle', v_op.handle,
      'has_account', v_op.profile_id is not null,
      'certification_level', (v_cert ->> 'level')::int,
      'certification', v_cert ->> 'state',
      'recertify_on', v_cert -> 'recertify_on'
    ),
    'tasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'detail', nullif(t.detail, ''),
        'due_on', t.due_on, 'completed_on', t.completed_on,
        'overdue', t.completed_on is null and t.due_on is not null and t.due_on < v_day
      ) order by t.completed_on nulls first, t.due_on nulls last, t.created_at desc)
      from public.operator_task t where t.operator_id = v_op.id
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'title', n.title, 'body', n.body, 'kind', n.kind,
        'created_at', n.created_at, 'read_at', n.read_at,
        'from', coalesce(app.profile_name(n.created_by), n.sent_by)
      ) order by n.created_at desc)
      from (
        select * from public.operator_notification n
        where n.operator_id = v_op.id
        order by n.created_at desc
        limit 40
      ) n
    ), '[]'::jsonb),
    'placements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'client_name', cf.name, 'status', p.status,
        'start_date', p.start_date, 'end_date', p.end_date, 'closed_on', p.closed_on
      ) order by p.start_date desc)
      from public.placement p
      join public.client_case_file cf on cf.id = p.case_file_id
      where p.operator_id = v_op.id
    ), '[]'::jsonb),
    'eods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'work_date', e.work_date, 'status', e.status, 'was_late', e.was_late,
        'submitted_at', e.submitted_at,
        'feedback_count', (select count(*) from public.sales_eod_feedback f where f.eod_id = e.id),
        'client_name', cf.name
      ) order by e.work_date desc)
      from public.sales_eod e
      join public.placement p on p.id = e.placement_id
      join public.client_case_file cf on cf.id = p.case_file_id
      where e.operator_id = v_op.id
    ), '[]'::jsonb)
  );

  if not v_placed then
    v := v || jsonb_build_object(
      'placement', null, 'today', '[]'::jsonb, 'week', '[]'::jsonb, 'days', '[]'::jsonb,
      'quick_log', '[]'::jsonb, 'targets', '[]'::jsonb,
      'override_min_pct', null, 'override_max_pct', null
    );
  else
    v := v || jsonb_build_object(
      'placement', jsonb_build_object(
        'id', v_pl.id,
        'client_name', (select name from public.client_case_file where id = v_pl.case_file_id),
        'placement_type', v_pl.placement_type,
        'status', v_pl.status,
        'manager_name', (select coalesce(nullif(btrim(m.full_name), ''), m.email) from public.profile m where m.id = v_pl.manager_profile_id),
        'time_zone', v_pl.time_zone,
        'shift_start', v_pl.shift_start,
        'shift_end', v_pl.shift_end,
        'working_days', v_pl.working_days,
        'eod_deadline', coalesce(v_pl.eod_deadline, v_pl.shift_end),
        'start_date', v_pl.start_date,
        'review_on', (v_pl.start_date + make_interval(months => coalesce(v_months, 3)))::date,
        'local_minutes', app.so_local_minutes(v_pl.time_zone),
        'shift_status', app.so_shift_status(v_pl)
      ),
      'today', (
        select coalesce(jsonb_agg(app.so_team_metric(v_pl.id, v_day, m.key, v_admin) order by m.sort_order), '[]'::jsonb)
        from public.activity_metric m
        where m.active and (
          (m.category in ('outbound', 'timing') and 'outbound_calling' = any (v_pl.activity_categories))
          or (m.category = 'follow_up' and 'follow_up' = any (v_pl.activity_categories))
          or (m.category = 'reactivation' and 'reactivation' = any (v_pl.activity_categories))
          or (m.category = 'results' and v_pl.tracks_results)
        )
      ),
      'week', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'key', m.key,
          'label', m.label,
          'operator', cur.total,
          'previous', prev.total,
          'trend', case
            when cur.total is null and prev.total is null then null
            when coalesce(cur.total, 0) > coalesce(prev.total, 0) then 'up'
            when coalesce(cur.total, 0) < coalesce(prev.total, 0) then 'down'
            else 'flat'
          end,
          'daily_target', tgt.daily,
          'weekly_target', tgt.weekly,
          'ghl', case when v_admin then cur.ghl else null end,
          'pace', m.source <> 'ghl' and m.operator_editable
        )) order by m.sort_order)
        from public.activity_metric m
        left join lateral (
          select sum(val.value) filter (where val.source = 'operator') as total,
                 sum(val.value) filter (where val.source = 'ghl') as ghl
          from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and d.work_date >= v_week and d.work_date <= v_day and val.metric_key = m.key
        ) cur on true
        left join lateral (
          select sum(val.value) filter (where val.source = 'operator') as total
          from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and d.work_date >= v_prev and d.work_date < v_week and val.metric_key = m.key
        ) prev on true
        left join lateral (
          select t.daily, t.weekly from app.so_target(v_pl.id, m.key, v_day) t
        ) tgt on true
        where m.active and (
          (m.category in ('outbound', 'timing') and 'outbound_calling' = any (v_pl.activity_categories))
          or (m.category = 'follow_up' and 'follow_up' = any (v_pl.activity_categories))
          or (m.category = 'reactivation' and 'reactivation' = any (v_pl.activity_categories))
          or (m.category = 'results' and v_pl.tracks_results)
        )
      ), '[]'::jsonb),
      'days', coalesce((
        select jsonb_agg(jsonb_build_object('date', gs.day, 'conversations', logged.total) order by gs.day)
        from generate_series(v_day - 6, v_day, interval '1 day') gs(day)
        left join lateral (
          select sum(val.value) as total
          from public.activity_value val
          join public.activity_day d on d.id = val.activity_day_id
          where d.placement_id = v_pl.id and d.work_date = gs.day::date
            and val.metric_key = 'conversations_held' and val.source = 'operator'
        ) logged on true
      ), '[]'::jsonb),
      'quick_log', coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'at', c.changed_at,
          'label', m.label,
          'previous', c.previous_value,
          'value', c.new_value,
          'source', case when v_admin then c.source else null end,
          'by', app.profile_name(c.changed_by)
        )) order by c.changed_at desc)
        from (
          select c.*
          from public.activity_value_change c
          join public.activity_day d on d.id = c.activity_day_id
          where d.operator_id = v_op.id and (v_admin or c.source = 'operator')
          order by c.changed_at desc
          limit 80
        ) c
        join public.activity_metric m on m.key = c.metric_key
      ), '[]'::jsonb),
      'targets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'metric_key', m.key,
          'label', m.label,
          'daily', tgt.daily,
          'weekly', tgt.weekly,
          'layer', tgt.layer,
          'set_by', app.profile_name(tgt.set_by),
          'set_at', tgt.set_at,
          'default_daily', def.daily,
          'default_weekly', def.weekly
        ) order by m.sort_order)
        from public.activity_metric m
        left join lateral (
          select t.daily, t.weekly, t.layer, t.set_by, t.set_at
          from app.so_target(v_pl.id, m.key, v_day) t
        ) tgt on true
        left join lateral (
          select t.daily, t.weekly from app.so_default_target(v_pl.placement_type, m.key, v_day) t
        ) def on true
        where m.active and m.operator_editable and (
          (m.category in ('outbound', 'timing') and 'outbound_calling' = any (v_pl.activity_categories))
          or (m.category = 'follow_up' and 'follow_up' = any (v_pl.activity_categories))
          or (m.category = 'reactivation' and 'reactivation' = any (v_pl.activity_categories))
          or (m.category = 'results' and v_pl.tracks_results)
        )
      ), '[]'::jsonb),
      'override_min_pct', (select target_override_min_pct from public.team_setting where id = 1),
      'override_max_pct', (select target_override_max_pct from public.team_setting where id = 1)
    );
  end if;

  if v_admin then
    v := v || jsonb_build_object('mismatches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mm.id, 'work_date', mm.work_date, 'metric_key', mm.metric_key,
        'label', m.label, 'operator_value', mm.operator_value, 'ghl_value', mm.ghl_value,
        'gap', mm.gap, 'status', mm.status
      ) order by mm.work_date desc, m.sort_order)
      from public.activity_mismatch mm
      join public.activity_metric m on m.key = mm.metric_key
      where mm.operator_id = v_op.id
    ), '[]'::jsonb));
  end if;
  return v;
end;
$$;

revoke all on function public.so_team_operator(uuid) from public, anon;
grant execute on function public.so_team_operator(uuid) to authenticated;

create or replace function public.so_team_eods(
  p_from date default null,
  p_to date default null,
  p_status text default null,
  p_operator_id uuid default null,
  p_manager_id uuid default null,
  p_client_id uuid default null,
  p_has_feedback boolean default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
begin
  return jsonb_build_object('is_admin', v_admin, 'eods', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'operator_id', e.operator_id,
      'operator_name', o.name,
      'client_id', pl.case_file_id,
      'client_name', cf.name,
      'manager_id', pl.manager_profile_id,
      'manager_name', coalesce(nullif(btrim(m.full_name), ''), m.email),
      'work_date', e.work_date,
      'status', e.status,
      'submitted_at', e.submitted_at,
      'was_late', e.was_late,
      'feedback_count', (select count(*) from public.sales_eod_feedback f where f.eod_id = e.id)
    ) order by e.work_date desc, o.name)
    from public.sales_eod e
    join public.operator o on o.id = e.operator_id
    join public.placement pl on pl.id = e.placement_id
    join public.client_case_file cf on cf.id = pl.case_file_id
    left join public.profile m on m.id = pl.manager_profile_id
    where (
      (p_from is null and p_to is null and e.work_date >= app.placement_today(pl) - 1 and e.work_date <= app.placement_today(pl))
      or (p_from is not null and e.work_date >= p_from and (p_to is null or e.work_date <= p_to))
      or (p_from is null and p_to is not null and e.work_date <= p_to)
    )
      and (p_status is null or e.status = p_status)
      and (p_operator_id is null or e.operator_id = p_operator_id)
      and (p_manager_id is null or pl.manager_profile_id = p_manager_id)
      and (p_client_id is null or pl.case_file_id = p_client_id)
      and (p_has_feedback is null or p_has_feedback = exists (
        select 1 from public.sales_eod_feedback f where f.eod_id = e.id
      ))
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.so_team_eods(date, date, text, uuid, uuid, uuid, boolean) from public, anon;
grant execute on function public.so_team_eods(date, date, text, uuid, uuid, uuid, boolean) to authenticated;

create or replace function public.so_team_eod(p_eod_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_eod public.sales_eod;
  v_pl public.placement;
begin
  select * into v_eod from public.sales_eod where id = p_eod_id;
  if v_eod.id is null then
    raise exception 'not_found: that EOD is not on file' using errcode = 'P0002';
  end if;
  select * into v_pl from public.placement where id = v_eod.placement_id;
  return jsonb_build_object(
    'is_admin', v_admin,
    'id', v_eod.id,
    'operator_id', v_eod.operator_id,
    'operator_name', (select name from public.operator where id = v_eod.operator_id),
    'client_name', (select name from public.client_case_file where id = v_pl.case_file_id),
    'manager_name', (select coalesce(nullif(btrim(m.full_name), ''), m.email) from public.profile m where m.id = v_pl.manager_profile_id),
    'work_date', v_eod.work_date,
    'status', v_eod.status,
    'was_late', v_eod.was_late,
    'submitted_at', v_eod.submitted_at,
    'deadline_at', v_eod.deadline_at,
    'time_zone', v_pl.time_zone,
    'wins', v_eod.wins,
    'blockers', v_eod.blockers,
    'tomorrow_plan', v_eod.tomorrow_plan,
    'hours_worked', v_eod.hours_worked,
    'note_to_manager', v_eod.note_to_manager,
    'numbers', (
      select coalesce(jsonb_agg(app.so_team_metric(v_pl.id, v_eod.work_date, m.key, v_admin) order by m.sort_order), '[]'::jsonb)
      from public.activity_metric m
      where m.active and (
        (m.category in ('outbound', 'timing') and 'outbound_calling' = any (v_pl.activity_categories))
        or (m.category = 'follow_up' and 'follow_up' = any (v_pl.activity_categories))
        or (m.category = 'reactivation' and 'reactivation' = any (v_pl.activity_categories))
        or (m.category = 'results' and v_pl.tracks_results)
      )
    ),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'author_kind', f.author_kind,
        'author_name', case when f.author_kind = 'client' then 'Client' else app.profile_name(f.author_profile_id) end,
        'body', f.body,
        'rating', f.rating,
        'created_at', f.created_at
      ) order by f.created_at)
      from public.sales_eod_feedback f where f.eod_id = v_eod.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.so_team_eod(uuid) is
  'Read-only EOD. Feedback actions and the client link are later prompts; this returns the report and the feedback already on it.';

revoke all on function public.so_team_eod(uuid) from public, anon;
grant execute on function public.so_team_eod(uuid) to authenticated;

drop function if exists public.so_team_activity(uuid, uuid, text, date, date, text);

create or replace function public.so_team_activity(
  p_operator_id uuid default null,
  p_actor_id uuid default null,
  p_type text default null,
  p_from date default null,
  p_to date default null,
  p_zone text default null,
  p_actor_name text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_zone text := app.safe_tz(p_zone);
begin
  return jsonb_build_object('is_admin', v_admin, 'events', coalesce((
    select jsonb_agg(to_jsonb(ev) order by ev.at desc)
    from (
      select * from (
        select
          'ql:' || c.id::text as id,
          c.changed_at as at,
          'quick_log'::text as type,
          format('%s %s → %s', m.label, coalesce(to_char(c.previous_value, 'FM999999990.##'), '—'), to_char(c.new_value, 'FM999999990.##')) as summary,
          c.changed_by as actor_id,
          app.profile_name(c.changed_by) as actor_name,
          d.operator_id,
          o.name as operator_name
        from public.activity_value_change c
        join public.activity_day d on d.id = c.activity_day_id
        join public.activity_metric m on m.key = c.metric_key
        join public.operator o on o.id = d.operator_id
        where v_admin or c.source = 'operator'
        union all
        select
          'login:' || l.id::text,
          l.at,
          'sign_in',
          'Signed in',
          l.profile_id,
          app.profile_name(l.profile_id),
          o.id,
          o.name
        from public.login_event l
        join public.operator o on o.profile_id = l.profile_id
        where l.outcome = 'success'
        union all
        select
          'read:' || n.id::text,
          n.read_at,
          'alert',
          format('Read “%s”', n.title),
          o.profile_id,
          o.name,
          o.id,
          o.name
        from public.operator_notification n
        join public.operator o on o.id = n.operator_id
        where n.read_at is not null
        union all
        select
          'audit:' || a.id::text,
          a.at,
          case
            when a.action like 'task.%' or a.action = 'workspace.task.created' then 'task'
            when a.action like 'workspace.eod.%' then 'eod'
            when a.action like 'workspace.placement.%' or a.action like 'workspace.outcome.%' then 'placement'
            when a.action like 'workspace.target.%' then 'target'
            when a.action in ('workspace.settings', 'workspace.domain') then 'settings'
            when a.action like 'workspace.alert.%' then 'alert'
            when a.action like 'view_as.%' or a.action = 'impersonation.ended' then 'view_as'
            when a.action = 'account.role_changed' then 'role'
            else null
          end,
          a.summary,
          a.actor_profile_id,
          app.profile_name(a.actor_profile_id),
          o.id,
          o.name
        from public.audit_event a
        left join public.operator o on o.profile_id = a.acting_as_profile_id
        where (v_admin or a.action not ilike '%mismatch%')
          and (v_admin or a.entity_type is distinct from 'activity_mismatch')
          and (v_admin or a.entity_type is distinct from 'operator_pay_impact')
          and (v_admin or a.entity_type is distinct from 'ghl_connection')
          and (v_admin or a.entity_type is distinct from 'payout')
      ) raw
      where raw.type is not null
        and (p_type is null or raw.type = p_type)
        and (p_operator_id is null or raw.operator_id = p_operator_id)
        and (p_actor_id is null or raw.actor_id = p_actor_id)
        and (p_actor_name is null or raw.actor_name ilike '%' || p_actor_name || '%')
        and (p_from is null or (raw.at at time zone v_zone)::date >= p_from)
        and (p_to is null or (raw.at at time zone v_zone)::date <= p_to)
      order by raw.at desc
      limit 300
    ) ev
  ), '[]'::jsonb));
end;
$$;

comment on function public.so_team_activity(uuid, uuid, text, date, date, text, text) is
  'Read-only feed. Rows come from the audit log, quick-log history, sign-ins, and alert reads. Nothing here updates or deletes them.';

revoke all on function public.so_team_activity(uuid, uuid, text, date, date, text, text) from public, anon;
grant execute on function public.so_team_activity(uuid, uuid, text, date, date, text, text) to authenticated;

-- 5. Writes ------------------------------------------------------------------------

create or replace function public.so_save_operator_domain(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.team_setting;
  v_origin text := app.so_origin(p ->> 'origin');
  v_also text[];
  v_retired text[];
  v_refresh integer;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only DA Admin changes the operator workspace domain' using errcode = '42501';
  end if;
  if v_origin is null then
    raise exception 'invalid_domain: the operator workspace needs a host' using errcode = '23514';
  end if;
  select coalesce(array_agg(app.so_origin(value)), '{}') into v_also
  from jsonb_array_elements_text(coalesce(p -> 'also_active', '[]'::jsonb)) value
  where app.so_origin(value) is not null;
  select coalesce(array_agg(app.so_origin(value)), '{}') into v_retired
  from jsonb_array_elements_text(coalesce(p -> 'retired', '[]'::jsonb)) value
  where app.so_origin(value) is not null;
  v_also := coalesce(v_also, '{}');
  v_retired := coalesce(v_retired, '{}');
  v_also := array(select distinct h from unnest(v_also) h where h <> v_origin and not h = any (v_retired));
  v_retired := array(select distinct h from unnest(v_retired) h where h <> v_origin);
  v_refresh := coalesce((p ->> 'refresh_minutes')::integer, (select team_workspace_refresh_minutes from public.team_setting where id = 1));
  if v_refresh is null or v_refresh not between 1 and 30 then
    raise exception 'invalid_refresh: choose between 1 and 30 minutes' using errcode = '23514';
  end if;

  select * into v_old from public.team_setting where id = 1 for update;
  update public.team_setting set
    base_url = v_origin,
    operator_workspace_also_active = v_also,
    operator_workspace_retired = v_retired,
    team_workspace_refresh_minutes = v_refresh,
    updated_by = auth.uid(),
    updated_at = now()
  where id = 1;

  perform app.audit(
    'workspace.domain', 'team_setting', '1', 'Changed the operator workspace domain',
    jsonb_build_object(
      'origin', v_old.base_url,
      'also_active', v_old.operator_workspace_also_active,
      'retired', v_old.operator_workspace_retired,
      'refresh_minutes', v_old.team_workspace_refresh_minutes
    ),
    jsonb_build_object(
      'origin', v_origin,
      'also_active', v_also,
      'retired', v_retired,
      'refresh_minutes', v_refresh
    )
  );
end;
$$;

revoke all on function public.so_save_operator_domain(jsonb) from public, anon;
grant execute on function public.so_save_operator_domain(jsonb) to authenticated;

create or replace function public.so_team_create_task(
  p_operator_id uuid,
  p_title text,
  p_detail text default null,
  p_due_on date default null,
  p_placement_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.operator_task;
begin
  perform app.so_require_team_staff();
  perform app.require('tasks.assign');
  if not exists (select 1 from public.operator where id = p_operator_id) then
    raise exception 'not_found: that operator is not on the roster' using errcode = 'P0002';
  end if;
  if p_placement_id is not null and not exists (
    select 1 from public.placement where id = p_placement_id and operator_id = p_operator_id
  ) then
    raise exception 'placement_not_found: that placement is not this operator''s' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 3 and 200 then
    raise exception 'title_required: say what needs doing' using errcode = '23514';
  end if;

  insert into public.operator_task (operator_id, placement_id, title, detail, due_on, assigned_by)
  values (p_operator_id, p_placement_id, btrim(p_title), nullif(btrim(coalesce(p_detail, '')), ''), p_due_on, auth.uid())
  returning * into v_row;

  insert into public.operator_notification (operator_id, placement_id, severity, title, body, sent_by, created_by, kind, required)
  values (
    p_operator_id, p_placement_id, 'informational', 'New task: ' || v_row.title,
    case when v_row.due_on is not null then format('Due %s.', to_char(v_row.due_on, 'FMDy DD Mon')) else 'No due date.' end,
    app.profile_name(auth.uid()), auth.uid(), 'general', false
  );

  perform app.audit('task.assigned', 'operator_task', v_row.id::text, format('Assigned the task %s', v_row.title),
    null, jsonb_build_object('title', v_row.title, 'due_on', v_row.due_on), null,
    (select profile_id from public.operator where id = p_operator_id));
  return jsonb_build_object('ok', true, 'id', v_row.id);
end;
$$;

revoke all on function public.so_team_create_task(uuid, text, text, date, uuid) from public, anon;
grant execute on function public.so_team_create_task(uuid, text, text, date, uuid) to authenticated;

create or replace function public.so_team_send_message(p_operator_id uuid, p_body text, p_placement_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.so_require_team_staff();
  if not exists (select 1 from public.operator where id = p_operator_id) then
    raise exception 'not_found: that operator is not on the roster' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'message_required: write the message' using errcode = '23514';
  end if;
  insert into public.operator_notification (
    operator_id, placement_id, severity, title, body, sent_by, created_by, kind, required, urgency
  ) values (
    p_operator_id, p_placement_id, 'informational', 'Message from your manager', btrim(p_body),
    app.profile_name(auth.uid()), auth.uid(), 'manager_message', false, 'normal'
  ) returning id into v_id;
  perform app.audit('workspace.alert.sent', 'operator_notification', v_id::text, 'Sent a manager message',
    null, jsonb_build_object('operator_id', p_operator_id), null,
    (select profile_id from public.operator where id = p_operator_id));
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.so_team_send_message(uuid, text, uuid) from public, anon;
grant execute on function public.so_team_send_message(uuid, text, uuid) to authenticated;

create or replace function public.so_team_set_target(
  p_placement_id uuid,
  p_metric_key text,
  p_daily numeric,
  p_weekly numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := app.so_require_team_staff();
  v_pl public.placement;
  v_from date;
  v_default public.activity_target;
  v_before public.activity_target;
  v_min integer;
  v_max integer;
  v_id uuid;
begin
  if not v_admin then
    perform app.require('workspace.targets.override');
  end if;
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null or v_pl.placement_type is null then
    raise exception 'not_found: that is not a workspace placement' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.activity_metric where key = p_metric_key and operator_editable) then
    raise exception 'not_found: that metric cannot take an operator target' using errcode = 'P0002';
  end if;
  v_from := (now() at time zone v_pl.time_zone)::date;
  if not v_admin then
    select target_override_min_pct, target_override_max_pct into v_min, v_max from public.team_setting where id = 1;
    select * into v_default from app.so_default_target(v_pl.placement_type, p_metric_key, v_from);
    if v_min is not null and (
         (p_daily is not null and v_default.daily is not null and p_daily < v_default.daily * v_min / 100.0)
      or (p_weekly is not null and v_default.weekly is not null and p_weekly < v_default.weekly * v_min / 100.0)) then
      raise exception 'below_limit: managers may not set a target below % percent of the default', v_min using errcode = '23514';
    end if;
    if v_max is not null and (
         (p_daily is not null and v_default.daily is not null and p_daily > v_default.daily * v_max / 100.0)
      or (p_weekly is not null and v_default.weekly is not null and p_weekly > v_default.weekly * v_max / 100.0)) then
      raise exception 'above_limit: managers may not set a target above % percent of the default', v_max using errcode = '23514';
    end if;
  end if;

  select t.* into v_before from public.activity_target t
  where t.layer = 'override' and t.placement_id = p_placement_id and t.metric_key = p_metric_key
  order by t.effective_from desc, t.set_at desc limit 1;

  insert into public.activity_target (layer, metric_key, placement_id, daily, weekly, effective_from, note, set_by)
  values ('override', p_metric_key, p_placement_id, p_daily, p_weekly, v_from, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  perform app.audit('workspace.target.override', 'activity_target', v_id::text,
    format('Operator target for %s set from %s', p_metric_key, v_from),
    case when v_before.id is null then null else jsonb_build_object('daily', v_before.daily, 'weekly', v_before.weekly) end,
    jsonb_build_object('placement_id', p_placement_id, 'metric_key', p_metric_key, 'daily', p_daily, 'weekly', p_weekly),
    v_pl.case_file_id);
  return v_id;
end;
$$;

revoke all on function public.so_team_set_target(uuid, text, numeric, numeric, text) from public, anon;
grant execute on function public.so_team_set_target(uuid, text, numeric, numeric, text) to authenticated;
