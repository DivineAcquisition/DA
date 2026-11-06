-- End-of-day mail. The sweep already decides when a reminder is due.
-- This queue is what actually sends it, plus the client and manager letters
-- after the report is submitted. One row per report and kind.

create table if not exists public.sales_eod_mail (
  id uuid primary key default gen_random_uuid(),
  eod_id uuid not null references public.sales_eod (id) on delete cascade,
  kind text not null check (kind in ('operator.eod_reminder', 'client.eod_submitted', 'manager.eod_submitted')),
  payload jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (eod_id, kind)
);

create index if not exists sales_eod_mail_unsent_idx
  on public.sales_eod_mail (created_at)
  where sent_at is null;

comment on table public.sales_eod_mail is
  'One outbound end-of-day letter per report and kind. The private link is only on the operator reminder.';

alter table public.sales_eod_mail enable row level security;
revoke all on public.sales_eod_mail from anon, authenticated;
grant select, insert, update, delete on public.sales_eod_mail to service_role;

create or replace function app.so_eod_queue_mail(p_eod public.sales_eod, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_client text;
  v_contact text;
  v_manager text;
  v_recipients text[];
  v_plan text;
  v_due text;
  v_shift text;
  v_payload jsonb;
begin
  if p_kind not in ('operator.eod_reminder', 'client.eod_submitted', 'manager.eod_submitted') then
    return;
  end if;
  select * into v_pl from public.placement where id = p_eod.placement_id;
  select * into v_op from public.operator where id = p_eod.operator_id;
  if v_pl.id is null or v_op.id is null then
    return;
  end if;
  select cf.name, nullif(btrim(cf.contact_email), '')
    into v_client, v_contact
  from public.client_case_file cf
  where cf.id = v_pl.case_file_id;
  select nullif(btrim(p.email), '') into v_manager
  from public.profile p
  where p.id = v_pl.manager_profile_id;

  select coalesce(array_agg(distinct lower(btrim(email))), '{}')
    into v_recipients
  from (
    select unnest(coalesce(c.recipient_emails, '{}') || coalesce(c.extra_emails, '{}')) as email
    from public.sales_report_config c
    where c.placement_id = v_pl.id
    union all
    select v_contact
  ) emails
  where email is not null and btrim(email) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  select coalesce(string_agg(btrim(item ->> 'text'), E'\n' order by ord), '')
    into v_plan
  from jsonb_array_elements(coalesce(p_eod.plan_items, '[]'::jsonb)) with ordinality as t(item, ord)
  where length(btrim(coalesce(item ->> 'text', ''))) > 0;

  v_due := to_char(p_eod.deadline_at at time zone v_pl.time_zone, 'FMHH12:MI AM');
  v_shift := to_char(nullif(v_pl.shift_end, '')::time, 'FMHH12:MI AM');

  v_payload := jsonb_build_object(
    'operator_id', v_op.id,
    'placement_id', v_pl.id,
    'case_file_id', v_pl.case_file_id,
    'name', v_op.name,
    'client', coalesce(v_client, 'the client'),
    'work_date', p_eod.work_date,
    'due_label', v_due,
    'shift_label', v_shift,
    'time_zone', v_pl.time_zone,
    'wins', coalesce(p_eod.wins, ''),
    'blockers', coalesce(p_eod.blockers, ''),
    'plan', coalesce(v_plan, ''),
    'needs_help', coalesce(p_eod.needs_help, false),
    'was_late', coalesce(p_eod.was_late, false)
  );

  if p_kind = 'operator.eod_reminder' then
    if nullif(btrim(coalesce(v_op.email, '')), '') is null then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object(
      'to', jsonb_build_array(lower(btrim(v_op.email))),
      'link_path', case
        when nullif(btrim(coalesce(p_eod.link_token, '')), '') is null then '/workspace/operator/workspace/eod?day=' || p_eod.work_date::text
        else '/eod/' || p_eod.link_token
      end
    );
  elsif p_kind = 'client.eod_submitted' then
    if coalesce(cardinality(v_recipients), 0) = 0 then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object('to', to_jsonb(v_recipients));
  else
    if v_manager is null then
      return;
    end if;
    v_payload := v_payload || jsonb_build_object(
      'to', jsonb_build_array(lower(v_manager)),
      'review_path', '/workspace/team/workspace/eods/' || p_eod.id::text
    );
  end if;

  insert into public.sales_eod_mail (eod_id, kind, payload)
  values (p_eod.id, p_kind, v_payload)
  on conflict (eod_id, kind) do nothing;
end;
$$;

revoke all on function app.so_eod_queue_mail(public.sales_eod, text) from public, anon, authenticated;

create or replace function public.so_eod_mail_claim(p_limit integer default 20)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  r record;
begin
  update public.sales_eod_mail
     set claimed_at = null
   where claimed_at < now() - interval '15 minutes'
     and sent_at is null;

  for r in
    select * from public.sales_eod_mail
    where sent_at is null and claimed_at is null
    order by created_at
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  loop
    update public.sales_eod_mail set claimed_at = now() where id = r.id;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'eod_id', r.eod_id, 'kind', r.kind, 'payload', r.payload
    ));
  end loop;
  return v_out;
