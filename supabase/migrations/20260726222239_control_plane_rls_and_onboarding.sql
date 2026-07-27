-- ---------------------------------------------------------------------------
-- RLS on the control plane
--
-- Rule 1: enforced at the data layer. Every table below refuses at the query, so
-- an account calling the REST API directly gets the same answer the interface
-- would have given it.
-- ---------------------------------------------------------------------------

alter table public.permission enable row level security;
alter table public.role_permission enable row level security;
alter table public.account_scope enable row level security;
alter table public.account_scope_client enable row level security;
alter table public.account_scope_placement enable row level security;
alter table public.account_permission enable row level security;
alter table public.audit_event enable row level security;
alter table public.owner_alert enable row level security;
alter table public.login_event enable row level security;
alter table public.known_device enable row level security;
alter table public.step_up_verification enable row level security;
alter table public.impersonation enable row level security;
alter table public.lockdown enable row level security;
alter table public.account_notice enable row level security;
alter table public.contractor_task enable row level security;
alter table public.account_invite enable row level security;
alter table public.client_credential enable row level security;
alter table public.credential_grant enable row level security;
alter table public.credential_view enable row level security;

-- The catalogue is a dictionary, not data about anyone. Readable by any session so
-- an account can be shown what a permission means.
create policy permission_read on public.permission for select to authenticated using (true);
create policy role_permission_read on public.role_permission for select to authenticated using (true);

-- An account always sees its own scope, its own overrides, its own sessions and
-- its own history. Seeing anyone else's is an oversight permission.
create policy account_scope_read on public.account_scope
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

create policy account_scope_client_read on public.account_scope_client
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

create policy account_scope_placement_read on public.account_scope_placement
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

create policy account_permission_read on public.account_permission
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

-- Rule 4: read only, for everyone. There is no insert, update or delete policy on
-- the audit log at all, so the only way in is app.audit(), which runs as definer
-- inside the control functions.
create policy audit_event_read on public.audit_event
  for select to authenticated
  using (
    app.can('audit.view')
    -- An account can always read what was done to it and what it did.
    or actor_profile_id = app.acting_profile()
    or acting_as_profile_id = app.acting_profile()
  );

create policy owner_alert_read on public.owner_alert
  for select to authenticated using (app.can('audit.view'));
create policy owner_alert_ack on public.owner_alert
  for update to authenticated using (app.can('audit.view')) with check (app.can('audit.view'));

create policy login_event_read on public.login_event
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

create policy known_device_read on public.known_device
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

-- A step-up record is only ever the caller's own, and only its existence matters.
create policy step_up_own on public.step_up_verification
  for select to authenticated using (profile_id = auth.uid());

-- The actor sees their own impersonation sessions. The target sees the ones taken
-- on them, which is the after-the-fact notification made permanent.
create policy impersonation_read on public.impersonation
  for select to authenticated
  using (
    actor_profile_id = auth.uid()
    or target_profile_id = app.acting_profile()
    or app.can('audit.view')
  );

create policy lockdown_read on public.lockdown for select to authenticated using (true);

create policy account_notice_own on public.account_notice
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('accounts.view'));

create policy account_invite_read on public.account_invite
  for select to authenticated using (app.can('accounts.invite'));

-- The credential row itself. Reading the metadata needs the permission and the
-- scope, or a live grant; the secret is not in this table and is never selected.
create policy client_credential_read on public.client_credential
  for select to authenticated
  using (
    (app.can('credentials.view') and app.in_scope_case_file(case_file_id))
    or (app.can('credentials.manage') and app.in_scope_case_file(case_file_id))
    or exists (
      select 1 from public.credential_grant g
      where g.credential_id = id and g.profile_id = app.acting_profile()
        and g.revoked_at is null and g.expires_at > now()
    )
  );

create policy credential_grant_read on public.credential_grant
  for select to authenticated
  using (profile_id = app.acting_profile() or app.can('credentials.grant') or app.can('accounts.view'));

