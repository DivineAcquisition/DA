-- The VA account after onboarding: the record is the referee.
--
-- This migration adds the data and the shared calculations behind Prompt 8:
--   * the account's stage, derived from the operator's existing status and
--     whether a placement is live (no new stages);
--   * shift drafts written by the system from real activity, which the VA
--     confirms or corrects (both values kept);
--   * standards defined once in metric_definition and calculated once, in
--     app.va_response_items / app.va_shift_items / app.va_standard_rows, for
--     the VA, the manager, View As and every screen;
--   * exclusions (outage windows, excused shifts, approved disputes, DA's own
--     late answers) so a VA is only measured on what they control;
--   * DA's commitments to the VA and its misses;
--   * tier criteria, weekly feedback, self-review, formal notices;
--   * the notification layer: kinds, urgency, links to the record, delivery
--     attempts per channel.
-- Nothing here penalises, demotes, deducts or terminates anyone. It flags and
-- proposes; a named person decides.

-- 1. Standards live in metric_definition ------------------------------------

alter table public.metric_definition
  add column if not exists standard_target numeric,
  add column if not exists agreement_section text;

comment on column public.metric_definition.standard_target is
  'For category va_standard: the target in the metric''s unit. Null when the target comes from the Placement Order.';

insert into public.metric_definition (key, label, unit, direction, category, sort_order, help, aggregation, standard_target, agreement_section)
values
  ('va_first_response', 'First response within 5 minutes', 'percent', 'up_is_good', 'va_standard', 900,
   'Leads that came in during your shift and got your first reply within the response standard, divided by all leads that came in during your shift.',
   'latest', 95, '5.1'),
  ('va_shift_coverage', 'Shift coverage', 'percent', 'up_is_good', 'va_standard', 910,
   'Scheduled shifts you worked or gave advance notice for, divided by all your scheduled shifts that have ended. Excused shifts are left out.',
   'latest', 100, '5.2, 6'),
  ('va_reviews_confirmed', 'Shift reviews confirmed', 'percent', 'up_is_good', 'va_standard', 920,
   'Worked shifts with a confirmed review, divided by all shifts you worked.',
   'latest', 100, '5.4'),
  ('va_booking_quota', 'Monthly booking quota', 'bookings', 'up_is_good', 'va_standard', 930,
   'Bookings that count toward quota this month (the same rule payroll uses), against the quota in your Placement Order.',
   'latest', null, '7.2'),
  ('va_escalation_discipline', 'Escalation discipline', 'findings', 'down_is_good', 'va_standard', 940,
   'Matters that should have been escalated but were answered without DA, as recorded by your manager with the details. The standard is none.',
   'latest', 0, '5.6'),
  ('va_productive_time', 'Productive time', 'percent', 'up_is_good', 'va_standard', 950,
   'Productive minutes recorded for the weeks we have data for, divided by the weekly threshold in your Placement Order for those weeks. Weeks with no data are left out, never counted as zero.',
   'latest', 100, '9.3, 9.4')
on conflict (key) do nothing;

-- Client growth reports list every client metric; VA standards are not one.
create or replace function public.growth_for_case_file(p_case_file_id uuid)
returns table(metric_key text, label text, unit text, category text, direction public.metric_direction, sort_order integer,
              baseline_value numeric, baseline_source public.measurement_source, current_value numeric,
              current_source public.measurement_source, absolute_change numeric, percent_change numeric,
              improved boolean, current_snapshot_at timestamptz)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with baseline as (
    select s.id from public.snapshot s where s.case_file_id = p_case_file_id and s.kind = 'baseline'
  ),
  latest as (
    select s.id, s.taken_at from public.snapshot s
    where s.case_file_id = p_case_file_id and s.kind = 'progress'
    order by coalesce(s.period_end, s.taken_at::date) desc, s.taken_at desc
    limit 1
  )
  select d.key, d.label, d.unit, d.category, d.direction, d.sort_order,
         b.value, b.source, c.value, c.source,
         case when b.value is null or c.value is null then null else round(c.value - b.value, 2) end,
         case when b.value is null or c.value is null then null when b.value = 0 then null
              else round(((c.value - b.value) / abs(b.value)) * 100, 1) end,
         case when b.value is null or c.value is null then null
              when d.direction = 'up_is_good' then c.value > b.value else c.value < b.value end,
         l.taken_at
  from public.metric_definition d
  left join baseline bs on true
  left join latest l on true
  left join public.snapshot_metric b on b.snapshot_id = bs.id and b.metric_key = d.key
  left join public.snapshot_metric c on c.snapshot_id = l.id and c.metric_key = d.key
  where d.category <> 'va_standard'
  order by d.sort_order;
$function$;

-- 2. Settings ------------------------------------------------------------------

create table if not exists public.team_setting (
  id smallint primary key default 1 check (id = 1),
  from_name text not null default 'Divine Acquisition Team',
  from_address text not null default 'team@notify.divineacquisition.io',
  reply_to text,
  base_url text not null default 'https://team.divineacquisition.io',
  inactive_access_months integer not null default 12 check (inactive_access_months between 0 and 120),
  updated_by uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.team_setting (id) values (1) on conflict do nothing;

-- What DA promises every VA. Targets are admin-configurable.
create table if not exists public.da_commitment (
  key text primary key,
  label text not null,
  target_label text not null,
  target_value numeric,
  sort_order integer not null default 100
);
insert into public.da_commitment (key, label, target_label, target_value, sort_order) values
  ('escalations', 'Answer escalations', 'Within the escalation response hours in your placement', null, 10),
  ('pay_on_schedule', 'Pay on schedule', 'Payout sent within this many days of the pay period ending', 5, 20),
  ('pay_questions', 'Answer pay questions', 'Within this many business days', 2, 30),
  ('weekly_feedback', 'Weekly feedback', 'Posted by Monday end of day (UTC) for the week before', 0, 40),
  ('playbook_changes', 'Playbook changes announced', 'You are told when your playbook changes', null, 50),
  ('rule_changes', 'Rule changes announced', 'A notice you confirm before any change to standards or pay', null, 60)
on conflict (key) do nothing;

-- 3. New columns -----------------------------------------------------------------

alter table public.placement
  add column if not exists productive_minutes_weekly integer check (productive_minutes_weekly is null or productive_minutes_weekly > 0);
comment on column public.placement.productive_minutes_weekly is
  'Productive-time threshold per week from the Placement Order. Null until set; the standard then shows "Not yet measured".';

alter table public.operator
  add column if not exists email_digest boolean not null default true,
  add column if not exists last_digest_at timestamptz;

alter table public.shift_attendance
  add column if not exists va_notified_at timestamptz;

alter table public.pay_question
  add column if not exists overdue_alerted_at timestamptz;

alter table public.operator_notification
  add column if not exists kind text not null default 'general',
  add column if not exists urgency text not null default 'normal',
  add column if not exists link_path text,
  add column if not exists required boolean not null default true,
  add column if not exists email_subject text,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists formal_notice_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'operator_notification_urgency_chk') then
    alter table public.operator_notification add constraint operator_notification_urgency_chk
      check (urgency in ('immediate', 'normal'));
  end if;
end
$$;

create index if not exists operator_notification_unclaimed_idx
  on public.operator_notification (created_at) where email_claimed_at is null;

-- 4. New tables ---------------------------------------------------------------------

-- When a certified or benched VA can work, for matching to placements.
create table if not exists public.operator_availability (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  iso_day smallint not null check (iso_day between 1 and 7),
  starts text not null check (starts ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  ends text not null check (ends ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  time_zone text not null,
  updated_at timestamptz not null default now()
);
create index if not exists operator_availability_operator_idx on public.operator_availability (operator_id);

-- The system's draft of one shift, which the VA confirms or corrects.
create table if not exists public.shift_draft (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  shift_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  system_counts jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'confirmed', 'unconfirmed')),
  confirm_by timestamptz,
  eod_report_id uuid references public.eod_report (id) on delete set null,
  reminded_at timestamptz,
  flagged_at timestamptz,
  reflection_went_well text,
  reflection_differently text,
  reflection_in_way text,
  drafted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (placement_id, shift_date)
);
create index if not exists shift_draft_operator_idx on public.shift_draft (operator_id, shift_date desc);

