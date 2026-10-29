-- End-of-day submission, the deadline clock, feedback, and excused days.
--
-- The clock runs in the database every minute (pg_cron) and again whenever an
-- operator opens the workspace, so a step that came due while the job was down
-- fires once, in order, on the next pass. Operator email uses the existing
-- notification queue (urgency immediate). Manager and admin alerts are rows in
-- workspace_alert, shown on the Team Workspace tab.

-- 1. Shape -----------------------------------------------------------------------

alter table public.team_setting
  add column if not exists eod_min_text_chars integer not null default 20
    check (eod_min_text_chars between 1 and 500);

comment on column public.team_setting.eod_min_text_chars is
  'Minimum characters for Wins and Blockers on an EOD. "No blockers today" is accepted as written.';

alter table public.sales_eod
  add column if not exists needs_help boolean not null default false,
  add column if not exists plan_items jsonb not null default '[]'::jsonb,
  add column if not exists hours_start text,
  add column if not exists hours_end text,
  add column if not exists break_minutes integer,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profile (id) on delete set null,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references public.profile (id) on delete set null,
  add column if not exists escalation_reason text,
  add column if not exists unlocked_until timestamptz,
  add column if not exists prior_status text;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.sales_eod'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%not_started%'
  loop
    execute format('alter table public.sales_eod drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.sales_eod
  add constraint sales_eod_status_chk
    check (status in ('not_started', 'draft', 'submitted', 'late', 'missed', 'excused'));

alter table public.sales_eod_feedback
  add column if not exists parent_id uuid references public.sales_eod_feedback (id) on delete cascade;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.sales_eod_feedback'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%author_kind%'
  loop
    execute format('alter table public.sales_eod_feedback drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.sales_eod_feedback
  add constraint sales_eod_feedback_kind_chk
    check (author_kind in ('manager', 'admin', 'client', 'operator')),
  add constraint sales_eod_feedback_author check (
    (author_kind = 'client' and author_profile_id is null and parent_id is null)
    or (author_kind = 'operator' and author_profile_id is not null and client_token_id is null and parent_id is not null)
    or (author_kind in ('manager', 'admin') and client_token_id is null)
  );

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.workspace_alert'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%cert_grace%'
  loop
    execute format('alter table public.workspace_alert drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.workspace_alert
  add constraint workspace_alert_kind_chk
    check (kind in (
      'cert_grace', 'placement_review',
      'eod_submitted', 'eod_needs_help', 'eod_late', 'eod_manager', 'eod_missed',
      'eod_escalated', 'eod_edited', 'eod_feedback'
    ));

create table if not exists public.sales_eod_step (
  eod_id uuid not null references public.sales_eod (id) on delete cascade,
  step text not null check (step in ('reminder', 'late', 'manager_alert', 'missed')),
  fired_at timestamptz not null default now(),
  primary key (eod_id, step)
);

comment on table public.sales_eod_step is
  'Each deadline step fires once per EOD. A later pass does not send it again.';

create table if not exists public.sales_eod_event (
  id uuid primary key default gen_random_uuid(),
  eod_id uuid not null references public.sales_eod (id) on delete cascade,
  from_status text,
  to_status text,
  step text,
  detail text,
  happened_at timestamptz not null default now()
);

create table if not exists public.sales_excused_day (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  reason text not null check (reason in ('time_off', 'sick', 'client_closed', 'holiday', 'system_outage', 'other')),
  note text,
  excused_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (placement_id, work_date)
);

comment on table public.sales_excused_day is
  'A working day with no EOD due. Separate from shift_attendance, which decides VA abandonment and pay.';

create trigger sales_excused_day_match before insert or update on public.sales_excused_day
  for each row execute function app.so_match_placement_operator();

create trigger sales_eod_event_append_only before update or delete on public.sales_eod_event
  for each row execute function app.so_append_only();
create trigger sales_eod_step_append_only before update or delete on public.sales_eod_step
  for each row execute function app.so_append_only();
create trigger sales_eod_feedback_append_only before update or delete on public.sales_eod_feedback
  for each row execute function app.so_append_only();

do $$
declare t text;
begin
  foreach t in array array['sales_eod_step', 'sales_eod_event', 'sales_excused_day'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_admin())', t || '_admin_read', t);
  end loop;
end $$;

create policy sales_excused_day_manager_read on public.sales_excused_day
  for select to authenticated using (app.is_manager());
create policy sales_eod_step_manager_read on public.sales_eod_step
  for select to authenticated using (app.is_manager());
create policy sales_eod_event_manager_read on public.sales_eod_event
  for select to authenticated using (app.is_manager());

-- Plan ticks (done_at) are not content. A locked EOD can still be checked off.
create or replace function app.so_plan_text(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object('text', coalesce(item ->> 'text', '')) order by ord)
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) with ordinality as t(item, ord)
  ), '[]'::jsonb);
