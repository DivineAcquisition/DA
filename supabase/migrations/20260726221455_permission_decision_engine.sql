-- ---------------------------------------------------------------------------
-- Who is asking
--
-- Two different questions, and conflating them is how impersonation audit trails
-- go wrong. The actor is always the real signed-in account. The acting profile is
-- who the application is presenting itself as, which differs only during an
-- impersonation session.
-- ---------------------------------------------------------------------------

create or replace function app.actor_profile()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function app.live_impersonation()
returns public.impersonation
language sql
stable
security definer
set search_path = ''
as $$
  select i.* from public.impersonation i
  where i.actor_profile_id = auth.uid()
    and i.ended_at is null
    and i.expires_at > now()
  limit 1;
$$;

create or replace function app.acting_profile()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((app.live_impersonation()).target_profile_id, auth.uid());
$$;

create or replace function app.is_impersonating()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (app.live_impersonation()).id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Effective account state
--
-- Expiry and a lock are computed rather than stored, because a stored state needs
-- a job to keep it true and an account whose expiry passed an hour ago should
-- already be refused.
-- ---------------------------------------------------------------------------

create or replace function app.effective_state(p_profile_id uuid)
returns public.account_state
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null then null
    when p.archived_at is not null then 'archived'::public.account_state
    when p.soft_deleted_at is not null then 'archived'::public.account_state
    when p.state = 'suspended' then 'suspended'::public.account_state
    when p.locked_until is not null and p.locked_until > now() then 'locked'::public.account_state
    when p.expires_on is not null and p.expires_on < current_date then 'expired'::public.account_state
    else p.state
  end
  from public.profile p where p.id = p_profile_id;
$$;

-- ---------------------------------------------------------------------------
-- The decision
--
-- Three layers combine, and the order below is the whole model:
--
--   1. account state      a suspended or expired account is refused, whatever
--                         its role says. This is what makes suspension immediate.
--   2. lockdown           break glass refuses everyone but the acting Owner.
--   3. blocking notice    a required acknowledgement stops work until confirmed.
--   4. impersonation      certain actions are never taken while impersonating.
--   5. override deny      an explicit denial beats any grant.
--   6. override grant
--   7. role default
--   8. default deny
--
-- Rule 2 falls out of the ordering: every denial layer sits above every grant
-- layer. The function returns which layer decided, because without that,
-- permission debugging is guesswork.
-- ---------------------------------------------------------------------------

create or replace function app.decide(p_permission text, p_profile_id uuid default null)
returns table (allowed boolean, layer text, reason text)
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

  select * into v_permission from public.permission where key = p_permission;
  if v_permission.key is null then
    return query select false, 'unknown_permission',
      format('There is no permission called %L.', p_permission);
    return;
  end if;

  select role into v_role from public.profile where id = v_subject;
  v_state := app.effective_state(v_subject);

  -- 1. Account state.
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
  select * into v_lockdown from public.lockdown where released_at is null limit 1;
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

  -- 4. Impersonation blocks, which no permission overrides.
  if v_permission.blocked_during_impersonation and app.is_impersonating() then
    return query select false, 'impersonation_block',
      format('%s is never done while impersonating.', v_permission.label);
    return;
  end if;

  -- 5 and 6. Overrides, denial first.
  select effect, reason into v_override, v_override_reason
  from public.account_permission
  where profile_id = v_subject and permission_key = p_permission
    and (expires_at is null or expires_at > now());

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
    select 1 from public.role_permission
    where role = v_role and permission_key = p_permission
  ) then
    return query select true, 'role_default', format('%s is included in the %s role.', v_permission.label, v_role);
    return;
  end if;

  -- 8. Nothing granted it.
  return query select false, 'default_deny',
    format('%s is not part of the %s role, and no grant has been added.', v_permission.label, v_role);
end;
$$;

create or replace function app.can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select allowed from app.decide(p_permission) limit 1), false);
$$;

-- The actor's own permission, ignoring any impersonation. Used by the things an
-- admin must still be able to do while impersonating, above all leaving.
create or replace function app.actor_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select allowed from app.decide(p_permission, auth.uid()) limit 1), false);
$$;