-- Blockers the VA names on a shift, sorted by who controlled them.
create table if not exists public.shift_blocker (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.shift_draft (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  shift_date date not null,
  control text not null check (control in ('mine', 'client', 'da', 'outside')),
  note text not null check (length(btrim(note)) between 2 and 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profile (id) on delete set null,
  resolution text
);

-- Windows DA marks as an outage or client-side incident: excluded for every VA on the placement.
create table if not exists public.exclusion_window (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  kind text not null check (kind in ('outage', 'client_incident')),
  reason text not null check (length(btrim(reason)) between 3 and 1000),
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);

-- A VA's dispute of one measured item.
create table if not exists public.standard_dispute (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  standard_key text not null references public.metric_definition (key),
  item_kind text not null check (item_kind in ('lead', 'shift', 'booking')),
  item_id text not null,
  item_label text,
  explanation text not null check (length(btrim(explanation)) between 5 and 2000),
  status text not null default 'open' check (status in ('open', 'approved', 'declined')),
  raised_at timestamptz not null default now(),
  decided_by uuid references public.profile (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  outcome_read_at timestamptz
);
create index if not exists standard_dispute_operator_idx on public.standard_dispute (operator_id, raised_at desc);

-- A manager's recorded finding against a standard that has no automatic signal.
create table if not exists public.standard_finding (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  standard_key text not null references public.metric_definition (key),
  occurred_on date not null,
  note text not null check (length(btrim(note)) between 5 and 2000),
  recorded_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Productive minutes per week, entered by an admin until the monitoring tool is connected.
create table if not exists public.productive_time (
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  minutes integer not null check (minutes between 0 and 10080),
  entered_by uuid references public.profile (id) on delete set null,
  entered_at timestamptz not null default now(),
  primary key (operator_id, placement_id, week_start)
);

-- Tier ladder: admin-defined criteria, admin-decided changes.
create table if not exists public.tier_criterion (
  id uuid primary key default gen_random_uuid(),
  tier smallint not null check (tier between 2 and 3),
  kind text not null check (kind in ('months_placed', 'standards_met_months', 'zero_abandonments_days', 'training_complete')),
  threshold numeric not null default 0,
  label text not null,
  sort_order integer not null default 100
);

-- Starting criteria. Admins change them in settings; nothing reads them from code.
insert into public.tier_criterion (tier, kind, threshold, label, sort_order)
select * from (values
  (2::smallint, 'months_placed', 3::numeric, 'Placed for 3 months', 10),
  (2::smallint, 'standards_met_months', 2::numeric, 'Every standard met for 2 months in a row', 20),
  (2::smallint, 'zero_abandonments_days', 60::numeric, 'No abandoned shifts in the last 60 days', 30),
  (2::smallint, 'training_complete', 1::numeric, 'All assigned training completed', 40),
  (3::smallint, 'months_placed', 9::numeric, 'Placed for 9 months', 10),
  (3::smallint, 'standards_met_months', 4::numeric, 'Every standard met for 4 months in a row', 20),
  (3::smallint, 'zero_abandonments_days', 120::numeric, 'No abandoned shifts in the last 120 days', 30),
  (3::smallint, 'training_complete', 1::numeric, 'All assigned training completed', 40)
) v(tier, kind, threshold, label, sort_order)
where not exists (select 1 from public.tier_criterion);

create table if not exists public.tier_decision (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  from_tier smallint,
  to_tier smallint not null,
  decision text not null check (decision in ('approved', 'declined')),
  reason text not null check (length(btrim(reason)) between 3 and 2000),
  decided_by uuid references public.profile (id) on delete set null,
  decided_at timestamptz not null default now()
);

create table if not exists public.tier_eligibility (
  operator_id uuid not null references public.operator (id) on delete cascade,
  to_tier smallint not null,
  eligible_at timestamptz not null default now(),
  decision_id uuid references public.tier_decision (id) on delete set null,
  primary key (operator_id, to_tier)
);

-- Weekly feedback from the manager, and the VA's own weekly line before it.
create table if not exists public.weekly_feedback (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  keep_doing text not null check (length(btrim(keep_doing)) between 3 and 1000),
  improve text not null check (length(btrim(improve)) between 3 and 1000),
  focus text not null check (length(btrim(focus)) between 3 and 300),
  author_profile_id uuid references public.profile (id) on delete set null,
  author_name text not null,
  posted_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  reply text,
  replied_at timestamptz,
  unique (operator_id, week_start)
);

create table if not exists public.weekly_self_review (
  operator_id uuid not null references public.operator (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  focus_line text not null check (length(btrim(focus_line)) between 3 and 300),
  submitted_at timestamptz not null default now(),
  primary key (operator_id, week_start)
);

-- Formal notices: drafted from a template, reviewed and sent by an admin only.
create table if not exists public.formal_notice (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  template_key text not null,
  subject text not null,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  drafted_by uuid references public.profile (id) on delete set null,
  drafted_at timestamptz not null default now(),
  approved_by uuid references public.profile (id) on delete set null,
  sent_at timestamptz,
  reply text,
  replied_at timestamptz
);

-- A formal notice reaches a VA only once an admin approved and sent it.
alter table public.operator_notification
  drop constraint if exists operator_notification_formal_notice_fk;
alter table public.operator_notification
  add constraint operator_notification_formal_notice_fk foreign key (formal_notice_id) references public.formal_notice (id) on delete set null;

-- Standard alerts already sent, so each goes once.
create table if not exists public.standard_alert (
  operator_id uuid not null references public.operator (id) on delete cascade,
  standard_key text not null,
  month date not null,
  sent_at timestamptz not null default now(),
  primary key (operator_id, standard_key, month)
);

-- Reads: staff through RLS, the VA only through portal functions. Writes only through functions.
do $$
declare
  t text;
begin
  foreach t in array array['team_setting', 'da_commitment', 'operator_availability', 'shift_draft', 'shift_blocker',
                           'exclusion_window', 'standard_dispute', 'standard_finding', 'productive_time',
                           'tier_criterion', 'tier_decision', 'tier_eligibility', 'weekly_feedback',
                           'weekly_self_review', 'formal_notice', 'standard_alert'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_admin())', t || '_admin_read', t);
  end loop;
end
$$;

-- 5. Permissions ---------------------------------------------------------------------

insert into public.permission (key, label, category, description, sort_order, is_destructive, requires_step_up, blocked_during_impersonation)
values
  ('portal.disputes.raise', 'Dispute a measurement', 'Sales Operator portal',
   'Dispute one measured item on a standard, with an explanation.', 1000, false, false, true),
  ('portal.feedback.ack', 'Acknowledge feedback', 'Sales Operator portal',
   'Acknowledge weekly feedback and reply once.', 1010, false, false, true),
  ('portal.self_review.submit', 'Weekly self-review', 'Sales Operator portal',
   'Write the weekly focus line.', 1020, false, false, true),
  ('portal.notice.reply', 'Reply to a formal notice', 'Sales Operator portal',
   'Reply to a formal notice; the reply is kept with it.', 1030, false, false, true),
  ('standards.decide', 'Decide on standards', 'Work',
   'Decide disputes, resolve blockers, mark outage windows and record findings.', 780, false, false, true),
  ('feedback.write', 'Write weekly feedback', 'Work',
   'Post weekly feedback to an operator in scope.', 790, false, false, true),
  ('notices.formal', 'Send formal notices', 'Accounts',
   'Review and send a formal notice to an operator. Never automatic.', 116, false, false, true)
on conflict (key) do nothing;

insert into public.role_permission (role, permission_key)
select 'operator'::public.user_role, k
from unnest(array['portal.disputes.raise', 'portal.feedback.ack', 'portal.self_review.submit', 'portal.notice.reply']) k
on conflict do nothing;

insert into public.role_permission (role, permission_key)
select r::public.user_role, k
from unnest(array['owner', 'admin', 'manager']) r, unnest(array['standards.decide', 'feedback.write']) k
on conflict do nothing;

insert into public.role_permission (role, permission_key)
select r::public.user_role, 'notices.formal' from unnest(array['owner', 'admin']) r
on conflict do nothing;

-- 6. Stage --------------------------------------------------------------------------

-- Where the VA is, from the existing status and whether a placement is live.
--   applicant | training | waiting (certified / bench) | placed | inactive
create or replace function app.operator_stage(p_op public.operator)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_op.status = 'inactive'
      or exists (select 1 from public.offboarding ob
                 where ob.profile_id = p_op.profile_id
                   and (ob.suspended_at is not null or ob.archived_at is not null or ob.completed_at is not null))
      then 'inactive'
    when p_op.status = 'applicant' then 'applicant'
    when p_op.status = 'in_training' then 'training'
    when exists (select 1 from public.placement pl where pl.operator_id = p_op.id and app.placement_is_live(pl)) then 'placed'
    else 'waiting'
  end;
$$;

create or replace function app.operator_inactive_since(p_op public.operator)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select coalesce(ob.completed_at, ob.archived_at, ob.suspended_at) from public.offboarding ob where ob.profile_id = p_op.profile_id),
    p_op.updated_at);
$$;

-- The operator for this request. The portal is closed to anyone inactive, except
-- for the read-only pay and agreements pages (p_allow_inactive), which stay open
-- for team_setting.inactive_access_months after they left.
drop function if exists app.portal_operator();
create or replace function app.portal_operator(p_allow_inactive boolean default false)
returns public.operator
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile uuid := app.acting_profile();
  v_row public.operator;
  v_state public.account_state;
  v_months integer;
begin
  if v_profile is null then
    raise exception 'not_signed_in: sign in first' using errcode = '42501';
  end if;

  select * into v_row from public.operator where profile_id = v_profile;
  if v_row.id is null then
    raise exception 'not_an_operator: this account has no Sales Operator portal' using errcode = '42501';
  end if;

  if exists (select 1 from public.lockdown l where l.released_at is null) then
    raise exception 'lockdown: the system is locked down until the Owner releases it' using errcode = '42501';
  end if;

  v_state := app.effective_state(v_profile);

  if app.operator_stage(v_row) = 'inactive' then
    select inactive_access_months into v_months from public.team_setting where id = 1;
    if not p_allow_inactive
       or v_state not in ('active', 'suspended')
       or now() > app.operator_inactive_since(v_row) + make_interval(months => coalesce(v_months, 12)) then
      raise exception 'portal_closed: your account is closed. Pay statements and agreements stay available for a period after you leave.'
        using errcode = '42501';
    end if;
    return v_row;
  end if;

  if v_state is distinct from 'active' then
    raise exception 'portal_closed: this account is not active, so the portal is closed' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- Trainees and applicants see no live placement, customer or lead at all.
create or replace function app.portal_placement_ids(p_operator public.operator)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id
  from public.placement pl
  where pl.operator_id = p_operator.id
    and pl.status <> 'draft'
    and app.operator_stage(p_operator) in ('placed', 'waiting')
    and (
      not exists (select 1 from public.account_scope s where s.profile_id = p_operator.profile_id)
      or app.scope_includes_placement(p_operator.profile_id, pl.id)
    )
    and (
      not app.is_impersonating()
      or app.actor_role() in ('owner', 'admin')
      or app.scope_includes_placement(auth.uid(), pl.id)
    );
$$;

create or replace function app.portal_placement(p_operator public.operator, p_placement_id uuid)
returns public.placement
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row public.placement;
begin
  if app.operator_stage(p_operator) in ('applicant', 'training') then
    raise exception 'training_only: until you are certified you work with sample data only, never live customers' using errcode = '42501';
  end if;
  if p_placement_id is null or p_placement_id not in (select app.portal_placement_ids(p_operator)) then
    raise exception 'placement_not_found: that placement is not one of yours' using errcode = '42501';
  end if;
  select * into v_row from public.placement where id = p_placement_id;
  return v_row;
end;
$$;

-- 7. Activity during a window, attributed to the placement's operator -----------------

-- Whether any other active placement on the same client is on shift at that moment.
create or replace function app.other_placement_on_shift(p_pl public.placement, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.placement o
    cross join lateral (values ((p_at at time zone app.safe_tz(o.time_zone))::date), ((p_at at time zone app.safe_tz(o.time_zone))::date - 1)) d(day)
    cross join lateral app.shift_bounds(o, d.day) b
    where o.case_file_id = p_pl.case_file_id and o.id <> p_pl.id and o.status = 'active'
      and extract(isodow from d.day)::smallint = any(o.working_days)
      and b.starts_at <= p_at and b.ends_at > p_at
  );
$$;

-- Whether this client has lead tracking flowing (touches in the last 30 days).
create or replace function app.tracking_live(p_case_file_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.lead_touch t
                 where t.case_file_id = p_case_file_id and t.occurred_at > p_at - interval '30 days' and t.occurred_at <= p_at + interval '1 day');
$$;

-- Everything that happened on a placement in a window, counted the way the draft,
-- My Day and the standards count it.
--
-- Attribution: a touch or lead belongs to this placement's VA when it is tagged
-- with this placement, or when it is untagged on the same client and no other
-- placement on that client is on shift at that moment. When another placement is
-- on shift, it is ambiguous: left out and counted in "ambiguous" for a manager.
create or replace function app.window_activity(p_pl public.placement, p_starts timestamptz, p_ends timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tracking boolean := app.tracking_live(p_pl.case_file_id, p_ends);
  v_standard integer := coalesce(p_pl.response_standard_minutes, 5);
  v_out jsonb;
begin
  with t as (
    select lt.*,
           (lt.placement_id is null and app.other_placement_on_shift(p_pl, lt.occurred_at)) as ambiguous
    from public.lead_touch lt
    where lt.case_file_id = p_pl.case_file_id
      and lt.occurred_at >= p_starts and lt.occurred_at < p_ends
      and (lt.placement_id = p_pl.id or lt.placement_id is null)
  ),
  mine as (select * from t where not ambiguous),
  leads_in as (
    select l.*,
           (l.placement_id is null and app.other_placement_on_shift(p_pl, l.lead_in_at)) as ambiguous
    from public.lead l
    where l.case_file_id = p_pl.case_file_id
      and l.lead_in_at >= p_starts and l.lead_in_at < p_ends
      and (l.placement_id = p_pl.id or l.placement_id is null)
  ),
  booked as (
    select b.* from public.booking b
    where b.placement_id = p_pl.id and b.state <> 'rejected'
      and ((b.source = 'manual' and b.recorded_at >= p_starts and b.recorded_at < p_ends)
        or (b.source = 'ghl' and b.created_at >= p_starts and b.created_at < p_ends))
  ),
  esc as (
    select e.* from public.escalation e
    where e.placement_id = p_pl.id and e.raised_at >= p_starts and e.raised_at < p_ends
  ),
  activity as (
    select occurred_at as at from mine where direction = 'outbound'
    union all select recorded_at from booked where source = 'manual'
    union all select raised_at from esc
  )
  select jsonb_build_object(
    'tracking', v_tracking,
    'conversations', case when v_tracking then (select count(distinct lead_id) from mine where direction = 'outbound') end,
    'touches_outbound', case when v_tracking then (select count(*) from mine where direction = 'outbound') end,
    'touches_inbound', case when v_tracking then (select count(*) from mine where direction = 'inbound') end,
    'touches_by_channel', case when v_tracking then coalesce((
       select jsonb_object_agg(x.channel, x.n) from (select coalesce(channel, 'other') as channel, count(*) as n from mine group by 1) x
     ), '{}'::jsonb) end,
    'follow_ups', case when v_tracking then (
       select count(distinct m.lead_id) from mine m
       where m.direction = 'outbound'
         and exists (select 1 from public.lead_touch p where p.lead_id = m.lead_id and p.occurred_at < p_starts)) end,
    'appointments_booked', (select count(*) from booked),
    'escalations_raised', (select count(*) from esc),
    'leads_in', case when v_tracking then (select count(*) from leads_in where not ambiguous) end,
    'responded_in_standard', case when v_tracking then (
       select count(*) from leads_in
       where not ambiguous and first_touch_at is not null
         and first_touch_at <= lead_in_at + make_interval(mins => v_standard)) end,
    'median_response_minutes', case when v_tracking then (
       select round((percentile_cont(0.5) within group (order by extract(epoch from (first_touch_at - lead_in_at)) / 60.0))::numeric, 1)
       from leads_in where not ambiguous and first_touch_at is not null) end,
    'first_activity_at', case when v_tracking then (select min(at) from activity) else (select min(at) from activity) end,
    'last_activity_at', (select max(at) from activity),
    'ambiguous', (select count(*) from t where ambiguous) + (select count(*) from leads_in where ambiguous),
    'response_standard_minutes', v_standard
  ) into v_out;
  return v_out;
end;
$$;

-- 8. Attendance also counts outbound touches, and a draft that stood unconfirmed ----------

create or replace function app.placement_attendance(p_placement_id uuid, p_from date, p_to date)
returns table(
  shift_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  late_notice boolean,
  reason text,
  recorded_status text,
  decided_by_name text,
  decided_at timestamptz,
  notice_at timestamptz,
  has_report boolean,
  has_activity boolean,
  attendance_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pl public.placement;
  v_first date;
  v_last date;
begin
  select * into v_pl from public.placement where id = p_placement_id;
  if v_pl.id is null or v_pl.status = 'draft'
     or coalesce(v_pl.shift_start, '') !~ '^\d{1,2}:\d{2}'
     or coalesce(v_pl.shift_end, '') !~ '^\d{1,2}:\d{2}' then
    return;
  end if;

  v_first := greatest(p_from, v_pl.start_date);
  v_last := least(p_to, coalesce(v_pl.closed_on, v_pl.end_date, p_to));
  if v_pl.status <> 'active' and v_pl.closed_on is null and v_pl.end_date is null then
    v_last := least(v_last, coalesce(
      (select max(r.shift_date) from public.eod_report r where r.placement_id = v_pl.id), v_first - 1));
  end if;
  if v_first > v_last then
    return;
  end if;

  return query
  with days as (
    select d::date as day
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') d
    where extract(isodow from d)::smallint = any(v_pl.working_days)
  ),
  bounds as (
    select days.day, sb.starts_at as s_at, sb.ends_at as e_at
    from days cross join lateral app.shift_bounds(v_pl, days.day) sb
  )
  select
    bo.day,
    bo.s_at,
    bo.e_at,
    case
      when sa.status in ('excused_emergency', 'abandoned', 'worked') then sa.status
      when rep.has_report then 'worked'
      when dr.status = 'unconfirmed' and act.has_activity then 'worked'
      when sa.status = 'notified_absence' then 'notified_absence'
      when now() < bo.e_at then 'scheduled'
      when act.has_activity then 'worked_report_missing'
      else 'suspected_missed'
    end,
    coalesce(sa.late_notice, false),
    sa.reason,
    sa.status,
    app.profile_name(sa.decided_by),
    sa.decided_at,
    sa.notice_at,
    rep.has_report,
    act.has_activity,
    sa.id
  from bounds bo
  left join public.shift_attendance sa on sa.placement_id = v_pl.id and sa.shift_date = bo.day
  left join public.shift_draft dr on dr.placement_id = v_pl.id and dr.shift_date = bo.day
  cross join lateral (
    select exists (
      select 1 from public.eod_report r
      where r.placement_id = v_pl.id and r.shift_date = bo.day and r.superseded_by_id is null
    ) as has_report
  ) rep
  cross join lateral (
    select (
      exists (select 1 from public.booking bk
              where bk.placement_id = v_pl.id and bk.source = 'manual'
                and bk.recorded_at between bo.s_at and bo.e_at)
      or exists (select 1 from public.escalation e
                 where e.placement_id = v_pl.id and e.raised_at between bo.s_at and bo.e_at)
      or exists (select 1 from public.lead_touch lt
                 where lt.placement_id = v_pl.id and lt.direction = 'outbound'
                   and lt.occurred_at between bo.s_at and bo.e_at)
    ) as has_activity
  ) act
  order by bo.day;
end;
$$;

-- 9. Standards: one calculation --------------------------------------------------------

-- Every lead that arrived on the VA's placements in a month, and whether it counts.
create or replace function app.va_response_items(p_operator_id uuid, p_month date)
returns table(
  lead_id uuid,
  placement_id uuid,
  lead_in_at timestamptz,
  customer text,
  response_minutes numeric,
  hit boolean,
  counted boolean,
  excluded_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with pl as (
    select p.*, date_trunc('month', p_month)::date as m_start
    from public.placement p
    where p.operator_id = p_operator_id and p.status <> 'draft'
  ),
  cand as (
    select l.*, p.id as pid, p.response_standard_minutes as rsm, app.safe_tz(p.time_zone) as tz, pp as prow
    from pl p
    join public.placement pp on pp.id = p.id
    join public.lead l
      on l.case_file_id = p.case_file_id and (l.placement_id = p.id or l.placement_id is null)
    where (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date >= p.m_start
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date < (p.m_start + interval '1 month')::date
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date >= p.start_date
      and (l.lead_in_at at time zone app.safe_tz(p.time_zone))::date <= coalesce(p.closed_on, p.end_date)
  ),
  shaped as (
    select c.*,
           exists (
             select 1
             from (values ((c.lead_in_at at time zone c.tz)::date), ((c.lead_in_at at time zone c.tz)::date - 1)) d(day)
             cross join lateral app.shift_bounds(c.prow, d.day) b
             where extract(isodow from d.day)::smallint = any((c.prow).working_days)
               and b.starts_at <= c.lead_in_at and b.ends_at > c.lead_in_at
           ) as in_shift,
           (c.placement_id is null and app.other_placement_on_shift(c.prow, c.lead_in_at)) as ambiguous,
           (c.first_touch_at is not null and c.first_touch_at <= c.lead_in_at + make_interval(mins => coalesce(c.rsm, 5))) as met
    from cand c
  ),
  reasoned as (
    select s.*,
      case
        when not s.in_shift then 'Arrived outside your shift'
        when s.ambiguous then 'Two placements were on shift, so it is not attributed to you. A manager reviews these.'
        when nullif(btrim(coalesce(s.email, '')), '') is null and nullif(btrim(coalesce(s.phone, '')), '') is null
          then 'No valid contact method'
        when exists (select 1 from public.exclusion_window w
                     where w.placement_id = s.pid and s.lead_in_at >= w.starts_at and s.lead_in_at < w.ends_at)
          then (select case w.kind when 'outage' then 'System outage: ' else 'Client-side incident: ' end || w.reason
                from public.exclusion_window w
                where w.placement_id = s.pid and s.lead_in_at >= w.starts_at and s.lead_in_at < w.ends_at
                order by w.created_at limit 1)
        when exists (select 1 from public.shift_attendance sa
                     where sa.placement_id = s.pid and sa.status = 'excused_emergency'
                       and sa.shift_date in ((s.lead_in_at at time zone s.tz)::date, (s.lead_in_at at time zone s.tz)::date - 1))
          then 'Shift excused'
        when exists (select 1 from public.standard_dispute d
                     where d.item_kind = 'lead' and d.item_id = s.id::text and d.status = 'approved'
                       and d.operator_id = p_operator_id)
          then 'Dispute approved: ' || (select d.decision_reason from public.standard_dispute d
                                        where d.item_kind = 'lead' and d.item_id = s.id::text and d.status = 'approved'
                                          and d.operator_id = p_operator_id order by d.decided_at desc limit 1)
        when not s.met and exists (
               select 1 from public.escalation e
               where e.placement_id = s.pid and e.operator_id = p_operator_id
                 and e.response_due_at is not null
                 and coalesce(e.answered_at, now()) > e.response_due_at
                 and s.lead_in_at >= e.raised_at and s.lead_in_at < coalesce(e.answered_at, now()))
          then 'DA was late answering your escalation while this lead waited'
      end as reason
    from shaped s
  )
  select r.id, r.pid, r.lead_in_at, app.customer_short_name(r.name),
         case when r.first_touch_at is not null then round((extract(epoch from (r.first_touch_at - r.lead_in_at)) / 60.0)::numeric, 1) end,
         r.met, r.reason is null, r.reason
  from reasoned r
  order by r.lead_in_at;
$$;

-- Every scheduled shift of the month that has ended, and how it counts.
create or replace function app.va_shift_items(p_operator_id uuid, p_month date)
returns table(
  placement_id uuid,
  shift_date date,
  status text,
  late_notice boolean,
  covered boolean,
  worked boolean,
  confirmed boolean,
  counted boolean,
  excluded_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with pl as (
    select p.* from public.placement p where p.operator_id = p_operator_id and p.status <> 'draft'
  ),
  shifts as (
    select p.id as pid, a.*
    from pl p
    cross join lateral app.placement_attendance(p.id, date_trunc('month', p_month)::date,
                                                least((date_trunc('month', p_month) + interval '1 month - 1 day')::date,
                                                      (now() at time zone app.safe_tz(p.time_zone))::date)) a
    where a.ends_at <= now()
  )
  select s.pid, s.shift_date, s.status, s.late_notice,
         s.status in ('worked', 'worked_report_missing') or (s.status = 'notified_absence' and not s.late_notice),
         s.status in ('worked', 'worked_report_missing'),
         exists (select 1 from public.eod_report r where r.placement_id = s.pid and r.shift_date = s.shift_date and r.superseded_by_id is null),
         not (s.status = 'excused_emergency'
              or exists (select 1 from public.standard_dispute d where d.item_kind = 'shift' and d.status = 'approved'
                         and d.operator_id = p_operator_id and d.item_id = s.pid::text || ':' || s.shift_date::text)),
         case
           when s.status = 'excused_emergency' then 'Shift excused' || coalesce(': ' || s.reason, '')
           when exists (select 1 from public.standard_dispute d where d.item_kind = 'shift' and d.status = 'approved'
                        and d.operator_id = p_operator_id and d.item_id = s.pid::text || ':' || s.shift_date::text)
             then 'Dispute approved'
         end
  from shifts s
  order by s.shift_date;
$$;

-- The standards for one VA and one month: the only place they are calculated.
create or replace function app.va_standard_rows(p_operator_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_today date := (now() at time zone 'UTC')::date;
  v_finished boolean := v_today >= v_next;
  v_elapsed numeric;
  v_rows jsonb := '[]'::jsonb;
  v_def record;
  v_value numeric;
  v_num integer;
  v_den integer;
  v_target numeric;
  v_measured boolean;
  v_note text;
  v_status text;
  v_tracking boolean;
begin
  v_elapsed := case when v_finished then 1 else greatest(0.0, least(1.0, (v_today - v_month + 1)::numeric / (v_next - v_month))) end;
  v_tracking := exists (
    select 1 from public.placement p where p.operator_id = p_operator_id
      and app.tracking_live(p.case_file_id, least(now(), v_next::timestamptz)));

  for v_def in select * from public.metric_definition where category = 'va_standard' order by sort_order loop
    v_value := null; v_num := null; v_den := null; v_note := null;
    v_target := v_def.standard_target;
    v_measured := true;

    if v_def.key = 'va_first_response' then
      select count(*) filter (where counted and hit), count(*) filter (where counted)
        into v_num, v_den from app.va_response_items(p_operator_id, v_month);
      if not v_tracking then
        v_measured := false; v_note := 'Lead tracking is not connected for your client yet, so this is not yet measured.';
      elsif v_den = 0 then
        v_measured := false; v_note := 'No leads have come in during your shifts this month.';
      else
        v_value := round(100.0 * v_num / v_den, 1);
      end if;

    elsif v_def.key = 'va_shift_coverage' then
      select count(*) filter (where counted and covered), count(*) filter (where counted)
        into v_num, v_den from app.va_shift_items(p_operator_id, v_month);
      if v_den = 0 then v_measured := false; v_note := 'No scheduled shifts have ended this month yet.';
      else v_value := round(100.0 * v_num / v_den, 1); end if;

    elsif v_def.key = 'va_reviews_confirmed' then
      select count(*) filter (where counted and worked and confirmed), count(*) filter (where counted and worked)
        into v_num, v_den from app.va_shift_items(p_operator_id, v_month);
      if v_den = 0 then v_measured := false; v_note := 'No worked shifts this month yet.';
      else v_value := round(100.0 * v_num / v_den, 1); end if;

    elsif v_def.key = 'va_booking_quota' then
      select count(*) filter (where public.booking_is_creditable(b.state, b.source, b.matched_booking_id))
        into v_num
      from public.booking b join public.placement p on p.id = b.placement_id
      where p.operator_id = p_operator_id
        and b.scheduled_for >= v_month::timestamp at time zone 'UTC'
        and b.scheduled_for < v_next::timestamp at time zone 'UTC';
      select sum(p.monthly_booking_quota) into v_target
      from public.placement p
      where p.operator_id = p_operator_id and p.status <> 'draft'
        and p.start_date < v_next and coalesce(p.closed_on, p.end_date) >= v_month;
      if coalesce(v_target, 0) = 0 then v_measured := false; v_note := 'No placement with a quota this month.';
      else v_value := v_num; v_den := v_target::integer; end if;

    elsif v_def.key = 'va_escalation_discipline' then
      select count(*) into v_num from public.standard_finding f
      where f.operator_id = p_operator_id and f.standard_key = v_def.key
        and f.occurred_on >= v_month and f.occurred_on < v_next;
      v_value := v_num;
      v_note := format('%s escalations raised this month.',
        (select count(*) from public.escalation e where e.operator_id = p_operator_id
           and e.raised_at >= v_month::timestamp at time zone 'UTC' and e.raised_at < v_next::timestamp at time zone 'UTC'));

    elsif v_def.key = 'va_productive_time' then
      select sum(pt.minutes), sum(p.productive_minutes_weekly)
        into v_num, v_den
      from public.productive_time pt join public.placement p on p.id = pt.placement_id
      where pt.operator_id = p_operator_id and pt.week_start >= v_month and pt.week_start < v_next
        and p.productive_minutes_weekly is not null;
      if coalesce(v_den, 0) = 0 then
        v_measured := false;
        v_note := 'Not yet measured. Productive time is recorded weekly once there is data for it; weeks without data are never counted as zero.';
      else
        v_value := round(100.0 * v_num / v_den, 1);
      end if;
    end if;

    v_status := case
      when not v_measured then 'not_measured'
      when v_def.direction = 'down_is_good' then case when v_value <= coalesce(v_target, 0) then 'on_track' else 'below' end
      when v_def.key = 'va_booking_quota' then
        case when v_value >= v_target then 'on_track'
             when v_finished then 'below'
             when v_value >= floor(v_target * v_elapsed) then 'on_track'
             else 'at_risk' end
      when v_value >= v_target then 'on_track'
      when v_finished then 'below'
      else 'at_risk'
    end;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'key', v_def.key, 'label', v_def.label, 'unit', v_def.unit, 'direction', v_def.direction,
      'target', v_target, 'value', v_value, 'numerator', v_num, 'denominator', v_den,
      'measured', v_measured, 'status', v_status, 'section', v_def.agreement_section,
      'how', v_def.help, 'note', v_note));
  end loop;

  return jsonb_build_object('month', v_month, 'finished', v_finished, 'standards', v_rows);
end;
$$;

-- The exact items behind one standard, counted and excluded, so the VA can check the maths.
create or replace function app.va_standard_items(p_operator_id uuid, p_key text, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  if p_key = 'va_first_response' then
    return jsonb_build_object('kind', 'lead', 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.lead_id, 'placement_id', i.placement_id, 'at', i.lead_in_at,
                                          'label', i.customer, 'response_minutes', i.response_minutes,
                                          'met', i.hit, 'counted', i.counted, 'excluded_reason', i.excluded_reason)
                       order by i.lead_in_at desc)
      from app.va_response_items(p_operator_id, v_month) i), '[]'::jsonb));
  elsif p_key in ('va_shift_coverage', 'va_reviews_confirmed') then
    return jsonb_build_object('kind', 'shift', 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.placement_id::text || ':' || i.shift_date::text,
                                          'placement_id', i.placement_id, 'date', i.shift_date, 'status', i.status,
                                          'late_notice', i.late_notice,
                                          'met', case when p_key = 'va_shift_coverage' then i.covered else i.confirmed end,
                                          'counted', i.counted and (p_key = 'va_shift_coverage' or i.worked),
                                          'excluded_reason', case when not i.counted then i.excluded_reason
                                                                  when p_key = 'va_reviews_confirmed' and not i.worked then 'Not a worked shift' end)
                       order by i.shift_date desc)
      from app.va_shift_items(p_operator_id, v_month) i), '[]'::jsonb));
  elsif p_key = 'va_booking_quota' then
    return jsonb_build_object('kind', 'booking', 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'placement_id', b.placement_id, 'at', b.scheduled_for,
                                          'label', app.customer_short_name(b.customer_name), 'state', b.state,
                                          'met', public.booking_is_creditable(b.state, b.source, b.matched_booking_id),
                                          'counted', public.booking_is_creditable(b.state, b.source, b.matched_booking_id),
                                          'excluded_reason', case when not public.booking_is_creditable(b.state, b.source, b.matched_booking_id)
                                            then case b.state when 'pending_review' then 'Waiting for review'
                                                              when 'rejected' then 'Not counted: ' || coalesce(b.rejection_reason, 'rejected')
                                                              else 'Matched to the calendar booking, which is the one that counts' end end)
                       order by b.scheduled_for desc)
      from public.booking b join public.placement p on p.id = b.placement_id
      where p.operator_id = p_operator_id
        and b.scheduled_for >= v_month::timestamp at time zone 'UTC'
        and b.scheduled_for < v_next::timestamp at time zone 'UTC'), '[]'::jsonb));
  elsif p_key = 'va_escalation_discipline' then
    return jsonb_build_object('kind', 'finding', 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'date', f.occurred_on, 'label', f.note, 'met', false, 'counted', true,
                                          'recorded_by', app.profile_name(f.recorded_by)) order by f.occurred_on desc)
      from public.standard_finding f
      where f.operator_id = p_operator_id and f.standard_key = p_key and f.occurred_on >= v_month and f.occurred_on < v_next), '[]'::jsonb));
  elsif p_key = 'va_productive_time' then
    return jsonb_build_object('kind', 'week', 'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', pt.week_start, 'date', pt.week_start, 'minutes', pt.minutes,
                                          'threshold', p.productive_minutes_weekly,
                                          'met', p.productive_minutes_weekly is not null and pt.minutes >= p.productive_minutes_weekly,
                                          'counted', p.productive_minutes_weekly is not null,
                                          'excluded_reason', case when p.productive_minutes_weekly is null then 'No threshold set in the Placement Order' end)
                       order by pt.week_start desc)
      from public.productive_time pt join public.placement p on p.id = pt.placement_id
      where pt.operator_id = p_operator_id and pt.week_start >= v_month and pt.week_start < v_next), '[]'::jsonb));
  end if;
  return jsonb_build_object('kind', 'none', 'items', '[]'::jsonb);
