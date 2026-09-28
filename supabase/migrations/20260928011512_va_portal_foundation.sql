-- Sales Operator portal and View As: foundation.
--
-- What changes, and why:
--
-- 1. Operators stop reading and writing the operational tables directly. They
--    could: placement_operator_read returned every column of their placement,
--    client_rate_per_booking included, to anyone holding their session and the
--    public anon key; booking_operator_read kept customer contact details for
--    placements that had ended; eod_report / escalation / operator_task /
--    operator_notification let them write and delete freely. Everything a VA
--    sees or does now goes through the portal functions (next migration), each
--    of which lists its fields and checks the permission engine. Admin and
--    manager policies are untouched.
--
-- 2. Scope is evaluated by one function for any profile. app.in_scope_* now
--    delegate to it with the acting profile, unchanged in behaviour, so staff
--    actions taken during View As can check the real admin's scope.
--
-- 3. Every VA attestation is a permission with blocked_during_impersonation, so
--    app.decide() refuses it while someone is viewing as the VA. Managers get a
--    narrow operators.view_as; accounts.impersonate stays owner/admin only.
--
-- 4. The one exception to the impersonation block: an admin-panel action taken
--    during View As, evaluated for the real signed-in person, never the viewed
--    account, and only while the viewed account is an operator. See
--    app.require_own_name().
--
-- 5. New tables: playbooks (with versions), shift attendance decisions,
--    liquidated-damages proposals, pay questions, internal operator notes.

-- 1. Scope for any profile ----------------------------------------------------

