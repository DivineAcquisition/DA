-- Sales Operator workspace, part 2 of 3: the data backbone.
--
-- The team app gains a daily workspace for certified Sales Operators: metrics,
-- targets, end of day, feedback, alerts. This migration is the structure only.
-- Screens, the EOD form, GHL sync, scoring and pay logic come later.
--
-- What is reused rather than rebuilt:
--
--   placement              one operator, one client, a period of time. Extended
--                          with the workspace fields below. Pending is 'draft'.
--                          End date is closed_on; end_date stays the term end.
--   operator, profile      the people. Roles map onto profile.role:
--                          Sales Operator = 'operator', Manager = 'manager',
--                          DA Admin = 'owner' / 'admin' (app.is_admin()).
--   client_case_file       the client. GHL is already keyed to it:
--                          ghl_location (one sub-account per case file) and
--                          ghl_user.profile_id (the operator's GHL user). Tokens
--                          stay in Vault behind ghl_connection. Nothing here
--                          copies a GHL secret.
--   academy_certification  Level 1 (Certified Operator) or higher opens the
--                          workspace. Read, never copied.
--   operator_notification  workspace alerts are rows here, told apart by kind.
--   team_setting           the workspace settings are columns on the existing
--                          team settings row.
--   pay_period, payout     pay impact links to them and copies nothing.
--   audit_event            every change below goes through app.audit().
--
-- What is new, and why it cannot reuse an existing table:
--
--   activity_metric        metric_definition is the client growth dictionary;
--                          growth_for_case_file() returns all of it, so operator
--                          activity metrics there would land in client reports.
--   sales_eod              eod_report is an immutable shift report with no draft,
--                          late or missed state. It keeps serving the existing
--                          Shift Reports screen untouched.
--
-- Reads: DA Admin through RLS on everything; a Manager through RLS on the
-- placements assigned to them and nothing else; a Sales Operator only through
-- security-definer functions scoped to their own operator record, the
-- convention the VA portal already follows. Writes only through functions.
-- Mismatches, pay impact and client tokens are DA Admin only.

-- 1. Placements ------------------------------------------------------------------

alter table public.placement
  add column if not exists placement_type text,
  add column if not exists manager_profile_id uuid references public.profile (id) on delete set null,
  add column if not exists eod_deadline text,
  add column if not exists campaign_summary text,
  add column if not exists activity_categories text[] not null default '{}',
  add column if not exists tracks_results boolean not null default false,
  add column if not exists paused_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'placement_type_chk') then
    alter table public.placement add constraint placement_type_chk
      check (placement_type is null or placement_type in ('client_placed', 'da_internal'));
    alter table public.placement add constraint placement_activity_categories_chk
      check (activity_categories <@ array['outbound_calling', 'follow_up', 'reactivation']::text[]
             and (placement_type is null or cardinality(activity_categories) >= 1));
    alter table public.placement add constraint placement_eod_deadline_chk
      check (eod_deadline is null or eod_deadline ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
  end if;
end
$$;

comment on column public.placement.placement_type is
  'Set on every Sales Operator workspace placement: client_placed or da_internal. Null on placements made before the workspace, which it ignores until an admin sets this.';
comment on column public.placement.manager_profile_id is
  'The manager assigned to this placement. A manager reads workspace records only for placements that name them here.';
comment on column public.placement.eod_deadline is
  'HH:MM in the placement time zone. Null means the shift end.';
comment on column public.placement.campaign_summary is
  'The client''s offer and campaign, in a few lines. Shown to the operator.';
comment on column public.placement.activity_categories is
  'Which activity this placement works: outbound_calling, follow_up (text and email), reactivation (database reactivation).';
comment on column public.placement.tracks_results is
  'Whether show rate and closes are tracked. Off by default: they depend on client data.';

-- One active placement per operator, whatever created it.
create unique index if not exists placement_one_active_per_operator
  on public.placement (operator_id) where status = 'active';

create index if not exists placement_manager_idx
  on public.placement (manager_profile_id) where manager_profile_id is not null;

-- 2. Who manages what ------------------------------------------------------------

create or replace function app.so_manages_placement(p_placement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_manager() and exists (
    select 1 from public.placement pl
    where pl.id = p_placement_id
      and pl.manager_profile_id = app.acting_profile()
  );
$$;

create or replace function app.so_manages_operator(p_operator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.is_manager() and exists (
    select 1 from public.placement pl
    where pl.operator_id = p_operator_id
      and pl.placement_type is not null
      and pl.manager_profile_id = app.acting_profile()
  );
$$;

-- Policies call these, so a signed-in session must be able to execute them.
-- Schema app is not exposed through the Data API.
revoke all on function app.so_manages_placement(uuid) from public, anon;
revoke all on function app.so_manages_operator(uuid) from public, anon;
grant execute on function app.so_manages_placement(uuid) to authenticated;
grant execute on function app.so_manages_operator(uuid) to authenticated;

-- Highest Academy level a person holds right now: an enrollment that is not
-- withdrawn, and a certification not past its re-certification date.
create or replace function app.so_certification_level(p_profile_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select max(c.level)
  from public.academy_certification c
  join public.academy_enrollment e on e.id = c.enrollment_id
  where c.profile_id = p_profile_id
    and e.status <> 'withdrawn'
    and (c.recertify_on is null or c.recertify_on >= current_date);
$$;

revoke all on function app.so_certification_level(uuid) from public, anon, authenticated;

-- The EOD deadline for one working day, as an instant. A shift that ends after
-- midnight puts its deadline on the next calendar day.
create or replace function app.so_eod_deadline(p public.placement, p_day date)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_day + case when coalesce(p.eod_deadline, p.shift_end)::time < p.shift_start::time then 1 else 0 end)
          + coalesce(p.eod_deadline, p.shift_end)::time) at time zone p.time_zone;
$$;

revoke all on function app.so_eod_deadline(public.placement, date) from public, anon, authenticated;

-- Records that carry both an operator and a placement must agree with it.
create or replace function app.so_match_placement_operator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.placement_id is not null and not exists (
    select 1 from public.placement pl where pl.id = new.placement_id and pl.operator_id = new.operator_id
  ) then
    raise exception 'placement_mismatch: that placement belongs to a different operator' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app.so_match_placement_operator() from public, anon, authenticated;

-- 3. Metric definitions ------------------------------------------------------------

create table if not exists public.activity_metric (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null check (length(btrim(label)) between 1 and 80),
  description text not null check (length(btrim(description)) between 1 and 400),
  category text not null check (category in ('outbound', 'follow_up', 'reactivation', 'results', 'timing')),
  source text not null check (source in ('operator', 'ghl', 'both')),
  unit text not null check (unit in ('count', 'minutes', 'percent', 'seconds')),
  operator_editable boolean not null,
  -- Logged once per positive outcome type on the placement, not as one number.
  by_outcome boolean not null default false,
  active boolean not null default true,
  sort_order integer not null,
  updated_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_metric_ghl_not_editable check (source <> 'ghl' or not operator_editable)
);

comment on table public.activity_metric is
  'Every metric the Sales Operator workspace can track. Configuration, managed by DA Admin. Separate from metric_definition, which is the client growth dictionary.';
comment on column public.activity_metric.source is
  'operator: logged by the operator. ghl: reported by GHL only. both: logged by the operator and verified against GHL.';

create trigger activity_metric_touch before update on public.activity_metric
  for each row execute function app.touch_updated_at();

insert into public.activity_metric (key, label, description, category, source, unit, operator_editable, by_outcome, sort_order) values
  ('conversations_held', 'Conversations held', 'Real two-way conversations with a lead. Voicemails and no-answers do not count.', 'outbound', 'both', 'count', true, false, 10),
  ('talk_time_minutes', 'Talk time', 'Minutes spent in live conversation.', 'outbound', 'both', 'minutes', true, false, 20),
  ('positive_outcomes', 'Positive outcomes', 'Wins for this client, logged against each outcome on the placement''s list.', 'outbound', 'both', 'count', true, true, 30),
  ('callback_requested', 'Callback requested', 'The lead asked to be called back at another time.', 'outbound', 'both', 'count', true, false, 40),
  ('not_interested', 'Not interested', 'The lead said no.', 'outbound', 'both', 'count', true, false, 50),
  ('wrong_number', 'Wrong number', 'The number does not reach the lead.', 'outbound', 'both', 'count', true, false, 60),
  ('do_not_call', 'Do not call', 'The lead asked not to be contacted again.', 'outbound', 'both', 'count', true, false, 70),
  ('dials_made', 'Dials made', 'Outbound calls placed, from GHL.', 'outbound', 'ghl', 'count', false, false, 80),
  ('connects', 'Connects', 'Calls a person answered, from GHL.', 'outbound', 'ghl', 'count', false, false, 90),
  ('speed_to_lead_seconds', 'Speed-to-lead', 'Time from lead created to your first touch, from GHL timestamps.', 'timing', 'ghl', 'seconds', false, false, 100),
  ('texts_sent', 'Texts sent', 'Follow-up texts sent.', 'follow_up', 'both', 'count', true, false, 110),
  ('emails_sent', 'Emails sent', 'Follow-up emails sent.', 'follow_up', 'both', 'count', true, false, 120),
  ('replies_received', 'Replies received', 'Leads who replied to a text or email.', 'follow_up', 'both', 'count', true, false, 130),
  ('no_show_recovery_attempts', 'No-show recovery attempts', 'Attempts to rebook a lead who missed an appointment.', 'follow_up', 'both', 'count', true, false, 140),
  ('reactivation_responses', 'Responses and re-engaged leads', 'Old leads who responded or re-engaged.', 'reactivation', 'both', 'count', true, false, 150),
  ('reactivated_bookings', 'Reactivated bookings', 'Bookings from old leads.', 'reactivation', 'both', 'count', true, false, 160),
  ('show_rate', 'Show rate', 'Share of booked appointments that showed, from appointment status in GHL. Tracked only when the placement tracks results. Operators cannot edit it.', 'results', 'ghl', 'percent', false, false, 170),
  ('closes', 'Closes', 'Opportunities marked won in GHL. Tracked only when the placement tracks results. Operators cannot edit it.', 'results', 'ghl', 'count', false, false, 180)
on conflict (key) do nothing;

-- 4. Positive outcome types, per placement -----------------------------------------

create table if not exists public.placement_outcome_type (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  definition text not null check (length(btrim(definition)) between 1 and 400),
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profile (id) on delete set null,
  updated_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists placement_outcome_type_name_uq
  on public.placement_outcome_type (placement_id, lower(btrim(name)));

comment on table public.placement_outcome_type is
  'The outcomes that count as wins for this client (booked call, estimate booked). A workspace placement cannot go Active without one.';

create trigger placement_outcome_type_touch before update on public.placement_outcome_type
  for each row execute function app.touch_updated_at();

-- A workspace placement goes Active only with a positive outcome defined, and
-- keeps at least one while it is Active.
create or replace function app.so_guard_placement_outcomes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.placement_type is not null and new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active' or old.placement_type is null)
     and not exists (
       select 1 from public.placement_outcome_type o where o.placement_id = new.id and o.active
     ) then
    raise exception 'outcomes_required: define at least one positive outcome for this placement before it goes Active'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function app.so_guard_placement_outcomes() from public, anon, authenticated;

drop trigger if exists placement_outcomes_required on public.placement;
create trigger placement_outcomes_required
  before insert or update of status, placement_type on public.placement
  for each row execute function app.so_guard_placement_outcomes();

create or replace function app.so_guard_last_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.active and (tg_op = 'DELETE' or not new.active)
     and exists (
       select 1 from public.placement pl
       where pl.id = old.placement_id and pl.status = 'active' and pl.placement_type is not null
     )
     and not exists (
       select 1 from public.placement_outcome_type o
       where o.placement_id = old.placement_id and o.active and o.id <> old.id
     ) then
    raise exception 'outcomes_required: an Active placement keeps at least one positive outcome. Add another first.'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app.so_guard_last_outcome() from public, anon, authenticated;

drop trigger if exists placement_outcome_type_keep_one on public.placement_outcome_type;
create trigger placement_outcome_type_keep_one
  before update of active or delete on public.placement_outcome_type
  for each row execute function app.so_guard_last_outcome();

-- A placement that goes Active by status change queues the placement packet the
-- same way one inserted Active already does.
drop trigger if exists placement_queue_operator_packet_on_activate on public.placement;
create trigger placement_queue_operator_packet_on_activate
  after update of status on public.placement
  for each row
  when (new.status = 'active' and old.status is distinct from 'active')
  execute function app.queue_operator_packet();

-- 5. Targets -----------------------------------------------------------------------

create table if not exists public.activity_target (
  id uuid primary key default gen_random_uuid(),
  layer text not null check (layer in ('default', 'override')),
  metric_key text not null references public.activity_metric (key) on delete restrict,
  -- Default layer only: null applies to every placement type.
  placement_type text check (placement_type is null or placement_type in ('client_placed', 'da_internal')),
  -- Override layer only.
  placement_id uuid references public.placement (id) on delete cascade,
  -- Both null clears the target from effective_from on.
  daily numeric(12, 2) check (daily is null or daily >= 0),
  weekly numeric(12, 2) check (weekly is null or weekly >= 0),
  effective_from date not null default current_date,
  note text,
  set_by uuid references public.profile (id) on delete set null,
  set_at timestamptz not null default now(),
  constraint activity_target_layer_shape check (
    (layer = 'default' and placement_id is null)
    or (layer = 'override' and placement_id is not null and placement_type is null)
  )
);

create index if not exists activity_target_default_idx
  on public.activity_target (metric_key, placement_type, effective_from desc, set_at desc) where layer = 'default';
create index if not exists activity_target_override_idx
  on public.activity_target (placement_id, metric_key, effective_from desc, set_at desc) where layer = 'override';

comment on table public.activity_target is
  'Append-only target history. Admin defaults per metric (optionally per placement type) and manager overrides per placement. A day is judged against the row in force on that day.';

create or replace function app.so_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only: % keeps its history. Add a new row instead.', tg_table_name using errcode = '42501';
end;
$$;

revoke all on function app.so_append_only() from public, anon, authenticated;

create trigger activity_target_append_only before update or delete on public.activity_target
  for each row execute function app.so_append_only();

-- The default in force for a placement type, metric and day: the type-specific
-- row when one is set, else the all-types row.
create or replace function app.so_default_target(p_placement_type text, p_metric_key text, p_day date)
returns public.activity_target
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.activity_target;
begin
  if p_placement_type is not null then
    select t.* into v
    from public.activity_target t
    where t.layer = 'default' and t.metric_key = p_metric_key
      and t.placement_type = p_placement_type and t.effective_from <= p_day
    order by t.effective_from desc, t.set_at desc
    limit 1;
    if v.id is not null and (v.daily is not null or v.weekly is not null) then
      return v;
    end if;
  end if;
  select t.* into v
  from public.activity_target t
  where t.layer = 'default' and t.metric_key = p_metric_key
    and t.placement_type is null and t.effective_from <= p_day
  order by t.effective_from desc, t.set_at desc
  limit 1;
  if v.id is not null and (v.daily is not null or v.weekly is not null) then
    return v;
  end if;
  return null;
end;
$$;

-- The target in force for one placement, metric and day: the manager override
-- when one stands, else the admin default. No row means no target is shown.
create or replace function app.so_target(p_placement_id uuid, p_metric_key text, p_day date)
returns public.activity_target
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_override public.activity_target;
  v_type text;
begin
  select t.* into v_override
  from public.activity_target t
  where t.layer = 'override' and t.placement_id = p_placement_id
    and t.metric_key = p_metric_key and t.effective_from <= p_day
  order by t.effective_from desc, t.set_at desc
  limit 1;
  if v_override.id is not null and (v_override.daily is not null or v_override.weekly is not null) then
    return v_override;
  end if;
  select placement_type into v_type from public.placement where id = p_placement_id;
  return app.so_default_target(v_type, p_metric_key, p_day);
end;
$$;

revoke all on function app.so_default_target(text, text, date) from public, anon, authenticated;
revoke all on function app.so_target(uuid, text, date) from public, anon, authenticated;

-- 6. Daily activity ----------------------------------------------------------------

create table if not exists public.activity_day (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  operator_updated_at timestamptz,
  ghl_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (operator_id, placement_id, work_date)
);

comment on table public.activity_day is
  'One record per operator, placement and working day. Its values live in activity_value, operator-logged and GHL-reported kept apart.';

create trigger activity_day_match before insert or update on public.activity_day
  for each row execute function app.so_match_placement_operator();

create table if not exists public.activity_value (
  id uuid primary key default gen_random_uuid(),
  activity_day_id uuid not null references public.activity_day (id) on delete cascade,
  metric_key text not null references public.activity_metric (key) on delete restrict,
  -- Set for by_outcome metrics only: which positive outcome this count is for.
  outcome_type_id uuid references public.placement_outcome_type (id) on delete restrict,
  source text not null check (source in ('operator', 'ghl')),
  value numeric(14, 2) not null check (value >= 0),
  updated_by uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint activity_value_one unique nulls not distinct (activity_day_id, metric_key, outcome_type_id, source)
);

comment on table public.activity_value is
  'Metric values for a day. source keeps the operator''s numbers and GHL''s numbers as separate rows. Neither ever overwrites the other.';

create or replace function app.so_guard_activity_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metric public.activity_metric;
  v_day public.activity_day;
begin
  if tg_op = 'UPDATE' and (new.source is distinct from old.source
     or new.activity_day_id is distinct from old.activity_day_id
     or new.metric_key is distinct from old.metric_key
     or new.outcome_type_id is distinct from old.outcome_type_id) then
    raise exception 'immutable: a value keeps its day, metric, outcome and source' using errcode = '42501';
  end if;

  select * into v_metric from public.activity_metric where key = new.metric_key;
  if new.source = 'operator' and v_metric.source = 'ghl' then
    raise exception 'ghl_only: % comes from GHL. Operators cannot log it.', v_metric.label using errcode = '42501';
  end if;
  if new.source = 'ghl' and v_metric.source = 'operator' then
    raise exception 'operator_only: % is not reported by GHL', v_metric.label using errcode = '23514';
  end if;

  select * into v_day from public.activity_day where id = new.activity_day_id;
  if v_metric.by_outcome then
    if new.outcome_type_id is null or not exists (
      select 1 from public.placement_outcome_type o
      where o.id = new.outcome_type_id and o.placement_id = v_day.placement_id
    ) then
      raise exception 'outcome_required: % is logged per positive outcome on this placement', v_metric.label using errcode = '23514';
    end if;
  elsif new.outcome_type_id is not null then
    raise exception 'no_outcome: % is not broken down by outcome', v_metric.label using errcode = '23514';
  end if;

  new.updated_at := now();
  if new.source = 'operator' then
    update public.activity_day set operator_updated_at = now() where id = new.activity_day_id;
  else
    update public.activity_day set ghl_updated_at = now() where id = new.activity_day_id;
  end if;
  return new;
end;
$$;

revoke all on function app.so_guard_activity_value() from public, anon, authenticated;

create trigger activity_value_guard before insert or update on public.activity_value
  for each row execute function app.so_guard_activity_value();

-- 7. End of day --------------------------------------------------------------------

create table if not exists public.sales_eod (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  activity_day_id uuid not null unique references public.activity_day (id) on delete restrict,
  status text not null default 'not_started'
    check (status in ('not_started', 'draft', 'submitted', 'late', 'missed')),
  wins text,
  blockers text,
  tomorrow_plan text,
  hours_worked numeric(4, 2) check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 24)),
  note_to_manager text,
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  was_late boolean not null default false,
  edited_after_submit boolean not null default false,
  edit_count integer not null default 0,
  -- After this instant a submitted EOD can no longer be edited.
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (operator_id, placement_id, work_date),
  constraint sales_eod_submitted_shape check (status <> 'submitted' or submitted_at is not null)
);

comment on table public.sales_eod is
  'One end-of-day report per operator, placement and working day. late is past the deadline and not yet submitted; a report submitted after the deadline is submitted with was_late. Separate from eod_report, which serves the existing Shift Reports screen.';

create table if not exists public.sales_eod_revision (
  id uuid primary key default gen_random_uuid(),
  eod_id uuid not null references public.sales_eod (id) on delete cascade,
  revision integer not null,
  before_value jsonb not null,
  after_value jsonb not null,
  edited_by uuid references public.profile (id) on delete set null,
  edited_at timestamptz not null default now(),
  unique (eod_id, revision)
);

comment on table public.sales_eod_revision is
  'Every edit to an EOD after it was submitted: what it said before and after.';

create trigger sales_eod_revision_append_only before update or delete on public.sales_eod_revision
  for each row execute function app.so_append_only();

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

    v_before := jsonb_build_object('wins', old.wins, 'blockers', old.blockers, 'tomorrow_plan', old.tomorrow_plan,
      'hours_worked', old.hours_worked, 'note_to_manager', old.note_to_manager);
    v_after := jsonb_build_object('wins', new.wins, 'blockers', new.blockers, 'tomorrow_plan', new.tomorrow_plan,
      'hours_worked', new.hours_worked, 'note_to_manager', new.note_to_manager);

    if old.submitted_at is not null and v_before is distinct from v_after then
      if old.locked_at is not null and now() >= old.locked_at then
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

revoke all on function app.so_guard_sales_eod() from public, anon, authenticated;

create trigger sales_eod_match before insert or update on public.sales_eod
  for each row execute function app.so_match_placement_operator();
create trigger sales_eod_guard before insert or update on public.sales_eod
  for each row execute function app.so_guard_sales_eod();

-- 8. Client feedback tokens --------------------------------------------------------

create table if not exists public.client_feedback_token (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  -- SHA-256 of the token. The token itself is shown once, at minting, and never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profile (id) on delete set null,
  first_used_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0,
  created_by uuid references public.profile (id) on delete set null,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (expires_at > created_at)
);

comment on table public.client_feedback_token is
  'One token per client report. It allows feedback on that report only and grants nothing else. Clients never sign in.';

-- 9. Feedback ------------------------------------------------------------------------

create table if not exists public.sales_eod_feedback (
  id uuid primary key default gen_random_uuid(),
  eod_id uuid not null references public.sales_eod (id) on delete cascade,
  author_kind text not null check (author_kind in ('manager', 'admin', 'client')),
  author_profile_id uuid references public.profile (id) on delete set null,
  client_token_id uuid references public.client_feedback_token (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 4000),
  rating smallint check (rating is null or rating between 1 and 5),
  created_at timestamptz not null default now(),
  constraint sales_eod_feedback_author check (
    (author_kind = 'client' and author_profile_id is null)
    or (author_kind <> 'client' and client_token_id is null)
  )
);

create index if not exists sales_eod_feedback_eod_idx on public.sales_eod_feedback (eod_id, created_at);

comment on table public.sales_eod_feedback is
  'Feedback threads on an EOD from a manager, an admin, or a client through their token. The operator reads feedback on their own EODs.';

create or replace function app.so_guard_client_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_token_id is not null and not exists (
    select 1 from public.client_feedback_token t
    join public.sales_eod e on e.placement_id = t.placement_id
    where t.id = new.client_token_id and e.id = new.eod_id
      and e.work_date between t.period_start and t.period_end
  ) then
    raise exception 'token_scope: that token is for a different report' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.so_guard_client_feedback() from public, anon, authenticated;

create trigger sales_eod_feedback_token_scope before insert or update on public.sales_eod_feedback
  for each row execute function app.so_guard_client_feedback();

-- 10. Data mismatches (DA Admin only) ----------------------------------------------

create table if not exists public.activity_mismatch (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  work_date date not null,
  metric_key text not null references public.activity_metric (key) on delete restrict,
  outcome_type_id uuid references public.placement_outcome_type (id) on delete set null,
  operator_value numeric(14, 2),
  ghl_value numeric(14, 2),
  gap numeric(14, 2) not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid references public.profile (id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  constraint activity_mismatch_one unique nulls not distinct (placement_id, work_date, metric_key, outcome_type_id)
);

comment on table public.activity_mismatch is
  'GHL and operator numbers for one metric and day that differ beyond the tolerance. DA Admin only: operators and managers never see these.';

create trigger activity_mismatch_match before insert or update on public.activity_mismatch
  for each row execute function app.so_match_placement_operator();

-- 11. Alerts: the existing operator notifications -----------------------------------

alter table public.operator_notification
  add column if not exists created_by uuid references public.profile (id) on delete set null;

comment on column public.operator_notification.created_by is
  'The person who created this, or null for the system.';
comment on column public.operator_notification.kind is
  'general, plus the workspace alert kinds: manager_message, eod_reminder, eod_late, target_update, feedback_received.';

-- 12. Performance and consequences (structure only) ---------------------------------

create table if not exists public.operator_performance_week (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  week_start date not null check (extract(isodow from week_start) = 1),
  score numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  -- Everything the score was computed from, so it can be explained.
  inputs jsonb not null default '{}'::jsonb,
  method_version text,
  computed_at timestamptz not null default now(),
  constraint operator_performance_week_one unique nulls not distinct (operator_id, placement_id, week_start)
);

comment on table public.operator_performance_week is
  'Rolling performance score per operator per week, with its inputs. Scoring logic is a later prompt.';

create trigger operator_performance_week_match before insert or update on public.operator_performance_week
  for each row execute function app.so_match_placement_operator();

create table if not exists public.operator_pay_impact (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  pay_period_id text not null references public.pay_period (id) on delete restrict,
  -- Links to the payout and its adjustment once applied. Amounts paid live there.
  payout_id uuid references public.payout (id) on delete set null,
  payout_adjustment_id uuid references public.payout_adjustment (id) on delete set null,
  performance_week_id uuid references public.operator_performance_week (id) on delete set null,
  kind text not null check (kind in ('bonus', 'reduction', 'none')),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  reason text,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'applied', 'void')),
  decided_by uuid references public.profile (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint operator_pay_impact_one unique nulls not distinct (operator_id, placement_id, pay_period_id)
);

comment on table public.operator_pay_impact is
  'Pay or bonus impact per operator per pay period, linked to the existing payout records. DA Admin only. Pay logic is a later prompt.';

create trigger operator_pay_impact_match before insert or update on public.operator_pay_impact
  for each row execute function app.so_match_placement_operator();

create table if not exists public.operator_recert_flag (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  certification_id uuid references public.academy_certification (id) on delete set null,
  enrollment_id uuid references public.academy_enrollment (id) on delete set null,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'in_review', 'recertified', 'cleared', 'void')),
  raised_by uuid references public.profile (id) on delete set null,
  raised_at timestamptz not null default now(),
  resolved_by uuid references public.profile (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text
);