end;
$$;

-- 10. DA's commitments ------------------------------------------------------------------

create or replace function app.add_business_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
declare
  v timestamptz := p_from;
  n integer := 0;
begin
  while n < p_days loop
    v := v + interval '1 day';
    if extract(isodow from v) < 6 then n := n + 1; end if;
  end loop;
  return v;
end;
$$;

-- "3 hours 10 minutes", for messages.
create or replace function app.duration_words(p_interval interval)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(epoch from p_interval) < 3600 then greatest(1, floor(extract(epoch from p_interval) / 60))::int || ' minutes'
    when extract(epoch from p_interval) < 172800 then
      floor(extract(epoch from p_interval) / 3600)::int || case when floor(extract(epoch from p_interval) / 3600) = 1 then ' hour' else ' hours' end
      || case when floor(mod(extract(epoch from p_interval)::numeric, 3600) / 60) > 0
              then ' ' || floor(mod(extract(epoch from p_interval)::numeric, 3600) / 60)::int || ' minutes' else '' end
    else floor(extract(epoch from p_interval) / 86400)::int || ' days'
  end;
$$;

create or replace function app.da_commitment_rows(p_operator_id uuid, p_month date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_next date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_from timestamptz := v_month::timestamp at time zone 'UTC';
  v_to timestamptz := v_next::timestamp at time zone 'UTC';
  v_rows jsonb := '[]'::jsonb;
  c record;
  v_total integer;
  v_on integer;
  v_misses jsonb;
  v_detail text;
begin
  for c in select * from public.da_commitment order by sort_order loop
    v_total := 0; v_on := 0; v_misses := '[]'::jsonb; v_detail := null;

    if c.key = 'escalations' then
      select count(*),
             count(*) filter (where e.answered_at is not null and e.answered_at <= e.response_due_at),
             coalesce(jsonb_agg(jsonb_build_object(
               'at', e.raised_at,
               'text', case when e.answered_at is null
                            then format('Your escalation from %s is past its answer time and still waiting.',
                                        app.op_time(p_operator_id, e.raised_at, 'FMDy, Mon FMDD'))
                            else format('Your escalation from %s was due by %s and answered at %s, %s late.',
                                        app.op_time(p_operator_id, e.raised_at, 'FMDy, Mon FMDD'),
                                        app.op_time(p_operator_id, e.response_due_at, 'FMHH12:MI AM'),
                                        app.op_time(p_operator_id, e.answered_at, 'FMHH12:MI AM "on" FMDy, Mon FMDD'),
                                        app.duration_words(e.answered_at - e.response_due_at)) end,
               'link', '/vistrial/operator/escalations#' || e.id)
               order by e.raised_at desc) filter (where coalesce(e.answered_at, now()) > e.response_due_at), '[]'::jsonb)
        into v_total, v_on, v_misses
      from public.escalation e
      where e.operator_id = p_operator_id and e.raised_at >= v_from and e.raised_at < v_to
        and e.response_due_at is not null and (e.answered_at is not null or e.response_due_at < now());

    elsif c.key = 'pay_on_schedule' then
      select count(*),
             count(*) filter (where po.sent_at is not null and po.sent_at <= (pp.end_date + coalesce(c.target_value, 5)::integer + 1)::timestamp at time zone 'UTC'),
             coalesce(jsonb_agg(jsonb_build_object(
               'at', pp.end_date,
               'text', format('Pay for the period ending %s was due by %s and %s.', to_char(pp.end_date, 'FMMon FMDD'),
                              to_char(pp.end_date + coalesce(c.target_value, 5)::integer, 'FMMon FMDD'),
                              case when po.sent_at is null then 'has not been sent yet' else 'was sent ' || app.op_time(p_operator_id, po.sent_at, 'FMMon FMDD') end),
               'link', '/vistrial/operator/pay'))
               filter (where coalesce(po.sent_at, now()) > (pp.end_date + coalesce(c.target_value, 5)::integer + 1)::timestamp at time zone 'UTC'), '[]'::jsonb)
        into v_total, v_on, v_misses
      from public.payout po join public.pay_period pp on pp.id = po.period_id
      where po.operator_id = p_operator_id and pp.end_date >= v_month and pp.end_date < v_next
        and (po.sent_at is not null or (pp.end_date + coalesce(c.target_value, 5)::integer + 1)::timestamp at time zone 'UTC' < now());

    elsif c.key = 'pay_questions' then
      select count(*),
             count(*) filter (where q.answered_at is not null and q.answered_at <= app.add_business_days(q.asked_at, coalesce(c.target_value, 2)::integer)),
             coalesce(jsonb_agg(jsonb_build_object(
               'at', q.asked_at,
               'text', format('Your pay question from %s %s.', app.op_time(p_operator_id, q.asked_at, 'FMDy, Mon FMDD'),
                              case when q.answered_at is null then 'is past its answer time' else 'was answered late' end),
               'link', '/vistrial/operator/pay'))
               filter (where coalesce(q.answered_at, now()) > app.add_business_days(q.asked_at, coalesce(c.target_value, 2)::integer)), '[]'::jsonb)
        into v_total, v_on, v_misses
      from public.pay_question q
      where q.operator_id = p_operator_id and q.asked_at >= v_from and q.asked_at < v_to
        and (q.answered_at is not null or app.add_business_days(q.asked_at, coalesce(c.target_value, 2)::integer) < now());

    elsif c.key = 'weekly_feedback' then
      with weeks as (
        select w::date as week_start
        from generate_series(date_trunc('week', v_month::timestamp) - interval '7 days', v_next::timestamp, interval '7 days') w
        where (w::date + 7) >= v_month and (w::date + 7) < v_next
          and ((w::date + 8)::timestamp at time zone 'UTC') < now()
          and exists (select 1 from public.placement p where p.operator_id = p_operator_id and p.status <> 'draft'
                        and p.start_date <= w::date + 6 and coalesce(p.closed_on, p.end_date) >= w::date)
      )
      select count(*),
             count(*) filter (where f.posted_at is not null and f.posted_at < (wk.week_start + 8)::timestamp at time zone 'UTC'),
             coalesce(jsonb_agg(jsonb_build_object(
               'at', wk.week_start,
               'text', format('Feedback for the week of %s was due by Monday, %s %s.', to_char(wk.week_start, 'FMMon FMDD'),
                              to_char(wk.week_start + 7, 'FMMon FMDD'),
                              case when f.posted_at is null then 'and has not been posted' else 'and was posted ' || app.op_time(p_operator_id, f.posted_at, 'FMDy, Mon FMDD') end),
               'link', '/vistrial/operator/growth'))
               filter (where f.posted_at is null or f.posted_at >= (wk.week_start + 8)::timestamp at time zone 'UTC'), '[]'::jsonb)
        into v_total, v_on, v_misses
      from weeks wk
      left join public.weekly_feedback f on f.operator_id = p_operator_id and f.week_start = wk.week_start;

    elsif c.key = 'playbook_changes' then
      select count(*), count(*) into v_total, v_on
      from public.playbook_version v join public.playbook pb on pb.id = v.playbook_id
      where v.saved_at >= v_from and v.saved_at < v_to
        and exists (select 1 from public.placement p where p.operator_id = p_operator_id
                      and (pb.placement_id = p.id or (pb.placement_id is null and pb.case_file_id = p.case_file_id))
                      and p.start_date <= (v.saved_at at time zone 'UTC')::date
                      and coalesce(p.closed_on, p.end_date) >= (v.saved_at at time zone 'UTC')::date);
      v_detail := 'Each change is announced to you when it is saved; major ones need your confirmation.';

    elsif c.key = 'rule_changes' then
      select count(*), count(*) into v_total, v_on
      from public.account_notice n join public.operator o on o.profile_id = n.profile_id
      where o.id = p_operator_id and n.blocking and n.created_at >= v_from and n.created_at < v_to;
      v_detail := 'Changes to standards or pay reach you as a notice you confirm first.';
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'key', c.key, 'label', c.label, 'target', c.target_label, 'target_value', c.target_value,
      'total', v_total, 'on_time', v_on,
      'rate', case when v_total > 0 then round(100.0 * v_on / v_total, 1) end,
      'misses', v_misses, 'detail', v_detail));
  end loop;
  return jsonb_build_object('month', v_month, 'commitments', v_rows);