end;
$$;

revoke all on function public.so_eod_mail_claim(integer) from public, anon, authenticated;
grant execute on function public.so_eod_mail_claim(integer) to service_role;

create or replace function public.so_eod_mail_finish(p_id uuid, p_ok boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_ok then
    update public.sales_eod_mail set sent_at = now() where id = p_id;
  else
    update public.sales_eod_mail set claimed_at = null where id = p_id and sent_at is null;
  end if;
end;
$$;

revoke all on function public.so_eod_mail_finish(uuid, boolean) from public, anon, authenticated;
grant execute on function public.so_eod_mail_finish(uuid, boolean) to service_role;

-- The sweep body is the live deadline clock. The reminder step also queues the
-- operator email, and every operator alert uses the private link.
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
  v_due_label text;
  v_shift_label text;
  v_zone text;
begin
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
    v_link := case
      when nullif(btrim(coalesce(v_eod.link_token, '')), '') is null then '/workspace/operator/workspace/eod?day=' || v_eod.work_date::text
      else '/eod/' || v_eod.link_token
    end;

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
    v_due_label := to_char(v_due at time zone v_pl.time_zone, 'FMHH12:MI AM');
    v_shift_label := to_char(nullif(v_pl.shift_end, '')::time, 'FMHH12:MI AM');
    v_zone := case v_pl.time_zone
      when 'America/Chicago' then 'Central'
      when 'America/New_York' then 'Eastern'
      else coalesce(v_pl.time_zone, '')
    end;

    if now() >= v_due - make_interval(mins => v_remind)
       and not exists (select 1 from public.sales_eod_step s where s.eod_id = v_eod.id and s.step = 'reminder') then
      insert into public.sales_eod_step (eod_id, step) values (v_eod.id, 'reminder');
      perform app.so_eod_queue_mail(v_eod, 'operator.eod_reminder');
      perform app.so_operator_alert(v_eod.operator_id, v_eod.placement_id, 'eod_reminder',
        'EOD reminder',
        format('Your shift ends at %s %s. Your end of day is due at %s %s. Open the private link. No sign-in.', v_shift_label, v_zone, v_due_label, v_zone),
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
grant execute on function public.so_eod_sweep() to authenticated, service_role;

create or replace function public.so_eod_submit(p_day date, p_body jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_saved jsonb;
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
  v_already timestamptz;
begin
  select e.submitted_at into v_already
  from public.sales_eod e
  where e.work_date = p_day
    and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
  if v_already is not null then
    raise exception 'already_submitted: this EOD is already in. Save the edit instead.' using errcode = '23514';
  end if;
  v_saved := public.so_eod_save(p_day, p_body);
  select * into v_eod from public.sales_eod e
  where e.work_date = p_day
    and e.operator_id = (select id from public.operator where profile_id = app.acting_profile());
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
  select name into v_name from public.operator where id = v_op.id;
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
    null, jsonb_build_object('status', v_eod.status, 'was_late', v_late, 'needs_help', v_eod.needs_help), v_pl.case_file_id);
  perform app.so_eod_queue_mail(v_eod, 'client.eod_submitted');
  perform app.so_eod_queue_mail(v_eod, 'manager.eod_submitted');

  return jsonb_build_object('ok', true, 'status', v_eod.status, 'was_late', v_eod.was_late, 'submitted_at', v_eod.submitted_at);
end;
$$;

revoke all on function public.so_eod_submit(date, jsonb) from public, anon;
grant execute on function public.so_eod_submit(date, jsonb) to authenticated;

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
  perform app.so_eod_queue_mail(v_eod, 'client.eod_submitted');
  perform app.so_eod_queue_mail(v_eod, 'manager.eod_submitted');
  return jsonb_build_object('ok', true, 'status', v_eod.status, 'was_late', v_eod.was_late, 'submitted_at', v_eod.submitted_at);
end;
$$;

revoke all on function public.so_eod_link_submit(text, jsonb) from public;
grant execute on function public.so_eod_link_submit(text, jsonb) to anon, authenticated, service_role;