-- Exposed so the workspace can show why an account was refused, naming the layer.
create or replace function public.explain_permission(
  p_permission text,
  p_profile_id uuid default null
)
returns table (allowed boolean, layer text, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  -- Reading someone else's decision is itself an account-oversight action.
  select d.allowed, d.layer, d.reason
  from app.decide(
    p_permission,
    case when p_profile_id is null or p_profile_id = auth.uid() then p_profile_id
         when app.actor_can('accounts.view') then p_profile_id
         else auth.uid() end
  ) d;
$$;

-- Refuses with the reason the engine gave, so an error message says which layer
-- said no rather than "forbidden".
create or replace function app.require(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d record;
begin
  select * into d from app.decide(p_permission) limit 1;
  if not d.allowed then
    raise exception 'permission_denied: % (refused at the % layer)', d.reason, d.layer
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scope
-- ---------------------------------------------------------------------------

-- Which case files the acting account can reach. Rule 1: this is what the row
-- policies call, so an account asking for a client outside its scope is refused by
-- the query rather than by a hidden button.
create or replace function app.in_scope_case_file(p_case_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_case_file_id is not null
    and app.effective_state(app.acting_profile()) = 'active'
    and exists (
      select 1 from public.account_scope s
      where s.profile_id = app.acting_profile()
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

create or replace function app.in_scope_placement(p_placement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_placement_id is not null
    and app.effective_state(app.acting_profile()) = 'active'
    and exists (
      select 1 from public.account_scope s
      left join public.placement pl on pl.id = p_placement_id
      where s.profile_id = app.acting_profile()
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

-- The list form, for a page that needs to show what an account can reach.
create or replace function public.scoped_case_files(p_profile_id uuid default null)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with subject as (
    select case
      when p_profile_id is null then app.acting_profile()
      when p_profile_id = auth.uid() then p_profile_id
      when app.actor_can('accounts.view') then p_profile_id
      else app.acting_profile()
    end as id
  )
  select cf.id
  from public.client_case_file cf, subject, public.account_scope s
  where s.profile_id = subject.id
    and (
      s.kind = 'all_clients'
      or (s.kind = 'clients' and exists (
            select 1 from public.account_scope_client c
            where c.profile_id = s.profile_id and c.case_file_id = cf.id))
      or (s.kind = 'placements' and exists (
            select 1 from public.account_scope_placement sp
            join public.placement pl on pl.id = sp.placement_id
            where sp.profile_id = s.profile_id and pl.case_file_id = cf.id))
    );
$$;

-- ---------------------------------------------------------------------------
-- Seniority
--
-- An Admin cannot change an Owner-level role, and nobody impersonates an Owner.
-- Both are rank questions rather than permission questions.
-- ---------------------------------------------------------------------------

create or replace function app.rank(p_role public.user_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then 100
    when 'admin' then 80
    when 'manager' then 60
    when 'operator' then 40
    when 'contractor' then 20
    when 'client' then 10
    else 0
  end;
$$;

-- Whether the actor may act on this target at all. An Owner may act on anyone; an
-- Admin may not touch an Owner.
create or replace function app.can_target(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_target is null then false
    when (select role from public.profile where id = auth.uid()) = 'owner' then true
    else app.rank((select role from public.profile where id = auth.uid()))
         > app.rank((select role from public.profile where id = p_target))
  end;
$$;

create or replace function app.require_target(p_target uuid, p_action text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.can_target(p_target) then
    raise exception 'outranked: % is at or above your own level, so you cannot % on it.',
      coalesce((select coalesce(full_name, email) from public.profile where id = p_target), 'that account'),
      p_action
      using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step-up
-- ---------------------------------------------------------------------------

create or replace function app.require_step_up(p_purpose text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.step_up_verification
  where profile_id = auth.uid()
    and purpose = p_purpose
    and consumed_at is null
    and expires_at > now()
  order by verified_at desc
  limit 1;

  if v_id is null then
    raise exception 'step_up_required: confirm your password to %.', p_purpose
      using errcode = '42501';
  end if;

  -- Single use, so one confirmation does not authorise a run of actions.
  update public.step_up_verification set consumed_at = now() where id = v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Writing to the log
-- ---------------------------------------------------------------------------

create or replace function app.audit(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_summary text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_case_file_id uuid default null,
  p_subject uuid default null
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_imp public.impersonation := app.live_impersonation();
begin
  insert into public.audit_event (
    actor_profile_id, actor_email, actor_role,
    acting_as_profile_id, impersonation_id,
    action, entity_type, entity_id, case_file_id, summary, before_value, after_value
  )
  select
    auth.uid(), p.email, p.role,
    -- Rule 5: attributed to the real admin, with the target recorded alongside,
    -- never to the target alone.
    coalesce(p_subject, v_imp.target_profile_id), v_imp.id,
    p_action, p_entity_type, p_entity_id, p_case_file_id, p_summary, p_before, p_after
  from public.profile p where p.id = auth.uid()
  returning id into v_id;

  return v_id;
end;
$$;

-- Events an Owner is told about as they happen.
create or replace function app.raise_owner_alert(
  p_kind text,
  p_summary text,
  p_audit_event_id bigint default null,
  p_subject uuid default null,
  p_severity public.notification_severity default 'important'
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.owner_alert (kind, summary, audit_event_id, subject_profile_id, severity)
  values (p_kind, p_summary, p_audit_event_id, p_subject, p_severity);
$$;