end;
$$;

-- 11. Tier progress ------------------------------------------------------------------------

create or replace function app.tier_progress(p_operator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op public.operator;
  v_next smallint;
  v_items jsonb := '[]'::jsonb;
  c record;
  v_current numeric;
  v_met boolean;
  v_months integer;
  v_month date;
  v_std jsonb;
  v_all_met boolean := true;
  v_any boolean := false;
begin
  select * into v_op from public.operator where id = p_operator_id;
  v_next := case when coalesce(v_op.tier, 1) >= 3 then null else coalesce(v_op.tier, 1) + 1 end;
  if v_next is null then
    return jsonb_build_object('tier', v_op.tier, 'next_tier', null, 'criteria', '[]'::jsonb, 'eligible', false);
  end if;

  for c in select * from public.tier_criterion where tier = v_next order by sort_order loop
    v_any := true;
    if c.kind = 'months_placed' then
      select coalesce(floor(sum(greatest(0, least(coalesce(p.closed_on, p.end_date), current_date) - p.start_date + 1)) / 30.4), 0)
        into v_current
      from public.placement p where p.operator_id = p_operator_id and p.status <> 'draft' and p.start_date <= current_date;
      v_met := v_current >= c.threshold;
    elsif c.kind = 'standards_met_months' then
      v_months := 0;
      v_month := (date_trunc('month', now()) - interval '1 month')::date;
      for i in 1..12 loop
        v_std := app.va_standard_rows(p_operator_id, v_month) -> 'standards';
        exit when not exists (select 1 from jsonb_array_elements(v_std) s where (s ->> 'measured')::boolean)
               or exists (select 1 from jsonb_array_elements(v_std) s
                          where (s ->> 'measured')::boolean and s ->> 'status' <> 'on_track');
        v_months := v_months + 1;
        v_month := (v_month - interval '1 month')::date;
      end loop;
      v_current := v_months;
      v_met := v_current >= c.threshold;
    elsif c.kind = 'zero_abandonments_days' then
      select coalesce(current_date - max(sa.shift_date),
                      current_date - (select min(p.start_date) from public.placement p where p.operator_id = p_operator_id and p.status <> 'draft'))
        into v_current
      from public.shift_attendance sa where sa.operator_id = p_operator_id and sa.status = 'abandoned';
      v_current := coalesce(v_current, 0);
      v_met := v_current >= c.threshold;
    elsif c.kind = 'training_complete' then
      v_met := v_op.certified_on is not null
               and not exists (select 1 from public.operator_training t where t.operator_id = p_operator_id and t.completed_on is null);
      v_current := case when v_met then 1 else 0 end;
    end if;
    v_all_met := v_all_met and v_met;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', c.id, 'kind', c.kind, 'label', c.label, 'threshold', c.threshold, 'current', v_current, 'met', v_met));
  end loop;

  return jsonb_build_object('tier', v_op.tier, 'next_tier', v_next, 'criteria', v_items, 'eligible', v_any and v_all_met);
end;
$$;

-- 12. Notifications ---------------------------------------------------------------------------

-- One place to tell a VA something. The message points at the record; it never
-- carries customer details (callers pass counts and times only).
create or replace function app.notify_operator(
  p_operator_id uuid,
  p_kind text,
  p_severity public.notification_severity,
  p_title text,
  p_body text,
  p_link text,
  p_urgency text default 'normal',
  p_email_subject text default null,
  p_placement_id uuid default null,
  p_required boolean default true,
  p_formal_notice_id uuid default null
)
returns uuid
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.operator_notification
    (operator_id, placement_id, severity, title, body, sent_by, kind, urgency, link_path, required, email_subject, formal_notice_id)
  values
    (p_operator_id, p_placement_id, p_severity, p_title, p_body, 'Divine Acquisition Team', p_kind,
     p_urgency, p_link, p_required, p_email_subject, p_formal_notice_id)
  returning id;
$$;

-- In-app delivery is the record itself: logged the moment it exists.
create or replace function app.log_in_app_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_attempt (notification_id, channel, status, attempted_at, detail)
  values (new.id, 'in_app', 'delivered', now(), 'Shown in the portal');
  return new;
end;
$$;

drop trigger if exists operator_notification_in_app on public.operator_notification;
create trigger operator_notification_in_app after insert on public.operator_notification
  for each row execute function app.log_in_app_delivery();

-- A formal notice never reaches anyone unless an admin approved and sent it.
create or replace function app.guard_formal_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'formal' and not exists (
    select 1 from public.formal_notice f
    where f.id = new.formal_notice_id and f.approved_by is not null and f.status = 'sent'
  ) then
    raise exception 'formal_notice_unapproved: a formal notice is sent only after an admin reviews and sends it' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists operator_notification_formal_guard on public.operator_notification;
create trigger operator_notification_formal_guard before insert or update on public.operator_notification
  for each row execute function app.guard_formal_notification();

-- Whether the VA is on shift on this placement right now.
create or replace function app.on_shift_now(p_pl public.placement)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from (values ((now() at time zone app.safe_tz(p_pl.time_zone))::date), ((now() at time zone app.safe_tz(p_pl.time_zone))::date - 1)) d(day)
    cross join lateral app.shift_bounds(p_pl, d.day) b
    where extract(isodow from d.day)::smallint = any(p_pl.working_days) and b.starts_at <= now() and b.ends_at > now()
  );