comment on table public.operator_recert_flag is
  'A re-certification flag on an operator, linked to their Academy certification. raised_by null is the system. Trigger logic is a later prompt.';

-- 13. Settings: the existing team settings row --------------------------------------

alter table public.team_setting
  add column if not exists mismatch_tolerance_pct numeric(5, 2) not null default 10
    check (mismatch_tolerance_pct >= 0 and mismatch_tolerance_pct <= 100),
  add column if not exists mismatch_small_count_under integer not null default 30
    check (mismatch_small_count_under >= 0),
  add column if not exists mismatch_small_count_gap numeric(8, 2) not null default 3
    check (mismatch_small_count_gap >= 0),
  add column if not exists eod_reminder_minutes_before integer not null default 60
    check (eod_reminder_minutes_before between 0 and 1440),
  add column if not exists eod_late_minutes_after integer not null default 0
    check (eod_late_minutes_after between 0 and 1440),
  add column if not exists eod_manager_alert_minutes_after integer not null default 120
    check (eod_manager_alert_minutes_after between 0 and 2880),
  add column if not exists eod_missed_rule text not null default 'next_shift_start'
    check (eod_missed_rule in ('next_shift_start', 'hours_after_deadline')),
  add column if not exists eod_missed_hours_after integer
    check (eod_missed_hours_after is null or eod_missed_hours_after between 1 and 168),
  add column if not exists eod_edit_rule text not null default 'until_next_shift'
    check (eod_edit_rule in ('until_next_shift', 'hours_after_submit', 'never')),
  add column if not exists eod_edit_hours_after integer
    check (eod_edit_hours_after is null or eod_edit_hours_after between 1 and 168),
  add column if not exists eod_hours_worked_enabled boolean not null default false,
  add column if not exists eod_note_to_manager_enabled boolean not null default false,
  add column if not exists client_feedback_token_days integer not null default 14
    check (client_feedback_token_days between 1 and 90),
  add column if not exists speed_to_lead_target_seconds integer
    check (speed_to_lead_target_seconds is null or speed_to_lead_target_seconds > 0),
  add column if not exists target_override_min_pct integer
    check (target_override_min_pct is null or target_override_min_pct between 0 and 1000),
  add column if not exists target_override_max_pct integer
    check (target_override_max_pct is null or target_override_max_pct between 0 and 1000);

