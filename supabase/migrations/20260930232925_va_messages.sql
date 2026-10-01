-- Prompt 8, part two: the portal and staff functions for the accountability
-- system, the editable message library, and the email dispatch queue.
--
-- Every VA-facing message is rendered from public.message_template, which admins
-- edit. Messages carry counts, dates and times only, never customer data, and a
-- link to the exact record. The email dispatcher (/api/cron/notify-dispatch)
-- claims them through notify_claim_emails() and records every attempt.

-- 1. Permissions for admin-only actions -----------------------------------------

insert into public.permission (key, label, category, description, sort_order, is_destructive, requires_step_up, blocked_during_impersonation)
values
  ('tiers.decide', 'Decide tier changes', 'Accounts',
   'Approve or decline a tier change for an operator, with a reason they see.', 117, false, false, true),
  ('team.settings', 'Team accountability settings', 'System',
   'Edit DA''s commitments, tier criteria, message templates and sending settings.', 20, false, false, true),
  ('standards.exclusions', 'Mark outage windows', 'Work',
   'Mark a window as a system outage or client-side incident, excluding it for every VA on the placement.', 800, false, false, true),
  ('standards.productive_time', 'Enter productive time', 'Work',
   'Enter weekly productive time and set the weekly threshold, until monitoring is connected.', 810, false, false, true)
on conflict (key) do nothing;

insert into public.role_permission (role, permission_key)
select r::public.user_role, k
from unnest(array['owner', 'admin']) r,
     unnest(array['tiers.decide', 'team.settings', 'standards.exclusions', 'standards.productive_time']) k
on conflict do nothing;

-- 2. The message library -----------------------------------------------------------