$$;

revoke all on function app.so_plan_text(jsonb) from public, anon, authenticated;

-- 2. Edit window, including an admin unlock ------------------------------------------

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
  if p_eod.unlocked_until is not null and now() < p_eod.unlocked_until then
    return true;
  end if;
  if p_eod.id is null or p_eod.status in ('not_started', 'draft', 'late') then
    return true;
  end if;
  if p_eod.status = 'missed' and p_eod.submitted_at is null then
    return true;
  end if;
  if p_eod.status in ('missed', 'excused') and p_eod.submitted_at is null then
    return p_eod.status = 'missed';
  end if;
  if p_eod.status = 'excused' then
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
    return p_eod.submitted_at is not null and v_hours is not null
      and now() < p_eod.submitted_at + make_interval(hours => v_hours);
  end if;
  v_next := app.so_next_shift_start(p, p_eod.work_date);
  if v_next is null then
    return true;
  end if;
  return now() < v_next;
end;
$$;

create or replace function app.so_guard_sales_eod()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day public.activity_day;
  v_before jsonb;
  v_after jsonb;
  v_case uuid;
  v_open boolean;
begin
  select * into v_day from public.activity_day where id = new.activity_day_id;
  if v_day.placement_id is distinct from new.placement_id or v_day.work_date is distinct from new.work_date then
    raise exception 'activity_mismatch: the EOD and its activity record must be the same placement and day' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.operator_id is distinct from old.operator_id or new.placement_id is distinct from old.placement_id
       or new.work_date is distinct from old.work_date or new.activity_day_id is distinct from old.activity_day_id
       or new.deadline_at is distinct from old.deadline_at then
      raise exception 'immutable: an EOD keeps its operator, placement, day and the deadline that applied' using errcode = '42501';
    end if;

    v_before := jsonb_build_object(
      'wins', old.wins, 'blockers', old.blockers, 'tomorrow_plan', old.tomorrow_plan, 'plan_items', app.so_plan_text(old.plan_items),
      'hours_worked', old.hours_worked, 'hours_start', old.hours_start, 'hours_end', old.hours_end,
      'break_minutes', old.break_minutes, 'note_to_manager', old.note_to_manager, 'needs_help', old.needs_help);
    v_after := jsonb_build_object(
      'wins', new.wins, 'blockers', new.blockers, 'tomorrow_plan', new.tomorrow_plan, 'plan_items', app.so_plan_text(new.plan_items),
      'hours_worked', new.hours_worked, 'hours_start', new.hours_start, 'hours_end', new.hours_end,
      'break_minutes', new.break_minutes, 'note_to_manager', new.note_to_manager, 'needs_help', new.needs_help);

    if old.submitted_at is not null and v_before is distinct from v_after then
      v_open := new.unlocked_until is not null and now() < new.unlocked_until;
      if not v_open and old.locked_at is not null and now() >= old.locked_at then
        raise exception 'eod_locked: this EOD is locked. Edits closed when the next shift started.' using errcode = '42501';
      end if;
      new.edit_count := old.edit_count + 1;
      new.edited_after_submit := true;
      insert into public.sales_eod_revision (eod_id, revision, before_value, after_value, edited_by)
      values (new.id, new.edit_count, v_before, v_after, auth.uid());
      select case_file_id into v_case from public.placement where id = new.placement_id;
      perform app.audit('workspace.eod.edited', 'sales_eod', new.id::text,
        format('EOD for %s edited after submission (edit %s)', new.work_date, new.edit_count),
        v_before, v_after, v_case);
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- 3. Deadline sweep ------------------------------------------------------------------

