-- ---------------------------------------------------------------------------
-- Owner protections
--
-- Rule 8: the system never allows zero Owners, and an Owner cannot remove or
-- demote themselves while they are the only one. Checked in one place so no
-- control function can forget it.
-- ---------------------------------------------------------------------------

create or replace function app.active_owner_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profile p
  where p.role = 'owner' and app.effective_state(p.id) = 'active';
$$;

create or replace function app.guard_last_owner(p_target uuid, p_action text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select role from public.profile where id = p_target) = 'owner'
     and app.effective_state(p_target) = 'active'
     and app.active_owner_count() <= 1 then
    raise exception 'last_owner: this is the only active Owner, so %s would leave the system with none.', p_action
      using errcode = '23514';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------------------

-- Rule 9. Suspension revokes sessions in the same call, and because every
-- permission check reads the state, the account is refused on its next query
-- rather than at its next sign in.
create or replace function public.suspend_account(p_profile_id uuid, p_reason text)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after public.profile;
begin
  perform app.require('accounts.suspend');
  perform app.require_target(p_profile_id, 'suspend it');
  perform app.guard_last_owner(p_profile_id, 'suspending it');

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required: say why, so the account can be told and the log makes sense later'
      using errcode = '23514';
  end if;

  select to_jsonb(p) - 'notes' into v_before from public.profile p where p.id = p_profile_id;

  update public.profile
     set state = 'suspended', suspended_at = now(),
         suspended_reason = btrim(p_reason), suspended_by = auth.uid()
   where id = p_profile_id
  returning * into v_after;

  if v_after.id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  -- Immediate, not eventual.
  delete from auth.sessions where user_id = p_profile_id;

  perform app.audit('account.suspended', 'profile', p_profile_id::text,
    format('Suspended %s: %s', v_after.email, btrim(p_reason)),
    v_before, jsonb_build_object('state', 'suspended', 'reason', btrim(p_reason)),
    null, p_profile_id);

  return v_after;
end;
$$;

create or replace function public.reactivate_account(p_profile_id uuid)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
begin
  perform app.require('accounts.suspend');
  perform app.require_target(p_profile_id, 'reactivate it');

  update public.profile
     set state = 'active', suspended_at = null, suspended_reason = null, suspended_by = null,
         failed_attempts = 0, locked_until = null, locked_reason = null
   where id = p_profile_id and archived_at is null and soft_deleted_at is null
  returning * into v_after;

  if v_after.id is null then
    raise exception 'not_reactivatable: an archived or deleted account is restored, not reactivated'
      using errcode = '23514';
  end if;

  perform app.audit('account.reactivated', 'profile', p_profile_id::text,
    format('Reactivated %s', v_after.email), null, null, null, p_profile_id);

  return v_after;
end;
$$;

create or replace function public.set_account_expiry(p_profile_id uuid, p_expires_on date)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
  v_role public.user_role;
begin
  perform app.require('accounts.scope_change');
  perform app.require_target(p_profile_id, 'change its expiry');

  select role into v_role from public.profile where id = p_profile_id;
  if v_role = 'contractor' and p_expires_on is null then
    raise exception 'expiry_required: a Contractor account must always carry an expiry date'
      using errcode = '23514';
  end if;

  update public.profile set expires_on = p_expires_on where id = p_profile_id returning * into v_after;

  perform app.audit('account.expiry_set', 'profile', p_profile_id::text,
    coalesce(format('Expiry set to %s', p_expires_on), 'Expiry removed'),
    null, jsonb_build_object('expires_on', p_expires_on), null, p_profile_id);

  return v_after;
end;
$$;