create table if not exists public.message_template (
  key text primary key,
  label text not null,
  subject text not null,
  body text not null,
  urgency text not null default 'normal' check (urgency in ('immediate', 'normal')),
  severity public.notification_severity not null default 'informational',
  required boolean not null default true,
  sender text not null default 'system' check (sender in ('system', 'admin')),
  formal boolean not null default false,
  sort_order integer not null default 100,
  updated_by uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.message_template enable row level security;
revoke all on public.message_template from anon, authenticated;
grant select on public.message_template to authenticated;
drop policy if exists message_template_admin_read on public.message_template;
create policy message_template_admin_read on public.message_template for select to authenticated using (app.is_admin());

insert into public.message_template (key, label, subject, body, urgency, severity, required, sender, formal, sort_order) values
  ('stage_training', 'Welcome: in training', 'Welcome to training',
   E'Hi {{first_name}}, your account now shows your training and the standards you''ll be held to once you''re placed.\n\nTraining uses sample data only: no live customers and no commercial work.\nNext step: work through your training list.',
   'normal', 'informational', true, 'system', false, 10),
  ('stage_certified', 'Welcome: certified', 'You''re certified: set your availability',
   E'Hi {{first_name}}, you''re certified and waiting for placement.\n\nNext step: set the shift windows you can work and your time zone, so DA can match you to a placement.',
   'normal', 'informational', true, 'system', false, 11),
  ('stage_placed', 'Welcome: placed', 'Your placement is live',
   E'Hi {{first_name}}, your placement is live. My Day shows your shift, your response clock and what needs you.\n\nNext step: read your playbook before your first shift.',
   'normal', 'informational', true, 'system', false, 12),
  ('shift_review_ready', 'Shift review ready', 'Your shift review for {{shift_day}} is ready',
   E'Hi {{first_name}}, your shift on {{shift_day}} has been recorded. Take a minute to confirm it or correct anything that''s off.\n\nStandard: every worked shift has a confirmed review.\nNext step: review and confirm before your next shift starts ({{next_shift}}).',
   'normal', 'informational', true, 'system', false, 20),
  ('shift_review_unconfirmed', 'Shift review unconfirmed', 'Your {{shift_day_short}} shift review is still open',
   E'Hi {{first_name}}, your review for {{shift_day}} wasn''t confirmed before your next shift, so the recorded numbers now stand as your record.\n\nYou can still confirm or correct it until the pay period closes on {{period_closes}}.',
   'normal', 'informational', true, 'system', false, 21),
  ('escalation_answered', 'Escalation answered', 'Your escalation has an answer',
   E'Hi {{first_name}}, the question you raised at {{raised_time}} has been answered by {{answered_by}}.\n\nNext step: read the answer and follow up with the customer.',
   'immediate', 'important', true, 'system', false, 30),
  ('da_late', 'DA answered late', 'We were late on your escalation',
   E'Hi {{first_name}}, your escalation from {{raised_day}} was due by {{due_time}} and was answered at {{answered_time}}. That''s on us.\n\nAny response-time misses while you were waiting on us are eligible to be excluded from your numbers. Nothing is needed from you.',
   'normal', 'important', true, 'system', false, 31),
  ('standard_at_risk', 'Standard at risk', 'Heads up on your {{standard}}',
   E'Hi {{first_name}}, halfway through {{month}} you''re at {{value}} on {{standard_long}}. The standard is {{target}} for the month.\n\nThere''s time to recover. {{tip}}',
   'normal', 'important', false, 'system', false, 40),
  ('suspected_missed', 'Suspected missed shift', 'Did something happen with your {{shift_day_short}} shift?',
   E'Hi {{first_name}}, we don''t see any activity or advance notice for your shift on {{shift_day}}.\n\nIf something came up, let us know what happened. Nothing has been decided, and a manager will review it with your input.',
   'immediate', 'important', true, 'system', false, 50),
  ('feedback_posted', 'Weekly feedback posted', 'Your feedback for the week of {{week}}',
   E'Hi {{first_name}}, {{manager}} posted your weekly feedback. Your focus for this week: "{{focus}}"',
   'normal', 'informational', true, 'system', false, 60),
  ('weekly_summary', 'Weekly summary', 'Your week in review',
   E'Hi {{first_name}}, your week is wrapping up and your summary is ready: standards, bookings and your own reflections.\n\nNext step: write one line on what you''ll focus on next week. Your manager reads it before writing your feedback.',
   'normal', 'informational', false, 'system', false, 61),
  ('pay_statement_ready', 'Pay statement ready', 'Your pay statement for {{period}} is ready',
   E'Hi {{first_name}}, your pay statement for {{period}} is on your account. It can still change until the pay period closes.\n\nNext step: check it, and ask a question on the statement if anything looks off. DA answers pay questions within 2 business days.',
   'normal', 'informational', true, 'system', false, 70),
  ('payout_sent', 'Payout sent', 'Your {{date}} payout was sent',
   E'Hi {{first_name}}, your payout of {{amount}} was sent on {{date}}.',
   'normal', 'informational', true, 'system', false, 71),
  ('payout_failed', 'Payout failed', 'Your {{date}} payout didn''t go through',
   E'Hi {{first_name}}, your payout of {{amount}} on {{date}} failed. Reason: {{reason}}.\n\nNext step: check your payout method. DA will retry within 2 business days of your update.',
   'immediate', 'urgent', true, 'system', false, 72),
  ('tier_approved', 'Tier approved', 'Your tier has changed',
   E'Hi {{first_name}}, {{admin}} approved your move to Tier {{tier}}.\n\nReason: {{reason}}',
   'normal', 'important', true, 'admin', false, 80),
  ('tier_declined', 'Tier declined', 'About your Tier {{tier}} review',
   E'Hi {{first_name}}, {{admin}} reviewed your eligibility for Tier {{tier}} and decided not to move you yet.\n\nReason: {{reason}}\nNext step: keep working on the criteria in Pay & Growth, and ask your manager if anything is unclear.',
   'normal', 'important', true, 'admin', false, 81),
  ('dispute_decided', 'Dispute decided', 'Your dispute on {{standard}} was {{outcome}}',
   E'Hi {{first_name}}, {{manager}} {{outcome}} your dispute about {{item}}.\n\nReason: {{reason}}\n{{effect}}',
   'normal', 'informational', true, 'system', false, 85),
  ('finding_recorded', 'Escalation finding', 'A note on escalation discipline',
   E'Hi {{first_name}}, {{manager}} recorded a finding for {{date}}: a matter that needed escalating was handled without DA.\n\nStandard: required matters are escalated, not improvised (section 5.6).\nNext step: read the note on My Standards. If you see it differently, dispute it there.',
   'normal', 'important', true, 'system', false, 86),
  ('blocking_notice', 'Blocking notice', 'A notice needs your confirmation',
   E'Hi {{first_name}}, there''s a notice on your account to read and confirm before you continue working.\n\nNext step: open it and confirm you''ve read it.',
   'immediate', 'urgent', true, 'admin', false, 90),
  ('formal_shift_coverage', 'Formal notice: shift coverage', 'Written notice regarding shift coverage',
   E'Hi {{first_name}}, this is written notice under Section 6 of your Sales Operator Placement Agreement.\n\nWhat happened: [fill in the specific, verified facts and dates]\nThe standard: [section and plain-language standard]\nWhat happens next: [the specific consequence decided by DA, if any]\nYour response: you may reply to this notice by [date]. Your reply will be kept with this record.',
   'immediate', 'urgent', true, 'admin', true, 100),
  ('formal_general', 'Formal notice: general', 'Written notice',
   E'Hi {{first_name}}, this is written notice under Section [section] of your Sales Operator Placement Agreement.\n\nWhat happened: [fill in the specific, verified facts and dates]\nThe standard: [section and plain-language standard]\nWhat happens next: [the specific consequence decided by DA, if any]\nYour response: you may reply to this notice by [date]. Your reply will be kept with this record.',
   'immediate', 'urgent', true, 'admin', true, 101)
on conflict (key) do nothing;

create or replace function app.render_template(p_text text, p_vars jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v text;
  r text := p_text;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_vars, '{}'::jsonb)) loop
    r := replace(r, '{{' || k || '}}', coalesce(v, ''));
  end loop;
  return r;