create or replace function app.so_staff_alert(
  p_kind text, p_operator uuid, p_placement uuid, p_manager uuid, p_day date, p_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_alert (kind, operator_id, placement_id, manager_profile_id, period_on, summary)
  values (p_kind, p_operator, p_placement, p_manager, p_day, p_summary);
end;
$$;

create or replace function app.so_operator_alert(
  p_operator uuid, p_placement uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.operator_notification (
    operator_id, placement_id, severity, title, body, sent_by, kind, urgency, link_path, required
  ) values (
    p_operator, p_placement, 'important', p_title, p_body, 'System', p_kind, 'immediate', p_link, true
  );
end;
$$;

revoke all on function app.so_staff_alert(text, uuid, uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function app.so_operator_alert(uuid, uuid, text, text, text, text) from public, anon, authenticated;

-- Deadline steps run from cron, where there is no signed-in actor. app.audit
-- only writes when auth.uid() matches a profile, so the sweep records itself.
create or replace function app.so_system_audit(
  p_action text, p_entity_type text, p_entity_id text, p_summary text,
  p_before jsonb, p_after jsonb, p_case uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Always the sweep, never whichever operator happened to open a page.
  insert into public.audit_event (action, entity_type, entity_id, case_file_id, summary, before_value, after_value, surface)
  values (p_action, p_entity_type, p_entity_id, p_case, p_summary, p_before, p_after, 'sales-eod-sweep');
end;
$$;

revoke all on function app.so_system_audit(text, text, text, text, jsonb, jsonb, uuid) from public, anon, authenticated;

create or replace function public.so_eod_sweep()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_today date;
  v_bounds record;
  v_day uuid;
  v_eod public.sales_eod;
  v_remind integer;
  v_late integer;
  v_manager integer;
  v_missed_rule text;
  v_missed_hours integer;
  v_due timestamptz;
  v_name text;
  v_fired integer := 0;
  v_link text;
begin
  -- The sweep writes every open EOD. A View As session must not block those writes.
  perform set_config('app.eod_sweep', 'on', true);
  select eod_reminder_minutes_before, eod_late_minutes_after, eod_manager_alert_minutes_after,
         eod_missed_rule, eod_missed_hours_after
    into v_remind, v_late, v_manager, v_missed_rule, v_missed_hours
  from public.team_setting where id = 1;
  v_remind := coalesce(v_remind, 60);
  v_late := coalesce(v_late, 0);
  v_manager := coalesce(v_manager, 120);

  for v_pl in
    select * from public.placement
    where placement_type is not null and status = 'active'
  loop
    v_today := app.so_work_date(v_pl, now());
    select * into v_bounds from app.shift_bounds(v_pl, v_today);
    if v_bounds.starts_at is null or now() < v_bounds.starts_at then
      continue;
    end if;
    if v_pl.start_date = v_today and now() >= v_bounds.ends_at then
      continue;
    end if;
    if exists (
      select 1 from public.sales_excused_day x
      where x.placement_id = v_pl.id and x.work_date = v_today
    ) then
      continue;
    end if;
    if not exists (select 1 from public.sales_eod e where e.placement_id = v_pl.id and e.work_date = v_today) then
      insert into public.activity_day (operator_id, placement_id, work_date)
      values (v_pl.operator_id, v_pl.id, v_today)
      on conflict (operator_id, placement_id, work_date) do nothing;
      select id into v_day from public.activity_day
      where operator_id = v_pl.operator_id and placement_id = v_pl.id and work_date = v_today;
      insert into public.sales_eod (operator_id, placement_id, work_date, activity_day_id, deadline_at, status)
      values (v_pl.operator_id, v_pl.id, v_today, v_day, app.so_eod_deadline(v_pl, v_today), 'not_started')
      on conflict (operator_id, placement_id, work_date) do nothing;
      perform app.so_upsert_system_task(
        v_pl.operator_id, v_pl.id, v_today, 'Submit today''s EOD',
        coalesce(v_pl.eod_deadline, v_pl.shift_end), false, null);
    end if;
  end loop;

  for v_eod in
    select e.* from public.sales_eod e
    join public.placement pl on pl.id = e.placement_id
    where e.submitted_at is null
      and e.status in ('not_started', 'draft', 'late')
      and pl.status = 'active'
      and pl.placement_type is not null
  loop
    select * into v_pl from public.placement where id = v_eod.placement_id;
    select name into v_name from public.operator where id = v_eod.operator_id;
    v_link := '/workspace/operator/workspace/eod?day=' || v_eod.work_date::text;

    if exists (
      select 1 from public.sales_excused_day x
      where x.placement_id = v_eod.placement_id and x.work_date = v_eod.work_date
    ) then
      update public.sales_eod
         set prior_status = coalesce(prior_status, status), status = 'excused'
       where id = v_eod.id and status <> 'excused';
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, 'excused', 'excused', 'Day excused. Remaining deadline steps stopped.');
      continue;
    end if;

    v_due := v_eod.deadline_at;

    if now() >= v_due - make_interval(mins => v_remind)
       and not exists (select 1 from public.sales_eod_step s where s.eod_id = v_eod.id and s.step = 'reminder') then
      insert into public.sales_eod_step (eod_id, step) values (v_eod.id, 'reminder');
      perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'eod_reminder',
        'EOD reminder',
        format('Your EOD is due at %s. Ten minutes now saves a flag later.', to_char(v_due at time zone v_pl.time_zone, 'HH12:MI AM')),
        v_link);
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, v_eod.status, 'reminder', 'Reminder sent.');
      perform app.so_system_audit('workspace.eod.reminder', 'sales_eod', v_eod.id::text,
        format('EOD reminder for %s on %s', v_name, v_eod.work_date), null, null, v_pl.case_file_id);
      v_fired := v_fired + 1;
    end if;

    if now() >= v_due + make_interval(mins => v_late)
       and v_eod.status is distinct from 'late'
       and not exists (select 1 from public.sales_eod_step s where s.eod_id = v_eod.id and s.step = 'late') then
      update public.sales_eod set status = 'late' where id = v_eod.id;
      insert into public.sales_eod_step (eod_id, step) values (v_eod.id, 'late');
      perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'eod_late',
        'EOD is late', format('Your EOD for %s is past the deadline. Submit it now.', v_eod.work_date), v_link);
      perform app.so_staff_alert('eod_late', v_eod.operator_id, v_eod.placement_id, v_pl.manager_profile_id, v_eod.work_date,
        format('%s is late on the EOD for %s.', v_name, v_eod.work_date));
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, 'late', 'late', 'Deadline passed.');
      perform app.so_system_audit('workspace.eod.late', 'sales_eod', v_eod.id::text,
        format('EOD for %s on %s is late', v_name, v_eod.work_date),
        jsonb_build_object('status', v_eod.status), jsonb_build_object('status', 'late'), v_pl.case_file_id);
      v_eod.status := 'late';
      v_fired := v_fired + 1;
    end if;

    if now() >= v_due + make_interval(mins => v_manager)
       and not exists (select 1 from public.sales_eod_step s where s.eod_id = v_eod.id and s.step = 'manager_alert') then
      insert into public.sales_eod_step (eod_id, step) values (v_eod.id, 'manager_alert');
      perform app.so_staff_alert('eod_manager', v_eod.operator_id, v_eod.placement_id, v_pl.manager_profile_id, v_eod.work_date,
        format('Escalation: %s has not submitted the EOD for %s.', v_name, v_eod.work_date));
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, v_eod.status, 'manager_alert', 'Manager alerted.');
      perform app.so_system_audit('workspace.eod.manager_alert', 'sales_eod', v_eod.id::text,
        format('Manager alerted: %s has not submitted %s', v_name, v_eod.work_date), null, null, v_pl.case_file_id);
      v_fired := v_fired + 1;
    end if;

    if not exists (select 1 from public.sales_eod_step s where s.eod_id = v_eod.id and s.step = 'missed')
       and (
         (v_missed_rule = 'hours_after_deadline' and v_missed_hours is not null
            and now() >= v_due + make_interval(hours => v_missed_hours))
         or (coalesce(v_missed_rule, 'next_shift_start') = 'next_shift_start'
            and app.so_next_shift_start(v_pl, v_eod.work_date) is not null
            and now() >= app.so_next_shift_start(v_pl, v_eod.work_date))
       ) then
      update public.sales_eod set status = 'missed', was_late = true where id = v_eod.id;
      insert into public.sales_eod_step (eod_id, step) values (v_eod.id, 'missed');
      perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'eod_late',
        'EOD missed', format('The EOD for %s was missed. You can still submit it. It stays marked missed.', v_eod.work_date), v_link);
      perform app.so_staff_alert('eod_missed', v_eod.operator_id, v_eod.placement_id, v_pl.manager_profile_id, v_eod.work_date,
        format('%s missed the EOD for %s.', v_name, v_eod.work_date));
      insert into public.sales_eod_event (eod_id, from_status, to_status, step, detail)
      values (v_eod.id, v_eod.status, 'missed', 'missed', 'Marked missed.');
      perform app.so_system_audit('workspace.eod.missed', 'sales_eod', v_eod.id::text,
        format('EOD for %s on %s was missed', v_name, v_eod.work_date),
        jsonb_build_object('status', v_eod.status), jsonb_build_object('status', 'missed'), v_pl.case_file_id);
      v_fired := v_fired + 1;
    end if;
  end loop;

  return v_fired;
end;
$$;

revoke all on function public.so_eod_sweep() from public, anon;
grant execute on function public.so_eod_sweep() to authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sales-eod-sweep') then
    perform cron.unschedule('sales-eod-sweep');
  end if;
  perform cron.schedule('sales-eod-sweep', '* * * * *', 'select public.so_eod_sweep()');
end $$;
