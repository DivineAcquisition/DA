-- `reason` is both an output column of this function and a column on
-- account_permission, and plpgsql resolves the variable first. Qualifying the
-- table reference fixes it; naming the outputs distinctly keeps it fixed.
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

  -- 4. Impersonation blocks, which no permission overrides.
  if v_permission.blocked_during_impersonation and app.is_impersonating() then
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