-- What still has this account's name on it. Deactivation refuses while any of it
-- is open, because unassigned work is how a client stops being answered.
create or replace function public.open_work_for(p_profile_id uuid)
returns table (kind text, label text, count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select 'placements', 'Active placements', count(*)::integer
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  where o.profile_id = p_profile_id and pl.status = 'active'
  union all
  select 'escalations', 'Open escalations raised', count(*)::integer
  from public.escalation e
  join public.operator o on o.id = e.operator_id
  where o.profile_id = p_profile_id and e.status = 'open'
  union all
  select 'booking_claims', 'Booking claims awaiting review', count(*)::integer
  from public.booking b
  join public.operator o on o.id = b.operator_id
  where o.profile_id = p_profile_id and b.state = 'pending_review'
  union all
  select 'documents', 'Documents part-written', count(*)::integer
  from public.document d
  where d.generated_by = p_profile_id and d.state in ('draft', 'in_review')
  union all
  select 'assigned_clients', 'Clients assigned in scope', count(*)::integer
  from public.account_scope_client c where c.profile_id = p_profile_id
  union all
  select 'contractor_tasks', 'Build tasks not finished', count(*)::integer
  from public.contractor_task t where t.profile_id = p_profile_id and t.completed_at is null;
$$;

-- Rule 7: archive, never delete, because the audit trail and the case file history
-- have to survive the person leaving.
create or replace function public.archive_account(p_profile_id uuid)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
  v_open text;
begin
  perform app.require('accounts.suspend');
  perform app.require_target(p_profile_id, 'archive it');
  perform app.guard_last_owner(p_profile_id, 'archiving it');

  select string_agg(format('%s (%s)', label, count), ', ' order by kind) into v_open
  from public.open_work_for(p_profile_id) where count > 0;

  if v_open is not null then
    raise exception 'work_still_open: reassign this account''s open work first: %', v_open
      using errcode = '23514';
  end if;

  update public.profile
     set state = 'archived', archived_at = now()
   where id = p_profile_id
  returning * into v_after;

  delete from auth.sessions where user_id = p_profile_id;

  perform app.audit('account.archived', 'profile', p_profile_id::text,
    format('Archived %s', v_after.email), null, null, null, p_profile_id);

  return v_after;
end;
$$;

create or replace function public.soft_delete_account(p_profile_id uuid, p_recovery_days integer default 30)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
  v_open text;
begin
  perform app.require('accounts.soft_delete');
  perform app.require_target(p_profile_id, 'delete it');
  perform app.guard_last_owner(p_profile_id, 'deleting it');
  perform app.require_step_up('delete an account');

  select string_agg(format('%s (%s)', label, count), ', ' order by kind) into v_open
  from public.open_work_for(p_profile_id) where count > 0;

  if v_open is not null then
    raise exception 'work_still_open: reassign this account''s open work first: %', v_open
      using errcode = '23514';
  end if;

  update public.profile
     set soft_deleted_at = now(), soft_deleted_by = auth.uid(),
         purge_after = now() + make_interval(days => greatest(coalesce(p_recovery_days, 30), 1)),
         state = 'archived'
   where id = p_profile_id
  returning * into v_after;

  delete from auth.sessions where user_id = p_profile_id;

  perform app.audit('account.soft_deleted', 'profile', p_profile_id::text,
    format('Soft deleted %s, recoverable until %s', v_after.email, v_after.purge_after::date),
    null, null, null, p_profile_id);

  return v_after;
end;
$$;

create or replace function public.restore_account(p_profile_id uuid)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
begin
  perform app.require('accounts.soft_delete');
  perform app.require_target(p_profile_id, 'restore it');

  update public.profile
     set soft_deleted_at = null, soft_deleted_by = null, purge_after = null,
         archived_at = null, state = 'suspended',
         suspended_reason = 'Restored from deletion. Reactivate when the account is wanted again.'
   where id = p_profile_id and soft_deleted_at is not null
  returning * into v_after;

  if v_after.id is null then
    raise exception 'not_deleted: this account is not in the recovery window' using errcode = '23514';
  end if;

  perform app.audit('account.restored', 'profile', p_profile_id::text,
    format('Restored %s, suspended pending reactivation', v_after.email), null, null, null, p_profile_id);

  return v_after;
end;
$$;

-- Owner only, and only after the recovery window. Everything that references the
-- account keeps its history because those columns are ON DELETE SET NULL, and the
-- audit log keeps the email and role it recorded at the time.
create or replace function public.permanently_delete_account(p_profile_id uuid, p_typed_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.profile;
  v_audit bigint;
begin
  perform app.require('accounts.permanent_delete');
  perform app.require_target(p_profile_id, 'permanently delete it');
  perform app.guard_last_owner(p_profile_id, 'deleting it');
  perform app.require_step_up('permanently delete an account');

  select * into v from public.profile where id = p_profile_id;
  if v.id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if v.soft_deleted_at is null then
    raise exception 'not_soft_deleted: soft delete it first. The recovery window exists for a reason.'
      using errcode = '23514';
  end if;
  if v.purge_after > now() then
    raise exception 'recovery_window_open: this account is recoverable until %. It cannot be purged before then.', v.purge_after::date
      using errcode = '23514';
  end if;
  if lower(btrim(coalesce(p_typed_email, ''))) <> lower(v.email) then
    raise exception 'confirmation_mismatch: type the account email exactly to confirm'
      using errcode = '23514';
  end if;

  -- Logged before the row goes, so the log records what was removed.
  v_audit := app.audit('account.permanently_deleted', 'profile', p_profile_id::text,
    format('Permanently deleted %s (%s)', v.email, v.role),
    to_jsonb(v) - 'notes', null, null, null);

  perform app.raise_owner_alert('permanent_deletion',
    format('%s permanently deleted the account %s', (select email from public.profile where id = auth.uid()), v.email),
    v_audit, null, 'urgent');

  delete from auth.users where id = p_profile_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity and access
-- ---------------------------------------------------------------------------

-- What an account gains and loses by moving role, so the confirmation can say it
-- rather than asking the admin to trust it.
create or replace function public.role_change_preview(p_profile_id uuid, p_new_role public.user_role)
returns table (permission_key text, label text, category text, change text)
language sql
stable
security definer
set search_path = ''
as $$
  with current_role_keys as (
    select rp.permission_key from public.role_permission rp
    where rp.role = (select role from public.profile where id = p_profile_id)
  ),
  next_role_keys as (
    select rp.permission_key from public.role_permission rp where rp.role = p_new_role
  )
  select p.key, p.label, p.category,
    case when n.permission_key is not null and c.permission_key is null then 'gains'
         when n.permission_key is null and c.permission_key is not null then 'loses'
         else 'keeps' end
  from public.permission p
  left join current_role_keys c on c.permission_key = p.key
  left join next_role_keys n on n.permission_key = p.key
  where (c.permission_key is not null) <> (n.permission_key is not null)
  order by p.sort_order;
$$;

create or replace function public.change_account_role(p_profile_id uuid, p_new_role public.user_role)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.user_role;
  v_after public.profile;
  v_actor_role public.user_role;
  v_audit bigint;
begin
  perform app.require('accounts.role_change');
  perform app.require_target(p_profile_id, 'change its role');
  perform app.require_step_up('change a role');

  select role into v_before from public.profile where id = p_profile_id;
  select role into v_actor_role from public.profile where id = auth.uid();

  if v_before = p_new_role then
    raise exception 'no_change: that account is already a %', p_new_role using errcode = '23514';
  end if;

  -- An Admin cannot create an Owner, only an Owner can.
  if p_new_role = 'owner' and v_actor_role <> 'owner' then
    raise exception 'owner_only: only an Owner can make another Owner' using errcode = '42501';
  end if;

  -- Rule 8, from the demotion direction.
  if v_before = 'owner' and p_new_role <> 'owner' then
    perform app.guard_last_owner(p_profile_id, 'demoting it');
    if p_profile_id = auth.uid() and app.active_owner_count() <= 1 then
      raise exception 'last_owner: you are the only Owner and cannot demote yourself' using errcode = '23514';
    end if;
  end if;

  if p_new_role = 'contractor' and (select expires_on from public.profile where id = p_profile_id) is null then
    raise exception 'expiry_required: give the account an expiry date before making it a Contractor'
      using errcode = '23514';
  end if;

  update public.profile
     set role = p_new_role,
         session_timeout_minutes = app.default_session_minutes(p_new_role),
         mfa_required = null
   where id = p_profile_id
  returning * into v_after;

  -- An Owner or Admin reaches every client; a narrower role should not inherit
  -- that quietly.
  if p_new_role in ('owner', 'admin') then
    insert into public.account_scope (profile_id, kind, set_by)
    values (p_profile_id, 'all_clients', auth.uid())
    on conflict (profile_id) do update set kind = 'all_clients', set_by = auth.uid(), updated_at = now();
  elsif v_before in ('owner', 'admin') then
    insert into public.account_scope (profile_id, kind, set_by)
    values (p_profile_id, 'clients', auth.uid())
    on conflict (profile_id) do update set kind = 'clients', set_by = auth.uid(), updated_at = now();
  end if;

  v_audit := app.audit('account.role_changed', 'profile', p_profile_id::text,
    format('%s moved from %s to %s', v_after.email, v_before, p_new_role),
    jsonb_build_object('role', v_before), jsonb_build_object('role', p_new_role),
    null, p_profile_id);

  perform app.raise_owner_alert('role_change',
    format('%s changed %s from %s to %s',
      (select coalesce(full_name, email) from public.profile where id = auth.uid()),
      v_after.email, v_before, p_new_role),
    v_audit, p_profile_id, 'urgent');

  return v_after;
end;
$$;

create or replace function public.set_account_scope(
  p_profile_id uuid,
  p_kind public.scope_kind,
  p_case_file_ids uuid[] default '{}',
  p_placement_ids uuid[] default '{}'
)
returns public.account_scope
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_scope public.account_scope;
  v_id uuid;
  v_before jsonb;
begin
  perform app.require('accounts.scope_change');
  perform app.require_target(p_profile_id, 'change its scope');

  select jsonb_build_object(
    'kind', (select kind from public.account_scope where profile_id = p_profile_id),
    'clients', (select coalesce(jsonb_agg(case_file_id), '[]'::jsonb) from public.account_scope_client where profile_id = p_profile_id),
    'placements', (select coalesce(jsonb_agg(placement_id), '[]'::jsonb) from public.account_scope_placement where profile_id = p_profile_id)
  ) into v_before;

  insert into public.account_scope (profile_id, kind, set_by)
  values (p_profile_id, p_kind, auth.uid())
  on conflict (profile_id) do update set kind = excluded.kind, set_by = excluded.set_by, updated_at = now()
  returning * into v_scope;

  delete from public.account_scope_client where profile_id = p_profile_id;
  delete from public.account_scope_placement where profile_id = p_profile_id;

  if p_kind = 'clients' then
    foreach v_id in array coalesce(p_case_file_ids, '{}') loop
      insert into public.account_scope_client (profile_id, case_file_id, added_by)
      values (p_profile_id, v_id, auth.uid()) on conflict do nothing;
    end loop;
  elsif p_kind = 'placements' then
    foreach v_id in array coalesce(p_placement_ids, '{}') loop
      insert into public.account_scope_placement (profile_id, placement_id, added_by)
      values (p_profile_id, v_id, auth.uid()) on conflict do nothing;
    end loop;
  end if;

  perform app.audit('account.scope_changed', 'profile', p_profile_id::text,
    format('Scope set to %s', p_kind), v_before,
    jsonb_build_object('kind', p_kind, 'clients', to_jsonb(p_case_file_ids), 'placements', to_jsonb(p_placement_ids)),
    null, p_profile_id);

  return v_scope;
end;
$$;

create or replace function public.set_permission_override(
  p_profile_id uuid,
  p_permission_key text,
  p_effect public.permission_effect,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns public.account_permission
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.account_permission;
begin
  perform app.require('accounts.override_change');
  perform app.require_target(p_profile_id, 'change its permissions');
  perform app.require_step_up('change a permission');

  -- Nobody grants a permission they do not hold themselves.
  if p_effect = 'grant' and not app.actor_can(p_permission_key) then
    raise exception 'cannot_grant_what_you_lack: you do not hold % yourself, so you cannot grant it', p_permission_key
      using errcode = '42501';
  end if;

  insert into public.account_permission (profile_id, permission_key, effect, reason, expires_at, created_by)
  values (p_profile_id, p_permission_key, p_effect, nullif(btrim(coalesce(p_reason, '')), ''), p_expires_at, auth.uid())
  on conflict (profile_id, permission_key) do update
    set effect = excluded.effect, reason = excluded.reason,
        expires_at = excluded.expires_at, created_by = excluded.created_by, created_at = now()
  returning * into v_row;

  perform app.audit('account.override_set', 'profile', p_profile_id::text,
    format('%s %s on this account', initcap(p_effect::text), p_permission_key),
    null, jsonb_build_object('permission', p_permission_key, 'effect', p_effect, 'reason', p_reason),
    null, p_profile_id);

  return v_row;
end;
$$;

create or replace function public.clear_permission_override(p_profile_id uuid, p_permission_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform app.require('accounts.override_change');
  perform app.require_target(p_profile_id, 'change its permissions');

  delete from public.account_permission
  where profile_id = p_profile_id and permission_key = p_permission_key;

  perform app.audit('account.override_cleared', 'profile', p_profile_id::text,
    format('Cleared the override on %s, back to the role default', p_permission_key),
    null, null, null, p_profile_id);
end;
$$;

create or replace function public.require_password_reset(p_profile_id uuid)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
begin
  perform app.require('accounts.reset_credentials');
  perform app.require_target(p_profile_id, 'force a password reset on it');
  perform app.require_step_up('force a password reset');

  update public.profile set must_change_password = true where id = p_profile_id returning * into v_after;
  delete from auth.sessions where user_id = p_profile_id;

  perform app.audit('account.password_reset_required', 'profile', p_profile_id::text,
    format('%s must set a new password at next sign in', v_after.email), null, null, null, p_profile_id);

  return v_after;
end;
$$;

-- Removes the enrolled factor so the account has to set one up again. Its own
-- audit line, because losing a second factor is a security event.
create or replace function public.reset_second_factor(p_profile_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform app.require('accounts.reset_credentials');
  perform app.require_target(p_profile_id, 'reset its second factor');
  perform app.require_step_up('reset a second factor');

  select email into v_email from public.profile where id = p_profile_id;

  delete from auth.mfa_factors where user_id = p_profile_id;
  delete from auth.sessions where user_id = p_profile_id;

  perform app.audit('account.mfa_reset', 'profile', p_profile_id::text,
    format('Reset the second factor for %s. They must enrol again at next sign in.', v_email),
    null, null, null, p_profile_id);
end;
$$;

create or replace function public.set_mfa_requirement(p_profile_id uuid, p_required boolean)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
begin
  perform app.require('accounts.reset_credentials');
  perform app.require_target(p_profile_id, 'change its second factor requirement');

  update public.profile set mfa_required = p_required where id = p_profile_id returning * into v_after;

  perform app.audit('account.mfa_requirement_set', 'profile', p_profile_id::text,
    format('Second factor %s for %s',
      case when p_required then 'required' else 'made optional' end, v_after.email),
    null, null, null, p_profile_id);

  return v_after;
end;
$$;

-- The per-account kill switch.
create or replace function public.revoke_account_sessions(p_profile_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform app.require('accounts.revoke_sessions');
  perform app.require_target(p_profile_id, 'revoke its sessions');

  delete from auth.sessions where user_id = p_profile_id;
  get diagnostics v_count = row_count;

  perform app.audit('account.sessions_revoked', 'profile', p_profile_id::text,
    format('Ended %s active session(s)', v_count), null, null, null, p_profile_id);

  return v_count;
end;
$$;

-- auth.sessions carries the live sessions with their IP and user agent; login_event
-- carries what we resolved from the edge at sign in.
create or replace function public.account_sessions(p_profile_id uuid)
returns table (
  session_id uuid,
  started_at timestamptz,
  last_activity timestamptz,
  aal text,
  ip inet,
  user_agent text,
  country text,
  city text,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at::timestamptz, s.updated_at),
    s.aal::text,
    s.ip,
    s.user_agent,
    le.country,
    le.city,
    s.id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', '')
  from auth.sessions s
  left join lateral (
    select country, city from public.login_event e
    where e.session_id = s.id order by e.at desc limit 1
  ) le on true
  where s.user_id = p_profile_id
    and (p_profile_id = auth.uid() or app.actor_can('accounts.view'))
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at) desc;
$$;

create or replace function public.revoke_one_session(p_profile_id uuid, p_session_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_profile_id <> auth.uid() then
    perform app.require('accounts.revoke_sessions');
    perform app.require_target(p_profile_id, 'end one of its sessions');
  end if;

  delete from auth.sessions where id = p_session_id and user_id = p_profile_id;

  perform app.audit('account.session_ended', 'auth_session', p_session_id::text,
    'Ended a single session', null, null, null, p_profile_id);
end;
$$;

create or replace function public.set_sign_in_restrictions(
  p_profile_id uuid,
  p_ip_allowlist cidr[] default null,
  p_restrict_to_shift boolean default null,
  p_shift_override boolean default null,
  p_session_timeout_minutes integer default null
)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_after public.profile;
begin
  perform app.require('accounts.scope_change');
  perform app.require_target(p_profile_id, 'change its sign in restrictions');

  update public.profile
     set ip_allowlist = coalesce(p_ip_allowlist, ip_allowlist),
         restrict_to_shift = coalesce(p_restrict_to_shift, restrict_to_shift),
         shift_override = coalesce(p_shift_override, shift_override),
         session_timeout_minutes = coalesce(p_session_timeout_minutes, session_timeout_minutes)
   where id = p_profile_id
  returning * into v_after;

  perform app.audit('account.restrictions_set', 'profile', p_profile_id::text,
    'Changed sign in restrictions', null,
    jsonb_build_object(
      'ip_allowlist', to_jsonb(v_after.ip_allowlist),
      'restrict_to_shift', v_after.restrict_to_shift,
      'shift_override', v_after.shift_override,
      'session_timeout_minutes', v_after.session_timeout_minutes
    ), null, p_profile_id);

  return v_after;
end;
$$;