create policy credential_view_read on public.credential_view
  for select to authenticated
  using (app.can('audit.view') or viewed_by = app.acting_profile());

create policy contractor_task_admin on public.contractor_task
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- The profile table gains what the workspace needs, on top of the existing
-- policies. Everyone reads their own row; oversight reads the roster.
create policy profile_roster_read on public.profile
  for select to authenticated
  using (id = app.acting_profile() or app.can('accounts.view'));

revoke all on all tables in schema public from anon;
grant select on public.v_credential to authenticated;

-- ---------------------------------------------------------------------------
-- Onboarding
--
-- A checklist rather than a wizard, because the useful question is which accounts
-- stalled partway through rather than what the next screen is.
-- ---------------------------------------------------------------------------

create or replace view public.v_account_onboarding
with (security_invoker = true)
as
select
  p.id as profile_id,
  p.email,
  coalesce(p.full_name, p.email) as name,
  p.role,
  app.effective_state(p.id) as state,
  p.created_at,
  -- invited
  true as invited,
  p.accepted_at is not null as accepted,
  exists (
    select 1 from auth.mfa_factors f
    where f.user_id = p.id and f.status = 'verified'
  ) as second_factor_enabled,
  app.mfa_is_required(p.role, p.mfa_required) as second_factor_required,
  exists (select 1 from public.account_scope s where s.profile_id = p.id) as scope_set,
  (
    select s.kind = 'all_clients'
        or exists (select 1 from public.account_scope_client c where c.profile_id = p.id)
        or exists (select 1 from public.account_scope_placement sp where sp.profile_id = p.id)
    from public.account_scope s where s.profile_id = p.id
  ) as scope_populated,
  exists (
    select 1 from public.operator_training t
    join public.operator o on o.id = t.operator_id
    where o.profile_id = p.id
  ) as training_assigned,
  (
    select o.certified_on is not null from public.operator o where o.profile_id = p.id
  ) as certified,
  p.role in ('operator') as certification_required,
  (
    exists (select 1 from public.placement pl join public.operator o on o.id = pl.operator_id
            where o.profile_id = p.id)
    or exists (select 1 from public.account_scope_client c where c.profile_id = p.id)
    or exists (select 1 from public.contractor_task t where t.profile_id = p.id)
  ) as first_assignment_made
from public.profile p
where p.soft_deleted_at is null;

-- ---------------------------------------------------------------------------
-- Offboarding
--
-- A fixed order, and each step refuses out of turn. Revoking sessions before
-- suspending would let the account sign straight back in; archiving before the
-- work is reassigned leaves a client unanswered.
-- ---------------------------------------------------------------------------

create table public.offboarding (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  started_at timestamptz not null default now(),
  started_by uuid references public.profile (id),
  sessions_revoked_at timestamptz,
  suspended_at timestamptz,
  work_reassigned_at timestamptz,
  credentials_listed_at timestamptz,
  credentials_to_rotate integer,
  pay_period_closed_at timestamptz,
  archived_at timestamptz,
  completed_at timestamptz,
  notes text
);

alter table public.offboarding enable row level security;
create policy offboarding_read on public.offboarding
  for select to authenticated using (app.can('accounts.view'));