end;
$$;

create or replace function app.op_tz(p_operator_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app.safe_tz(o.time_zone) from public.operator o where o.id = p_operator_id;
$$;

-- A moment in the VA's own time zone.
create or replace function app.op_time(p_operator_id uuid, p_at timestamptz, p_format text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(p_at at time zone app.op_tz(p_operator_id), p_format);
$$;

-- Tell a VA something from the library. Formal templates never go through here.
create or replace function app.notify_template(
  p_operator_id uuid,
  p_key text,
  p_vars jsonb,
  p_link text,
  p_placement_id uuid default null,
  p_urgency text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  t public.message_template;
  v_vars jsonb;
  v_subject text;
begin
  select * into t from public.message_template where key = p_key;
  if t.key is null then
    raise exception 'template_missing: %', p_key;
  end if;
  if t.formal then
    raise exception 'formal_notice_unapproved: formal notices are sent by an admin only' using errcode = '42501';
  end if;
  v_vars := jsonb_build_object('first_name',
              (select split_part(btrim(o.name), ' ', 1) from public.operator o where o.id = p_operator_id))
            || coalesce(p_vars, '{}'::jsonb);
  v_subject := app.render_template(t.subject, v_vars);
  return app.notify_operator(p_operator_id, p_key, t.severity, v_subject, app.render_template(t.body, v_vars), p_link,
                             coalesce(p_urgency, t.urgency), v_subject, p_placement_id, t.required);
end;
$$;

-- 3. The triggers and sweep from part one, now speaking through the library -------

create or replace function app.on_escalation_answered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
begin
  if not (new.status = 'answered' and old.status = 'open') then
    return new;
  end if;
  select * into v_pl from public.placement where id = new.placement_id;
  select * into v_op from public.operator where id = new.operator_id;

  perform app.notify_template(new.operator_id, 'escalation_answered',
    jsonb_build_object('raised_time', app.op_time(new.operator_id, new.raised_at, 'FMHH12:MI AM'),
                       'answered_by', coalesce(split_part(app.profile_name(new.answered_by), ' ', 1), 'DA')),
    '/vistrial/operator/escalations#' || new.id, new.placement_id,
    case when app.on_shift_now(v_pl) then 'immediate' else 'normal' end);

  if new.response_due_at is not null and new.answered_at > new.response_due_at then
    perform app.notify_template(new.operator_id, 'da_late',
      jsonb_build_object('raised_day', app.op_time(new.operator_id, new.raised_at, 'FMDy, Mon FMDD'),
                         'due_time', app.op_time(new.operator_id, new.response_due_at, 'FMHH12:MI AM'),
                         'answered_time', app.op_time(new.operator_id, new.answered_at,
                           case when (new.answered_at at time zone app.op_tz(new.operator_id))::date
                                     = (new.response_due_at at time zone app.op_tz(new.operator_id))::date
                                then 'FMHH12:MI AM' else 'FMHH12:MI AM "on" FMDy, Mon FMDD' end)),
      '/vistrial/operator/commitments', new.placement_id);
    perform app.notify_staff(app.admin_recipient_ids() || app.placement_manager_ids(new.placement_id),
      'da_miss.escalation', 'important',
      format('DA miss: escalation answered late for %s', v_op.name),
      format('Due %s UTC, answered %s UTC. It shows on their DA''s Commitments, and their response misses during the wait are excluded.',
             to_char(new.response_due_at at time zone 'UTC', 'FMDD Mon HH24:MI'), to_char(new.answered_at at time zone 'UTC', 'FMDD Mon HH24:MI')),
      new.operator_id);
  end if;
  return new;
end;
$$;

create or replace function app.on_operator_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('in_training', 'certified', 'placed') then
    perform app.notify_template(new.id,
      case new.status when 'in_training' then 'stage_training' when 'certified' then 'stage_certified' else 'stage_placed' end,
      '{}'::jsonb, '/vistrial/operator');
  end if;
  return new;
end;
$$;

create or replace function app.on_pay_statement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.pay_period;
begin
  select * into v_period from public.pay_period where id = new.period_id;
  perform app.notify_template(new.operator_id, 'pay_statement_ready',
    jsonb_build_object('period', coalesce(to_char(v_period.start_date, 'FMMon FMDD') || ' to ' || to_char(v_period.end_date, 'FMMon FMDD'), 'this period')),
    '/vistrial/operator/pay#' || new.id, new.placement_id);
  return new;
end;
$$;

create or replace function app.on_payout_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'sent' then
    perform app.notify_template(new.operator_id, 'payout_sent',
      jsonb_build_object('amount', '$' || to_char(new.amount, 'FM999G999G990D00'),
                         'date', app.op_time(new.operator_id, coalesce(new.sent_at, now()), 'FMMon FMDD')),
      '/vistrial/operator/pay', new.placement_id);
  elsif new.status in ('failed', 'returned') then
    perform app.notify_template(new.operator_id, 'payout_failed',
      jsonb_build_object('amount', '$' || to_char(new.amount, 'FM999G999G990D00'),
                         'date', app.op_time(new.operator_id, coalesce(new.sent_at, now()), 'FMMon FMDD'),
                         'reason', coalesce(nullif(btrim(new.failure_reason), ''), 'the payment was not accepted')),
      '/vistrial/operator/profile#payout', new.placement_id);
  end if;
  return new;
end;
$$;

create or replace function app.on_blocking_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op uuid;
begin
  if not new.blocking then
    return new;
  end if;
  select o.id into v_op from public.operator o where o.profile_id = new.profile_id;
  if v_op is not null then
    perform app.notify_template(v_op, 'blocking_notice', '{}'::jsonb, '/vistrial/operator');
  end if;
  return new;
end;
$$;

-- A report filed or corrected for a drafted shift carries the draft's counts and confirms it.
create or replace function app.link_report_to_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.shift_draft;
begin
  select * into v_draft from public.shift_draft where placement_id = new.placement_id and shift_date = new.shift_date;
  if v_draft.id is not null then
    new.system_counts := coalesce(v_draft.system_counts, '{}'::jsonb) || coalesce(new.system_counts, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists eod_report_link_draft on public.eod_report;
create trigger eod_report_link_draft before insert on public.eod_report
  for each row execute function app.link_report_to_draft();

create or replace function app.confirm_draft_from_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shift_draft
     set status = 'confirmed', eod_report_id = new.id, confirmed_at = coalesce(confirmed_at, now())
   where placement_id = new.placement_id and shift_date = new.shift_date;
  return new;
end;
$$;

drop trigger if exists eod_report_confirm_draft on public.eod_report;
create trigger eod_report_confirm_draft after insert on public.eod_report
  for each row execute function app.confirm_draft_from_report();

create or replace function app.pay_period_end_for(p_date date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  -- The recorded period, or the twice-monthly schedule (1st to 15th, 16th to month end) when none is recorded yet.
  select coalesce(
    (select pp.end_date from public.pay_period pp where p_date between pp.start_date and pp.end_date order by pp.end_date limit 1),
    case when extract(day from p_date) <= 15 then date_trunc('month', p_date)::date + 14
         else (date_trunc('month', p_date) + interval '1 month - 1 day')::date end);
$$;

create or replace function app.ensure_shift_drafts(p_pl public.placement)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a record;
  v_counts jsonb;
  v_report uuid;
  v_new integer := 0;
  v_next timestamptz;
begin
  for a in
    select * from app.placement_attendance(p_pl.id, (now() at time zone app.safe_tz(p_pl.time_zone))::date - 3,
                                           (now() at time zone app.safe_tz(p_pl.time_zone))::date) x
    where x.ends_at <= now()
      and not exists (select 1 from public.shift_draft d where d.placement_id = p_pl.id and d.shift_date = x.shift_date)
  loop
    -- An absence the VA reported, or a decided excuse: nothing to review.
    continue when a.status in ('notified_absence', 'excused_emergency', 'abandoned');
    v_counts := app.window_activity(p_pl, a.starts_at, a.ends_at);
    v_next := app.next_shift_start(p_pl, a.ends_at);
    select r.id into v_report from public.eod_report r
    where r.placement_id = p_pl.id and r.shift_date = a.shift_date and r.superseded_by_id is null;

    insert into public.shift_draft (placement_id, operator_id, shift_date, starts_at, ends_at, system_counts,
                                    status, confirm_by, eod_report_id, confirmed_at)
    values (p_pl.id, p_pl.operator_id, a.shift_date, a.starts_at, a.ends_at, v_counts,
            case when v_report is not null then 'confirmed' else 'open' end,
            coalesce(v_next, a.ends_at + interval '24 hours'),
            v_report, case when v_report is not null then now() end)
    on conflict (placement_id, shift_date) do nothing;

    if v_report is null then
      v_new := v_new + 1;
      perform app.notify_template(p_pl.operator_id, 'shift_review_ready',
        jsonb_build_object('shift_day', to_char(a.shift_date, 'FMDy, Mon FMDD'),
                           'next_shift', coalesce(app.op_time(p_pl.operator_id, v_next, 'FMDy, Mon FMDD "at" FMHH12:MI AM') || ' your time',
                                                  'within 24 hours')),
        '/vistrial/operator/record?review=' || a.shift_date::text || '&placement=' || p_pl.id, p_pl.id);
    end if;

    if coalesce((v_counts ->> 'ambiguous')::integer, 0) > 0 then
      update public.shift_draft set flagged_at = now() where placement_id = p_pl.id and shift_date = a.shift_date;
      perform app.notify_staff(app.admin_recipient_ids() || app.placement_manager_ids(p_pl.id),
        'attribution.ambiguous', 'important',
        format('Attribution unclear on %s, %s', app.placement_client_name(p_pl), to_char(a.shift_date, 'FMDy DD Mon')),
        format('%s lead or touch records came in untagged while another placement on this client was also on shift. They were left out of this VA''s draft and standards rather than guessed. Review them on the team board.',
               v_counts ->> 'ambiguous'),
        p_pl.operator_id);
    end if;
  end loop;
  return v_new;
end;
$$;

-- Whether now is inside the VA's working hours: on shift on a live placement, or,
-- with no live placement, 9:00 to 18:00 on a weekday in their own time zone.
create or replace function app.operator_in_working_hours(p_operator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.placement pl where pl.operator_id = p_operator_id and app.placement_is_live(pl))
      then exists (select 1 from public.placement pl where pl.operator_id = p_operator_id and app.placement_is_live(pl)
                     and app.on_shift_now(pl))
    else extract(isodow from now() at time zone app.op_tz(p_operator_id)) < 6
     and extract(hour from now() at time zone app.op_tz(p_operator_id)) between 9 and 17
  end;
$$;

create or replace function app.sweep_va_accountability()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_drafts integer := 0;
  v_unconfirmed integer := 0;
  v_alerts integer := 0;
  d record;
  s record;
  q record;
  v_std jsonb;
  v_row jsonb;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_this_week date := date_trunc('week', now() at time zone 'UTC')::date;
  v_last_week date := (date_trunc('week', now() at time zone 'UTC') - interval '7 days')::date;
  v_progress jsonb;
begin
  for v_pl in select * from public.placement p where p.status = 'active' loop
    v_drafts := v_drafts + app.ensure_shift_drafts(v_pl);
  end loop;

  -- Not confirmed by the next shift start: it stands as the record, with exactly one reminder.
  for d in
    update public.shift_draft set status = 'unconfirmed', reminded_at = now()
     where status = 'open' and confirm_by <= now() and reminded_at is null
    returning *
  loop
    v_unconfirmed := v_unconfirmed + 1;
    perform app.notify_template(d.operator_id, 'shift_review_unconfirmed',
      jsonb_build_object('shift_day', to_char(d.shift_date, 'FMDy, Mon FMDD'),
                         'shift_day_short', to_char(d.shift_date, 'FMMon FMDD'),
                         'period_closes', coalesce(to_char(app.pay_period_end_for(d.shift_date), 'FMMon FMDD'), 'the end of the pay period')),
      '/vistrial/operator/record?review=' || d.shift_date::text || '&placement=' || d.placement_id, d.placement_id);
  end loop;

  -- Suspected missed shifts: ask the VA, decide nothing.
  for s in
    update public.shift_attendance set va_notified_at = now()
     where status = 'suspected_missed' and flagged_at is not null and va_notified_at is null and decided_at is null
    returning *
  loop
    perform app.notify_template(s.operator_id, 'suspected_missed',
      jsonb_build_object('shift_day', to_char(s.shift_date, 'FMDy, Mon FMDD'), 'shift_day_short', to_char(s.shift_date, 'FMMon FMDD')),
      '/vistrial/operator/record?tab=attendance&placement=' || s.placement_id, s.placement_id);
  end loop;

  -- Standard at risk from mid-month, once per standard per month.
  if extract(day from now() at time zone 'UTC') >= 15 then
    for v_op in select o.* from public.operator o where app.operator_stage(o) = 'placed' loop
      v_std := app.va_standard_rows(v_op.id, v_month) -> 'standards';
      for v_row in select * from jsonb_array_elements(v_std) loop
        continue when v_row ->> 'status' <> 'at_risk';
        continue when exists (select 1 from public.standard_alert a where a.operator_id = v_op.id
                               and a.standard_key = v_row ->> 'key' and a.month = v_month);
        insert into public.standard_alert (operator_id, standard_key, month) values (v_op.id, v_row ->> 'key', v_month);
        v_alerts := v_alerts + 1;
        perform app.notify_template(v_op.id, 'standard_at_risk',
          jsonb_build_object(
            'standard', case v_row ->> 'key' when 'va_first_response' then 'response time'
                                             when 'va_shift_coverage' then 'shift coverage'
                                             when 'va_reviews_confirmed' then 'shift reviews'
                                             when 'va_booking_quota' then 'booking quota'
                                             else lower(v_row ->> 'label') end,
            'standard_long', lower(v_row ->> 'label'),
            'month', to_char(v_month, 'FMMonth'),
            'value', case when v_row ->> 'unit' = 'percent' then (v_row ->> 'value') || '%' else (v_row ->> 'value') || ' ' || (v_row ->> 'unit') end,
            'target', case when v_row ->> 'unit' = 'percent' then (v_row ->> 'target') || '%' else (v_row ->> 'target') || ' ' || (v_row ->> 'unit') end,
            'tip', case v_row ->> 'key'
                     when 'va_first_response' then 'Your playbook''s holding lines are the fastest way to get a first reply out.'
                     when 'va_shift_coverage' then 'Report any absence before the shift starts so it counts as advance notice.'
                     when 'va_reviews_confirmed' then 'Confirm each shift review before your next shift starts.'
                     when 'va_booking_quota' then 'Bookings count once they are confirmed on the client''s calendar.'
                     else '' end),
          '/vistrial/operator/standards?key=' || (v_row ->> 'key'));
      end loop;
    end loop;
  end if;

  -- DA's own misses DA must hear about: pay questions past their answer time.
  for q in
    update public.pay_question set overdue_alerted_at = now()
     where answered_at is null and overdue_alerted_at is null
       and app.add_business_days(asked_at, coalesce((select target_value from public.da_commitment where key = 'pay_questions'), 2)::integer) < now()
    returning *
  loop
    perform app.notify_staff(app.admin_recipient_ids(), 'da_miss.pay_question', 'urgent',
      'DA miss: a pay question is past its answer time',
      'It shows on the operator''s DA''s Commitments until it is answered.', q.operator_id);
  end loop;

  -- Weekly feedback owed after Monday end of day.
  if now() >= (v_last_week + 8)::timestamp at time zone 'UTC' then
    for v_op in
      select o.* from public.operator o
      where app.operator_stage(o) = 'placed'
        and not exists (select 1 from public.weekly_feedback f where f.operator_id = o.id and f.week_start = v_last_week)
        and not exists (select 1 from public.staff_notification n where n.kind = 'da_miss.feedback' and n.operator_id = o.id
                          and n.created_at >= (v_last_week + 7)::timestamp at time zone 'UTC')
    loop
      perform app.notify_staff(
        app.admin_recipient_ids() || coalesce((select array_agg(x) from (
          select unnest(app.placement_manager_ids(p.id)) x from public.placement p where p.operator_id = v_op.id and app.placement_is_live(p)) y), '{}'::uuid[]),
        'da_miss.feedback', 'important',
        format('DA miss: weekly feedback owed to %s', v_op.name),
        format('Feedback for the week of %s was due by Monday end of day.', to_char(v_last_week, 'FMDD Mon')), v_op.id);
    end loop;
  end if;

  -- Sunday afternoon: the week in review, once a week (optional message).
  if extract(isodow from now() at time zone 'UTC') = 7 and extract(hour from now() at time zone 'UTC') >= 12 then
    for v_op in
      select o.* from public.operator o
      where app.operator_stage(o) = 'placed'
        and not exists (select 1 from public.operator_notification n where n.operator_id = o.id and n.kind = 'weekly_summary'
                          and n.created_at >= v_this_week::timestamp at time zone 'UTC')
    loop
      perform app.notify_template(v_op.id, 'weekly_summary', '{}'::jsonb, '/vistrial/operator/growth#self-review');
    end loop;
  end if;

  -- Tier eligibility: tell admins once. Nothing changes until an admin decides.
  for v_op in select o.* from public.operator o where app.operator_stage(o) = 'placed' and coalesce(o.tier, 1) < 3 loop
    v_progress := app.tier_progress(v_op.id);
    if (v_progress ->> 'eligible')::boolean
       and not exists (select 1 from public.tier_eligibility te where te.operator_id = v_op.id and te.to_tier = (v_progress ->> 'next_tier')::smallint) then
      insert into public.tier_eligibility (operator_id, to_tier) values (v_op.id, (v_progress ->> 'next_tier')::smallint);
      perform app.notify_staff(app.admin_recipient_ids(), 'tier.eligible', 'important',
        format('%s meets every criterion for Tier %s', v_op.name, v_progress ->> 'next_tier'),
        'Recommendation: review and approve or decline. The tier does not change until an admin decides.', v_op.id);
    end if;
  end loop;

  return jsonb_build_object('drafts', v_drafts, 'unconfirmed', v_unconfirmed, 'standard_alerts', v_alerts);
end;
$$;