$$;

-- Escalation answered: tell the VA (now if on shift), and when DA was late, say so and tell managers.
create or replace function app.on_escalation_answered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pl public.placement;
  v_op public.operator;
  v_late boolean;
begin
  if not (new.status = 'answered' and old.status = 'open') then
    return new;
  end if;
  select * into v_pl from public.placement where id = new.placement_id;
  select * into v_op from public.operator where id = new.operator_id;
  v_late := new.response_due_at is not null and new.answered_at > new.response_due_at;

  perform app.notify_operator(new.operator_id, 'escalation_answered', 'important',
    'Your escalation has an answer',
    format('The question you raised at %s UTC has been answered by %s. Next step: read the answer and follow up with the customer.',
           to_char(new.raised_at at time zone 'UTC', 'FMHH24:MI'), coalesce(app.profile_name(new.answered_by), 'DA')),
    '/vistrial/operator/escalations#' || new.id,
    case when app.on_shift_now(v_pl) then 'immediate' else 'normal' end,
    'Your escalation has an answer', new.placement_id);

  if v_late then
    perform app.notify_operator(new.operator_id, 'da_late', 'important',
      'We were late on your escalation',
      format('Your escalation from %s was due by %s UTC and was answered at %s UTC. That''s on us. Any response-time misses while you were waiting on us are excluded from your numbers. Nothing is needed from you.',
             to_char(new.raised_at at time zone 'UTC', 'FMDy DD Mon'),
             to_char(new.response_due_at at time zone 'UTC', 'FMHH24:MI'),
             to_char(new.answered_at at time zone 'UTC', 'FMHH24:MI')),
      '/vistrial/operator/commitments', 'normal', 'We were late on your escalation', new.placement_id);
    perform app.notify_staff(app.admin_recipient_ids() || app.case_file_manager_ids(new.case_file_id),
      'da_miss.escalation', 'important',
      format('DA miss: escalation answered late for %s', v_op.name),
      format('Due %s UTC, answered %s UTC. It shows on their DA''s Commitments, and related response misses are excluded.',
             to_char(new.response_due_at at time zone 'UTC', 'FMDD Mon HH24:MI'), to_char(new.answered_at at time zone 'UTC', 'FMDD Mon HH24:MI')),
      new.operator_id);
  end if;
  return new;