create or replace function app.scope_includes_case_file(p_profile uuid, p_case_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_case_file_id is not null
    and p_profile is not null
    and app.effective_state(p_profile) = 'active'
    and exists (
      select 1 from public.account_scope s
      where s.profile_id = p_profile
        and (
          s.kind = 'all_clients'
          or (s.kind = 'clients' and exists (
                select 1 from public.account_scope_client c
                where c.profile_id = s.profile_id and c.case_file_id = p_case_file_id))
          or (s.kind = 'placements' and exists (
                select 1 from public.account_scope_placement sp
                join public.placement pl on pl.id = sp.placement_id
                where sp.profile_id = s.profile_id and pl.case_file_id = p_case_file_id))
        )
    );
$$;

create or replace function app.scope_includes_placement(p_profile uuid, p_placement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_placement_id is not null
    and p_profile is not null
    and app.effective_state(p_profile) = 'active'
    and exists (
      select 1 from public.account_scope s
      left join public.placement pl on pl.id = p_placement_id
      where s.profile_id = p_profile
        and (
          s.kind = 'all_clients'
          or (s.kind = 'clients' and exists (
                select 1 from public.account_scope_client c
                where c.profile_id = s.profile_id and c.case_file_id = pl.case_file_id))
          or (s.kind = 'placements' and exists (
                select 1 from public.account_scope_placement sp
                where sp.profile_id = s.profile_id and sp.placement_id = p_placement_id))
        )
    );
$$;

create or replace function app.in_scope_case_file(p_case_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.scope_includes_case_file(app.acting_profile(), p_case_file_id);
$$;

create or replace function app.in_scope_placement(p_placement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.scope_includes_placement(app.acting_profile(), p_placement_id);
$$;

revoke all on function app.scope_includes_case_file(uuid, uuid) from public, anon, authenticated;
revoke all on function app.scope_includes_placement(uuid, uuid) from public, anon, authenticated;

-- Operators no longer read case file rows: those carry the retainer, the revenue
-- goal and DA's internal notes. The portal gives them the client's name.
create or replace function app.reads_case_file_rows()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = app.acting_profile()
      and p.role in ('owner', 'admin', 'manager')
      and app.effective_state(p.id) = 'active'
  );
$$;

-- 2. Own-name actions during View As -----------------------------------------

-- True only inside app.require_own_name(), for the real signed-in person, while
-- the account being viewed is an operator. Evaluating the viewed account itself
-- (app.can(), the portal's own actions) never qualifies.
create or replace function app.own_name_exception(p_subject uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(current_setting('app.own_name_action', true), '') = 'on'
     and p_subject is not distinct from auth.uid()
     and coalesce((
       select t.role = 'operator'
       from public.profile t
       where t.id = (app.live_impersonation()).target_profile_id
     ), false);
$$;

revoke all on function app.own_name_exception(uuid) from public, anon, authenticated;

create or replace function app.decide(p_permission text, p_profile_id uuid default null::uuid)
returns table(allowed boolean, layer text, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_subject uuid := coalesce(p_profile_id, app.acting_profile());
  v_role public.user_role;
  v_state public.account_state;
  v_permission public.permission;
  v_lockdown public.lockdown;
  v_override public.permission_effect;
  v_override_reason text;
begin
  if v_subject is null then
    return query select false, 'no_session', 'Nobody is signed in.';
    return;
  end if;

  select * into v_permission from public.permission p where p.key = p_permission;
  if v_permission.key is null then
    return query select false, 'unknown_permission',
      format('There is no permission called %L.', p_permission);
    return;
  end if;

  select pr.role into v_role from public.profile pr where pr.id = v_subject;
  v_state := app.effective_state(v_subject);

  -- 1. Account state. A suspended or expired account is refused whatever its role
  -- says, which is what makes suspension immediate.
  if v_state is distinct from 'active' then
    return query select false, 'account_state',
      case v_state
        when 'pending' then 'This account has not accepted its invitation yet.'
        when 'suspended' then 'This account is suspended. Suspension takes effect immediately, not at next sign in.'
        when 'expired' then 'This account passed its expiry date.'
        when 'locked' then 'This account is locked after repeated failed sign in attempts.'
        when 'archived' then 'This account is archived.'
        else 'This account is not active.'
      end;
    return;
  end if;

  -- 2. Lockdown. The Owner who engaged it keeps working; nobody else does.
  select * into v_lockdown from public.lockdown l where l.released_at is null limit 1;
  if v_lockdown.id is not null and v_lockdown.engaged_by is distinct from v_actor then
    return query select false, 'lockdown',
      'The system is locked down. Only the Owner who engaged it can act until it is released.';
    return;
  end if;

  -- 3. A blocking notice the account has not acknowledged.
  if exists (
    select 1 from public.account_notice n
    where n.profile_id = v_subject and n.blocking
      and n.acknowledged_at is null and n.cleared_at is null
  ) then
    return query select false, 'unacknowledged_notice',
      'There is a notice on this account that must be read and confirmed before work continues.';
    return;
  end if;

  -- 4. Impersonation blocks, which no permission overrides. The single exception
  -- is an admin-panel action during View As of an operator, evaluated for the
  -- real signed-in person in their own name (app.require_own_name).
  if v_permission.blocked_during_impersonation and app.is_impersonating()
     and not app.own_name_exception(v_subject) then
    return query select false, 'impersonation_block',
      format('%s is never done while impersonating.', v_permission.label);
    return;
  end if;

  -- 5 and 6. Overrides, denial first. Rule 2 is this ordering.
  select ap.effect, ap.reason into v_override, v_override_reason
  from public.account_permission ap
  where ap.profile_id = v_subject and ap.permission_key = p_permission
    and (ap.expires_at is null or ap.expires_at > now());

  if v_override = 'deny' then
    return query select false, 'override_deny',
      coalesce(v_override_reason, format('%s is denied on this account specifically.', v_permission.label));
    return;
  end if;

  if v_override = 'grant' then
    return query select true, 'override_grant',
      coalesce(v_override_reason, format('%s is granted on this account specifically.', v_permission.label));
    return;
  end if;

  -- 7. The role default.
  if exists (
    select 1 from public.role_permission rp
    where rp.role = v_role and rp.permission_key = p_permission
  ) then
    return query select true, 'role_default',
      format('%s is included in the %s role.', v_permission.label, v_role);
    return;
  end if;

  -- 8. Nothing granted it.
  return query select false, 'default_deny',
    format('%s is not part of the %s role, and no grant has been added.', v_permission.label, v_role);
end;
$$;

-- Staff actions from the admin panel: the permission is checked for the real
-- signed-in person, never the account being viewed, with every layer of the
-- engine applied except the View As impersonation block.
create or replace function app.require_own_name(p_permission text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d record;
begin
  perform set_config('app.own_name_action', 'on', true);
  select * into d from app.decide(p_permission, auth.uid()) limit 1;
  perform set_config('app.own_name_action', 'off', true);
  if not coalesce(d.allowed, false) then
    raise exception 'permission_denied: % (refused at the % layer)', d.reason, d.layer
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.require_own_name(text) from public, anon, authenticated;

-- 3. Permissions --------------------------------------------------------------

insert into public.permission (key, label, category, description, sort_order, is_destructive, requires_step_up, blocked_during_impersonation)
values
  ('portal.bookings.log', 'Log bookings', 'Sales Operator portal',
   'Log a booking or live transfer for review. An attestation: only the operator does this.', 900, false, false, true),
  ('portal.escalations.raise', 'Raise escalations', 'Sales Operator portal',
   'Raise an escalation, and close it once acted on.', 910, false, false, true),
  ('portal.reports.submit', 'Submit shift reports', 'Sales Operator portal',
   'Submit an end-of-shift report, or correct one with a reason.', 920, false, false, true),
  ('portal.attendance.report_absence', 'Report an absence', 'Sales Operator portal',
   'Tell DA in advance that a shift cannot be worked.', 930, false, false, true),
  ('portal.tasks.complete', 'Complete tasks and training', 'Sales Operator portal',
   'Mark an assigned task or training item done.', 940, false, false, true),
  ('portal.profile.edit', 'Edit own profile', 'Sales Operator portal',
   'Change own contact details, handle, time zone and notification channel.', 950, false, false, true),
  ('portal.payout.change', 'Change payout method', 'Sales Operator portal',
   'Change where pay is sent. Needs a fresh password confirmation and tells admins.', 960, false, true, true),
  ('portal.tax.submit', 'Submit tax documents', 'Sales Operator portal',
   'Submit a tax document for review.', 970, false, false, true),
  ('portal.pay.ask', 'Ask about pay', 'Sales Operator portal',
   'Send a question about a specific pay statement.', 980, false, false, true),
  ('portal.security.manage', 'Manage own sign-in security', 'Sales Operator portal',
   'Remove a known device from own account.', 990, false, false, true),
  ('operators.view_as', 'View as operators in scope', 'Accounts',
   'See an operator''s portal exactly as they do, read-only, for operators in scope. Never pay. The manager counterpart to Impersonate.', 115, false, true, true),
  ('escalations.answer', 'Answer escalations', 'Work',
   'Answer an operator''s escalation in your own name.', 730, false, false, true),
  ('attendance.manage', 'Decide shift attendance', 'Work',
   'Confirm an abandonment, excuse a shift, or correct an attendance record.', 740, false, false, true),
  ('tasks.assign', 'Assign tasks and training', 'Work',
   'Give an operator a task or a training item.', 750, false, false, true),
  ('operators.notes', 'Internal notes on operators', 'Work',
   'Read and add notes about an operator that the operator never sees.', 760, false, false, false),
  ('playbooks.edit', 'Edit playbooks', 'Work',
   'Edit a client playbook and its per-placement overrides.', 770, false, false, true)
on conflict (key) do nothing;

insert into public.role_permission (role, permission_key)
select 'operator'::public.user_role, k
from unnest(array[
  'portal.bookings.log', 'portal.escalations.raise', 'portal.reports.submit',
  'portal.attendance.report_absence', 'portal.tasks.complete', 'portal.profile.edit',
  'portal.payout.change', 'portal.tax.submit', 'portal.pay.ask', 'portal.security.manage'
]) k
on conflict do nothing;

insert into public.role_permission (role, permission_key)
select r::public.user_role, k
from unnest(array['owner', 'admin', 'manager']) r,
     unnest(array['escalations.answer', 'attendance.manage', 'tasks.assign', 'operators.notes', 'playbooks.edit']) k
on conflict do nothing;

insert into public.role_permission (role, permission_key)
values ('manager', 'operators.view_as')
on conflict do nothing;

-- 4. Schema -------------------------------------------------------------------

-- The placement has a shift window but never said which days it runs. Monday to
-- Friday (ISO 1 to 5) until an admin says otherwise.
alter table public.placement
  add column if not exists working_days smallint[] not null default '{1,2,3,4,5}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'placement_working_days_chk') then
    alter table public.placement add constraint placement_working_days_chk
      check (cardinality(working_days) between 1 and 7 and working_days <@ '{1,2,3,4,5,6,7}'::smallint[]);
  end if;
end
$$;

comment on column public.placement.working_days is
  'ISO days of the week the shift runs (1 = Monday ... 7 = Sunday), in the placement''s time zone. Drives attendance.';

alter table public.booking
  add column if not exists live_transfer boolean not null default false;

alter table public.escalation
  add column if not exists answer_read_at timestamptz,
  add column if not exists overdue_alerted_at timestamptz;

alter table public.eod_report
  add column if not exists system_counts jsonb,
  add column if not exists variance_explanation text;

comment on column public.eod_report.system_counts is
  'What the system recorded during the shift when the report was filed: {"appointments_booked": n, "escalations_raised": n}.';
comment on column public.eod_report.variance_explanation is
  'Why the operator''s numbers differ from system_counts. Required when they do.';

alter table public.impersonation
  add column if not exists kind text not null default 'impersonation',
  add column if not exists reason_kind text,
  add column if not exists extended_at timestamptz,
  add column if not exists extension_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'impersonation_kind_chk') then
    alter table public.impersonation add constraint impersonation_kind_chk
      check (kind in ('impersonation', 'view_as'));
    alter table public.impersonation add constraint impersonation_reason_kind_chk
      check (reason_kind is null or reason_kind in
        ('support_request', 'dispute_investigation', 'quality_review', 'pay_question', 'other'));
  end if;
end
$$;

alter table public.operator_training
  add column if not exists asset_id uuid references public.internal_asset (id) on delete set null;

-- Playbooks. One per client engagement, inherited by every VA placed with it; a
-- placement may override any field for one VA's shift.
create table if not exists public.playbook (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete cascade,
  business_name text,
  offer text,
  locations text,
  hours text,
  qualifies text,
  disqualifiers text,
  handoff_method text check (handoff_method is null or handoff_method in ('calendar', 'live_transfer')),
  handoff_steps text,
  escalation_contacts text,
  never_say text,
  approved_pricing text,
  holding_lines text[],
  version integer not null default 1,
  updated_by uuid references public.profile (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists playbook_client_uq on public.playbook (case_file_id) where placement_id is null;
create unique index if not exists playbook_placement_uq on public.playbook (placement_id) where placement_id is not null;

create table if not exists public.playbook_asset (
  playbook_id uuid not null references public.playbook (id) on delete cascade,
  asset_id uuid not null references public.internal_asset (id) on delete restrict,
  label text,
  sort_order integer not null default 100,
  primary key (playbook_id, asset_id)
);

-- What the VA was told, at every point in time.
create table if not exists public.playbook_version (
  id uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbook (id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  change_note text,
  major boolean not null default false,
  saved_by uuid references public.profile (id) on delete set null,
  saved_at timestamptz not null default now(),
  unique (playbook_id, version)
);

-- Attendance: only what a person decided or said. Everything else about a shift
-- (worked, report missing, scheduled, suspected missed) is derived from the
-- placement's schedule, reports and activity by app.placement_attendance().
create table if not exists public.shift_attendance (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placement (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  shift_date date not null,
  status text not null check (status in
    ('suspected_missed', 'notified_absence', 'excused_emergency', 'abandoned', 'worked')),
  notice_at timestamptz,
  late_notice boolean not null default false,
  reason text,
  flagged_at timestamptz,
  ghosting_alerted_at timestamptz,
  decided_by uuid references public.profile (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (placement_id, shift_date)
);

create index if not exists shift_attendance_operator_idx on public.shift_attendance (operator_id, shift_date desc);

-- A confirmed abandonment proposes $250. Nothing reaches a statement until an
-- admin approves it, and then only against unearned bonus or commission.
create table if not exists public.ld_proposal (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null unique references public.shift_attendance (id) on delete cascade,
  operator_id uuid not null references public.operator (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  shift_date date not null,
  amount numeric not null default 250 check (amount > 0),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'dismissed')),
  decided_by uuid references public.profile (id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  statement_id uuid references public.pay_statement (id) on delete set null,
  applied_amount numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.pay_question (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  statement_id uuid not null references public.pay_statement (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 2000),
  asked_at timestamptz not null default now(),
  answer text,
  answered_by uuid references public.profile (id) on delete set null,
  answered_at timestamptz,
  answer_read_at timestamptz
);

create index if not exists pay_question_open_idx on public.pay_question (asked_at) where answered_at is null;

-- Notes about an operator that the operator never sees.
create table if not exists public.operator_note (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.operator (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 5000),
  author_profile_id uuid references public.profile (id) on delete set null,
  author_name text not null,
  impersonation_id uuid references public.impersonation (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists operator_note_operator_idx on public.operator_note (operator_id, created_at desc);

-- New tables: staff read them directly; every write goes through a function.
alter table public.playbook enable row level security;
alter table public.playbook_asset enable row level security;
alter table public.playbook_version enable row level security;
alter table public.shift_attendance enable row level security;
alter table public.ld_proposal enable row level security;
alter table public.pay_question enable row level security;
alter table public.operator_note enable row level security;

revoke all on public.playbook, public.playbook_asset, public.playbook_version, public.shift_attendance,
  public.ld_proposal, public.pay_question, public.operator_note from anon, authenticated;
grant select on public.playbook, public.playbook_asset, public.playbook_version, public.shift_attendance,
  public.ld_proposal, public.pay_question, public.operator_note to authenticated;

drop policy if exists playbook_staff_read on public.playbook;
create policy playbook_staff_read on public.playbook for select to authenticated
  using (app.is_admin() or (app.is_manager() and app.in_scope_case_file(case_file_id)));

drop policy if exists playbook_asset_staff_read on public.playbook_asset;
create policy playbook_asset_staff_read on public.playbook_asset for select to authenticated
  using (exists (select 1 from public.playbook p where p.id = playbook_id
                 and (app.is_admin() or (app.is_manager() and app.in_scope_case_file(p.case_file_id)))));

drop policy if exists playbook_version_staff_read on public.playbook_version;
create policy playbook_version_staff_read on public.playbook_version for select to authenticated
  using (exists (select 1 from public.playbook p where p.id = playbook_id
                 and (app.is_admin() or (app.is_manager() and app.in_scope_case_file(p.case_file_id)))));

drop policy if exists shift_attendance_staff_read on public.shift_attendance;
create policy shift_attendance_staff_read on public.shift_attendance for select to authenticated
  using (app.is_admin() or (app.is_manager() and app.in_scope_placement(placement_id)));

drop policy if exists ld_proposal_admin_read on public.ld_proposal;
create policy ld_proposal_admin_read on public.ld_proposal for select to authenticated
  using (app.is_admin());

drop policy if exists pay_question_payroll_read on public.pay_question;
create policy pay_question_payroll_read on public.pay_question for select to authenticated
  using (app.can('payroll.view'));

drop policy if exists operator_note_staff_read on public.operator_note;
create policy operator_note_staff_read on public.operator_note for select to authenticated
  using (app.can('operators.notes') and (app.is_admin() or exists (
    select 1 from public.placement pl where pl.operator_id = operator_note.operator_id
      and app.in_scope_placement(pl.id))));

-- 5. Operators leave the tables ------------------------------------------------

drop policy if exists placement_operator_read on public.placement;
drop policy if exists booking_operator_read on public.booking;
drop policy if exists eod_report_operator_own on public.eod_report;
drop policy if exists eod_comment_operator_read on public.eod_comment;
drop policy if exists escalation_operator_own on public.escalation;
drop policy if exists operator_task_own on public.operator_task;
drop policy if exists operator_training_own on public.operator_training;
drop policy if exists operator_notification_own on public.operator_notification;
drop policy if exists notification_attempt_own on public.notification_attempt;
drop policy if exists pay_statement_operator_read on public.pay_statement;
drop policy if exists pay_adjustment_operator_read on public.pay_adjustment;
drop policy if exists payout_operator_read on public.payout;
drop policy if exists response_day_operator_read on public.response_day;
drop policy if exists operator_self_read on public.operator;
drop policy if exists lead_operator_read on public.lead;
drop policy if exists lead_touch_operator_read on public.lead_touch;

-- 6. A notice is confirmed by the person it was for --------------------------

create or replace function public.acknowledge_notice(p_notice_id uuid)
returns public.account_notice
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.account_notice;
begin
  -- Confirming a notice is the account holder's own statement that they read it.
  -- Nobody makes it for them, including an admin viewing as them.
  if app.is_impersonating() then
    raise exception 'view_as_read_only: only the account holder can confirm they read their own notice'
      using errcode = '42501';
  end if;

  update public.account_notice
     set acknowledged_at = now()
   where id = p_notice_id and profile_id = app.acting_profile() and acknowledged_at is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'notice_not_found: that notice is not yours, or you have already confirmed it'
      using errcode = 'P0002';
  end if;

  perform app.audit('account.notice_acknowledged', 'account_notice', p_notice_id::text,
    'Confirmed they read the notice', null, null, null, v_row.profile_id);

  return v_row;
end;
$$;