comment on column public.team_setting.mismatch_tolerance_pct is
  'Flag a GHL vs operator gap above this percent, or above mismatch_small_count_gap when the count is under mismatch_small_count_under, whichever is larger.';
comment on column public.team_setting.eod_missed_rule is
  'When an unsubmitted EOD becomes Missed: at the start of the next shift, or eod_missed_hours_after hours after the deadline.';
comment on column public.team_setting.eod_edit_rule is
  'How long a submitted EOD stays editable: until the next shift starts, eod_edit_hours_after hours after submitting, or never.';
comment on column public.team_setting.target_override_min_pct is
  'A manager override may not go below this percent of the admin default. Null is no floor.';
comment on column public.team_setting.target_override_max_pct is
  'A manager override may not go above this percent of the admin default. Null is no ceiling.';

-- 14. Permissions --------------------------------------------------------------------

insert into public.permission (key, label, category, description, sort_order, is_destructive, requires_step_up, blocked_during_impersonation)
values
  ('workspace.outcomes.edit', 'Edit positive outcomes', 'Sales Operator workspace',
   'Edit the positive outcome list on placements assigned to you.', 1100, false, false, true),
  ('workspace.targets.override', 'Set operator targets', 'Sales Operator workspace',
   'Set daily and weekly targets for operators on placements assigned to you, within the limits admin allows.', 1110, false, false, true)