end;
$$;

drop trigger if exists escalation_answered_notify on public.escalation;
create trigger escalation_answered_notify after update of status on public.escalation
  for each row execute function app.on_escalation_answered();

-- The answer notice now comes from the trigger, whichever screen answered it.
create or replace function public.staff_answer_escalation(p_escalation_id uuid, p_answer text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_e public.escalation;
begin
  perform app.require_own_name('escalations.answer');
  select * into v_e from public.escalation where id = p_escalation_id;
  if v_e.id is null then
    raise exception 'escalation_not_found' using errcode = 'P0002';
  end if;
  perform app.require_reach_placement(v_e.placement_id);
  if v_e.status <> 'open' then
    raise exception 'already_answered: that escalation is not open' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_answer, ''))) not between 2 and 4000 then
    raise exception 'answer_required: write the answer the operator will act on' using errcode = '23514';
  end if;

  update public.escalation
     set status = 'answered', answer = btrim(p_answer), answered_by = auth.uid(), answered_at = now(), answer_read_at = null
   where id = v_e.id
  returning * into v_e;

  perform app.audit('escalation.answered', 'escalation', v_e.id::text, 'Answered the escalation',
    null, jsonb_build_object('answer', v_e.answer), v_e.case_file_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- Stage changes: welcome to the new stage.
create or replace function app.on_operator_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('in_training', 'certified', 'placed') then
    perform app.notify_operator(new.id, 'stage_welcome', 'informational',
      case new.status when 'in_training' then 'Welcome to training'
                      when 'certified' then 'You''re certified'
                      else 'You''re placed' end,
      case new.status
        when 'in_training' then 'Your account now shows your training and the standards you will be held to. Training uses sample data only.'
        when 'certified' then 'You''re certified and waiting for placement. Set your available shift windows so DA can match you.'
        else 'Your placement is live. My Day shows your shift, your response clock and what needs you.' end,
      '/vistrial/operator', 'normal',
      case new.status when 'in_training' then 'Welcome to training'
                      when 'certified' then 'You''re certified: set your availability'
                      else 'Your placement is live' end);
  end if;
  return new;
end;
$$;

drop trigger if exists operator_stage_welcome on public.operator;
create trigger operator_stage_welcome after update of status on public.operator
  for each row execute function app.on_operator_stage_change();

-- Pay statement ready, payout sent or failed.
create or replace function app.on_pay_statement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.notify_operator(new.operator_id, 'pay_statement_ready', 'informational',
    'Your pay statement is ready',
    'A new pay statement is on your account. It stays open, and can change, until the pay period closes.',
    '/vistrial/operator/pay', 'normal', 'Your pay statement is ready', new.placement_id);
  return new;
end;
$$;

drop trigger if exists pay_statement_created_notify on public.pay_statement;
create trigger pay_statement_created_notify after insert on public.pay_statement
  for each row execute function app.on_pay_statement_created();

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
    perform app.notify_operator(new.operator_id, 'payout_sent', 'informational', 'Your payout was sent',
      format('Your payout of $%s was sent on %s.', to_char(new.amount, 'FM999G999D00'), to_char(coalesce(new.sent_at, now()) at time zone 'UTC', 'FMMon DD')),
      '/vistrial/operator/pay', 'normal', 'Your payout was sent', new.placement_id);
  elsif new.status in ('failed', 'returned') then
    perform app.notify_operator(new.operator_id, 'payout_failed', 'urgent',
      'Your payout didn''t go through',
      format('Your payout of $%s failed. Reason: %s. Next step: check your payout method. DA will retry within 2 business days of your update.',
             to_char(new.amount, 'FM999G999D00'), coalesce(new.failure_reason, 'the payment was not accepted')),
      '/vistrial/operator/profile', 'immediate', 'Your payout didn''t go through', new.placement_id);
  end if;
  return new;
end;
$$;

drop trigger if exists payout_status_notify on public.payout;
create trigger payout_status_notify after update of status on public.payout
  for each row execute function app.on_payout_status();

-- A blocking notice rings the doorbell straight away.
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
  if v_op is null then
    return new;
  end if;
  perform app.notify_operator(v_op, 'blocking_notice', 'urgent', 'A notice needs your confirmation',
    'There is a notice on your account to read and confirm before you continue working.',
    '/vistrial/operator', 'immediate', 'A notice needs your confirmation');
  return new;
end;
$$;

drop trigger if exists account_notice_blocking_notify on public.account_notice;
create trigger account_notice_blocking_notify after insert on public.account_notice
  for each row execute function app.on_blocking_notice();

-- 13. Drafts ---------------------------------------------------------------------------------------

-- The next scheduled shift start after a moment, within two weeks.
create or replace function app.next_shift_start(p_pl public.placement, p_after timestamptz)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(b.starts_at)
  from generate_series(((p_after at time zone app.safe_tz(p_pl.time_zone))::date)::timestamp,
                       ((p_after at time zone app.safe_tz(p_pl.time_zone))::date + 14)::timestamp, interval '1 day') d
  cross join lateral app.shift_bounds(p_pl, d::date) b
  where extract(isodow from d)::smallint = any(p_pl.working_days) and b.starts_at > p_after;
$$;

-- Writes the draft for every shift that has ended in the last three days.
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
    select r.id into v_report from public.eod_report r
    where r.placement_id = p_pl.id and r.shift_date = a.shift_date and r.superseded_by_id is null;

    insert into public.shift_draft (placement_id, operator_id, shift_date, starts_at, ends_at, system_counts,
                                    status, confirm_by, eod_report_id, confirmed_at)
    values (p_pl.id, p_pl.operator_id, a.shift_date, a.starts_at, a.ends_at, v_counts,
            case when v_report is not null then 'confirmed' else 'open' end,
            coalesce(app.next_shift_start(p_pl, a.ends_at), a.ends_at + interval '24 hours'),
            v_report, case when v_report is not null then now() end)
    on conflict (placement_id, shift_date) do nothing;

    if v_report is null then
      v_new := v_new + 1;
      perform app.notify_operator(p_pl.operator_id, 'shift_review_ready', 'informational',
        format('Your shift review for %s is ready', to_char(a.shift_date, 'FMDy, Mon DD')),
        format('Your shift on %s has been recorded. Take a minute to confirm it or correct anything that''s off. Standard: every worked shift has a confirmed review. Next step: review and confirm before your next shift starts.',
               to_char(a.shift_date, 'FMDy, Mon DD')),
        '/vistrial/operator/record?review=' || a.shift_date::text, 'normal',
        format('Your shift review for %s is ready', to_char(a.shift_date, 'FMDy, Mon DD')), p_pl.id);
    end if;

    if coalesce((v_counts ->> 'ambiguous')::integer, 0) > 0 then
      update public.shift_draft set flagged_at = now() where placement_id = p_pl.id and shift_date = a.shift_date;
      perform app.notify_staff(app.admin_recipient_ids() || app.placement_manager_ids(p_pl.id),
        'attribution.ambiguous', 'important',
        format('Attribution unclear on %s, %s', app.placement_client_name(p_pl), to_char(a.shift_date, 'FMDy DD Mon')),
        format('%s lead or touch records happened while two placements on this client were on shift, so they were left out of the draft rather than guessed. Tag them to the right placement.',
               v_counts ->> 'ambiguous'),
        p_pl.operator_id);
    end if;
  end loop;
  return v_new;
end;
$$;

-- 14. The accountability sweep --------------------------------------------------------------

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
  v_last_week date := (date_trunc('week', now() at time zone 'UTC') - interval '7 days')::date;
  v_progress jsonb;
begin
  -- Drafts for every live placement.
  for v_pl in select * from public.placement p where p.status = 'active' loop
    v_drafts := v_drafts + app.ensure_shift_drafts(v_pl);
  end loop;

  -- A draft not confirmed by the next shift start stands as the record, with one reminder.
  for d in
    update public.shift_draft set status = 'unconfirmed', reminded_at = now()
     where status = 'open' and confirm_by <= now()
    returning *
  loop
    v_unconfirmed := v_unconfirmed + 1;
    perform app.notify_operator(d.operator_id, 'shift_review_unconfirmed', 'informational',
      format('Your %s shift review is still open', to_char(d.shift_date, 'FMMon DD')),
      format('Your review for %s wasn''t confirmed before your next shift, so the recorded numbers now stand as your record. You can still confirm or correct it until the pay period closes.',
             to_char(d.shift_date, 'FMDy, Mon DD')),
      '/vistrial/operator/record?review=' || d.shift_date::text, 'normal',
      format('Your %s shift review is still open', to_char(d.shift_date, 'FMMon DD')), d.placement_id);
  end loop;

  -- Suspected missed shifts: ask the VA, decide nothing.
  for s in
    update public.shift_attendance set va_notified_at = now()
     where status = 'suspected_missed' and flagged_at is not null and va_notified_at is null and decided_at is null
    returning *
  loop
    perform app.notify_operator(s.operator_id, 'suspected_missed', 'important',
      format('Did something happen with your %s shift?', to_char(s.shift_date, 'FMMon DD')),
      format('We don''t see any activity or advance notice for your shift on %s. If something came up, let us know what happened. Nothing has been decided, and a manager will review it with your input.',
             to_char(s.shift_date, 'FMDy, Mon DD')),
      '/vistrial/operator/record?tab=attendance', 'immediate',
      format('Did something happen with your %s shift?', to_char(s.shift_date, 'FMMon DD')), s.placement_id);
  end loop;

  -- Standard at risk, from mid-month, once per standard per month.
  if extract(day from now() at time zone 'UTC') >= 15 then
    for v_op in select o.* from public.operator o where app.operator_stage(o) = 'placed' loop
      v_std := app.va_standard_rows(v_op.id, v_month) -> 'standards';
      for v_row in select * from jsonb_array_elements(v_std) loop
        continue when v_row ->> 'status' <> 'at_risk';
        continue when exists (select 1 from public.standard_alert a where a.operator_id = v_op.id
                               and a.standard_key = v_row ->> 'key' and a.month = v_month);
        insert into public.standard_alert (operator_id, standard_key, month) values (v_op.id, v_row ->> 'key', v_month);
        v_alerts := v_alerts + 1;
        perform app.notify_operator(v_op.id, 'standard_at_risk', 'important',
          format('Heads up on %s', lower(v_row ->> 'label')),
          format('Halfway through the month you''re at %s against a standard of %s. There''s time to recover.',
                 case when v_row ->> 'unit' = 'percent' then (v_row ->> 'value') || '%' else v_row ->> 'value' end,
                 case when v_row ->> 'unit' = 'percent' then (v_row ->> 'target') || '%' else v_row ->> 'target' end),
          '/vistrial/operator/standards?key=' || (v_row ->> 'key'), 'normal',
          format('Heads up on %s', lower(v_row ->> 'label')));
      end loop;
    end loop;
  end if;

  -- DA misses DA should hear about: pay questions past two business days.
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

  -- Feedback owed for last week, after Monday end of day.
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

  -- Tier eligibility: tell admins once; nothing changes until one decides.
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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'va-accountability-sweep') then
    perform cron.unschedule('va-accountability-sweep');
  end if;
  perform cron.schedule('va-accountability-sweep', '7,22,37,52 * * * *', 'select app.sweep_va_accountability()');
end
$$;

-- 15. Grants ---------------------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'app.operator_stage(public.operator)',
    'app.operator_inactive_since(public.operator)',
    'app.portal_operator(boolean)',
    'app.portal_placement_ids(public.operator)',
    'app.portal_placement(public.operator, uuid)',
    'app.other_placement_on_shift(public.placement, timestamptz)',
    'app.tracking_live(uuid, timestamptz)',
    'app.window_activity(public.placement, timestamptz, timestamptz)',
    'app.placement_attendance(uuid, date, date)',
    'app.va_response_items(uuid, date)',
    'app.va_shift_items(uuid, date)',
    'app.va_standard_rows(uuid, date)',
    'app.va_standard_items(uuid, text, date)',
    'app.add_business_days(timestamptz, integer)',
    'app.da_commitment_rows(uuid, date)',
    'app.tier_progress(uuid)',
    'app.notify_operator(uuid, text, public.notification_severity, text, text, text, text, text, uuid, boolean, uuid)',
    'app.on_shift_now(public.placement)',
    'app.next_shift_start(public.placement, timestamptz)',
    'app.ensure_shift_drafts(public.placement)',
    'app.sweep_va_accountability()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end
$$;