create or replace function public.offboarding_state(p_profile_id uuid)
returns table (
  step integer,
  key text,
  label text,
  detail text,
  done boolean,
  blocked boolean,
  blocker text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.offboarding;
  v_open text;
  v_creds integer;
  v_open_period integer;
begin
  select * into o from public.offboarding where profile_id = p_profile_id;

  select string_agg(format('%s (%s)', label, count), ', ' order by kind) into v_open
  from public.open_work_for(p_profile_id) where count > 0;

  select count(*)::integer into v_creds from public.credentials_reachable_by(p_profile_id);

  select count(*)::integer into v_open_period
  from public.pay_statement st
  join public.pay_period pp on pp.id = st.pay_period_id
  join public.operator op on op.id = st.operator_id
  where op.profile_id = p_profile_id and pp.closed_at is null;

  return query
  select 1, 'revoke_sessions', 'Revoke sessions',
         'Ends every live session so nothing continues under this account.',
         o.sessions_revoked_at is not null, false, null::text
  union all
  select 2, 'suspend', 'Suspend the account',
         'Immediate. Every permission check reads the state, so it applies on the next query.',
         o.suspended_at is not null,
         o.sessions_revoked_at is null, 'Revoke the sessions first.'
  union all
  select 3, 'reassign_work', 'Reassign open work',
         coalesce('Still open: ' || v_open, 'Nothing is left unassigned.'),
         o.work_reassigned_at is not null and v_open is null,
         o.suspended_at is null, 'Suspend the account first.'
  union all
  select 4, 'list_credentials', 'List credentials for rotation',
         format('%s credential(s) this account could reach.', v_creds),
         o.credentials_listed_at is not null,
         v_open is not null, 'Reassign the open work first.'
  union all
  select 5, 'close_pay_period', 'Close any open pay period',
         case when v_open_period > 0
              then format('%s statement(s) sit in an open period.', v_open_period)
              else 'No open pay period for this account.' end,
         o.pay_period_closed_at is not null or v_open_period = 0,
         o.credentials_listed_at is null, 'List the credentials first.'
  union all
  select 6, 'archive', 'Archive',
         'Archive rather than delete, so the audit trail and the case file history survive.',
         o.archived_at is not null,
         o.credentials_listed_at is null or v_open is not null,
         'Finish the earlier steps first.'
  order by 1;
end;
$$;

create or replace function public.advance_offboarding(p_profile_id uuid, p_step text)
returns setof record
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_state record;
  v_creds integer;
begin
  perform app.require('accounts.suspend');
  perform app.require_target(p_profile_id, 'offboard it');

  insert into public.offboarding (profile_id, started_by)
  values (p_profile_id, auth.uid())
  on conflict (profile_id) do nothing;

  select * into v_state from public.offboarding_state(p_profile_id) where key = p_step;
  if v_state.key is null then
    raise exception 'unknown_step: there is no offboarding step called %L', p_step using errcode = '23514';
  end if;
  if v_state.blocked then
    raise exception 'out_of_order: %', v_state.blocker using errcode = '23514';
  end if;

  if p_step = 'revoke_sessions' then
    perform public.revoke_account_sessions(p_profile_id);
    update public.offboarding set sessions_revoked_at = now() where profile_id = p_profile_id;
  elsif p_step = 'suspend' then
    if app.effective_state(p_profile_id) <> 'suspended' then
      perform public.suspend_account(p_profile_id, 'Offboarding');
    end if;
    update public.offboarding set suspended_at = now() where profile_id = p_profile_id;
  elsif p_step = 'reassign_work' then
    if exists (select 1 from public.open_work_for(p_profile_id) where count > 0) then
      raise exception 'work_still_open: reassign the open work before marking this step done'
        using errcode = '23514';
    end if;
    update public.offboarding set work_reassigned_at = now() where profile_id = p_profile_id;
  elsif p_step = 'list_credentials' then
    select count(*)::integer into v_creds from public.credentials_reachable_by(p_profile_id);
    update public.offboarding
       set credentials_listed_at = now(), credentials_to_rotate = v_creds
     where profile_id = p_profile_id;
  elsif p_step = 'close_pay_period' then
    update public.offboarding set pay_period_closed_at = now() where profile_id = p_profile_id;
  elsif p_step = 'archive' then
    perform public.archive_account(p_profile_id);
    update public.offboarding set archived_at = now(), completed_at = now() where profile_id = p_profile_id;
  end if;

  perform app.audit('account.offboarding_step', 'profile', p_profile_id::text,
    format('Offboarding: %s', v_state.label), null, null, null, p_profile_id);

  return;
end;
$$;