on conflict (key) do nothing;

insert into public.role_permission (role, permission_key)
select r::public.user_role, k
from unnest(array['owner', 'admin', 'manager']) r,
     unnest(array['workspace.outcomes.edit', 'workspace.targets.override']) k
on conflict do nothing;

-- 15. Row level security -------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['activity_metric', 'placement_outcome_type', 'activity_target', 'activity_day',
                           'activity_value', 'sales_eod', 'sales_eod_revision', 'sales_eod_feedback',
                           'client_feedback_token', 'activity_mismatch', 'operator_performance_week',
                           'operator_pay_impact', 'operator_recert_flag'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (app.is_admin())', t || '_admin_read', t);
  end loop;
end
$$;

-- Managers: the dictionary, the defaults, and the placements assigned to them.
create policy activity_metric_manager_read on public.activity_metric
  for select to authenticated using (app.is_manager());

create policy placement_outcome_type_manager_read on public.placement_outcome_type
  for select to authenticated using (app.so_manages_placement(placement_id));

create policy activity_target_manager_read on public.activity_target
  for select to authenticated
  using (app.is_manager() and (layer = 'default' or app.so_manages_placement(placement_id)));

create policy activity_day_manager_read on public.activity_day
  for select to authenticated using (app.so_manages_placement(placement_id));

create policy activity_value_manager_read on public.activity_value
  for select to authenticated
  using (exists (select 1 from public.activity_day d
                 where d.id = activity_day_id and app.so_manages_placement(d.placement_id)));

create policy sales_eod_manager_read on public.sales_eod
  for select to authenticated using (app.so_manages_placement(placement_id));

create policy sales_eod_revision_manager_read on public.sales_eod_revision
  for select to authenticated
  using (exists (select 1 from public.sales_eod e
                 where e.id = eod_id and app.so_manages_placement(e.placement_id)));

create policy sales_eod_feedback_manager_read on public.sales_eod_feedback
  for select to authenticated
  using (exists (select 1 from public.sales_eod e
                 where e.id = eod_id and app.so_manages_placement(e.placement_id)));

create policy operator_performance_week_manager_read on public.operator_performance_week
  for select to authenticated using (app.so_manages_operator(operator_id));

create policy operator_recert_flag_manager_read on public.operator_recert_flag
  for select to authenticated using (app.so_manages_operator(operator_id));

-- client_feedback_token, activity_mismatch and operator_pay_impact keep the admin
-- policy alone.
