-- ---------------------------------------------------------------------------
-- Impersonation
--
-- The actor keeps their own session and this row redirects what the application
-- resolves as "who am I". That is what lets every write stay attributed to the real
-- admin while every read looks like the target's.
-- ---------------------------------------------------------------------------

create or replace function public.start_impersonation(
  p_target_profile_id uuid,
  p_reason text,
  p_minutes integer default 30
)
returns public.impersonation
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.impersonation;
  v_target public.profile;
  v_step_up uuid;
  v_audit bigint;
begin
  perform app.require('accounts.impersonate');

  select * into v_target from public.profile where id = p_target_profile_id;
  if v_target.id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if p_target_profile_id = auth.uid() then
    raise exception 'cannot_impersonate_self: you are already signed in as yourself' using errcode = '23514';
  end if;

  -- Rule 5: nobody impersonates an Owner, including another Owner. An Owner
  -- account is the one place where "the log says it was them" has to be absolute.
  if v_target.role = 'owner' then
    raise exception 'cannot_impersonate_owner: an Owner account is never impersonated, by anyone'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required: say why you are impersonating. The target is told, and they will read it.'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.impersonation where actor_profile_id = auth.uid() and ended_at is null) then
    raise exception 'already_impersonating: leave the current impersonation session first'
      using errcode = '23514';
  end if;

  v_step_up := app.require_step_up('start an impersonation session');

  insert into public.impersonation (
    actor_profile_id, target_profile_id, reason, expires_at, step_up_id
  ) values (
    auth.uid(), p_target_profile_id, btrim(p_reason),
    now() + make_interval(mins => least(greatest(coalesce(p_minutes, 30), 5), 120)),
    v_step_up
  ) returning * into v_row;

  v_audit := app.audit('impersonation.started', 'profile', p_target_profile_id::text,
    format('Started impersonating %s: %s', v_target.email, btrim(p_reason)),
    null, jsonb_build_object('expires_at', v_row.expires_at, 'reason', btrim(p_reason)),
    null, p_target_profile_id);

  perform app.raise_owner_alert('impersonation_started',
    format('%s started impersonating %s',
      (select coalesce(full_name, email) from public.profile where id = auth.uid()), v_target.email),
    v_audit, p_target_profile_id, 'urgent');

  -- The target is told, after the fact. Delivered through their configured
  -- channels by the notification engine; the notice is what they see in the app.
  insert into public.account_notice (profile_id, body, severity, blocking, created_by)
  values (
    p_target_profile_id,
    format('%s viewed the application as you on %s, to %s.',
      (select coalesce(full_name, email) from public.profile where id = auth.uid()),
      to_char(now(), 'FMDD Mon YYYY at HH24:MI'), btrim(p_reason)),
    'important', false, auth.uid()
  );

  update public.impersonation set notified_target_at = now() where id = v_row.id;

  return v_row;
end;
$$;

-- Deliberately not behind app.require(): during impersonation the permission
-- engine evaluates the target, and an Operator has no impersonation permission, so
-- gating this would trap the admin inside the session.
create or replace function public.end_impersonation()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.impersonation;
begin
  update public.impersonation
     set ended_at = now(), ended_reason = 'exited'
   where actor_profile_id = auth.uid() and ended_at is null
  returning * into v_row;

  if v_row.id is null then
    return;
  end if;

  perform app.audit('impersonation.ended', 'profile', v_row.target_profile_id::text,
    format('Left the impersonation session on %s',
      (select email from public.profile where id = v_row.target_profile_id)),
    null, null, null, v_row.target_profile_id);
end;
$$;

-- What the banner reads from, and what the shells use to decide whose surface to
-- render.
create or replace function public.impersonation_context()
returns table (
  impersonation_id uuid,
  actor_profile_id uuid,
  actor_name text,
  target_profile_id uuid,
  target_name text,
  target_role public.user_role,
  reason text,
  started_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id, i.actor_profile_id, coalesce(a.full_name, a.email),
    i.target_profile_id, coalesce(t.full_name, t.email), t.role,
    i.reason, i.started_at, i.expires_at
  from public.impersonation i
  join public.profile a on a.id = i.actor_profile_id
  join public.profile t on t.id = i.target_profile_id
  where i.actor_profile_id = auth.uid() and i.ended_at is null and i.expires_at > now();
$$;

-- ---------------------------------------------------------------------------
-- Break glass
-- ---------------------------------------------------------------------------

create or replace function public.engage_lockdown(p_reason text, p_typed_confirmation text)
returns public.lockdown
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.lockdown;
  v_ended integer;
  v_audit bigint;
begin
  perform app.require('system.lockdown');
  perform app.require_step_up('engage a global lockdown');

  if upper(btrim(coalesce(p_typed_confirmation, ''))) <> 'LOCKDOWN' then
    raise exception 'confirmation_mismatch: type LOCKDOWN to confirm' using errcode = '23514';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required: say what happened' using errcode = '23514';
  end if;
  if exists (select 1 from public.lockdown where released_at is null) then
    raise exception 'already_locked_down: the system is already locked down' using errcode = '23514';
  end if;

  insert into public.lockdown (engaged_by, reason) values (auth.uid(), btrim(p_reason))
  returning * into v_row;

  -- Every session but the acting Owner's own.
  delete from auth.sessions where user_id <> auth.uid();
  get diagnostics v_ended = row_count;

  -- And every impersonation session, including the acting Owner's.
  update public.impersonation set ended_at = now(), ended_reason = 'lockdown' where ended_at is null;

  v_audit := app.audit('system.lockdown_engaged', 'lockdown', v_row.id::text,
    format('Global lockdown engaged, %s session(s) ended: %s', v_ended, btrim(p_reason)));

  perform app.raise_owner_alert('lockdown',
    format('Global lockdown engaged by %s: %s',
      (select email from public.profile where id = auth.uid()), btrim(p_reason)),
    v_audit, null, 'urgent');

  return v_row;
end;
$$;

create or replace function public.release_lockdown()
returns public.lockdown
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.lockdown;
begin
  -- Only the Owner who engaged it, because during a lockdown app.decide() refuses
  -- everyone else anyway and there is no point pretending otherwise.
  update public.lockdown
     set released_at = now(), released_by = auth.uid()
   where released_at is null and engaged_by = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not_yours_to_release: only the Owner who engaged the lockdown can release it'
      using errcode = '42501';
  end if;

  perform app.audit('system.lockdown_released', 'lockdown', v_row.id::text, 'Global lockdown released');

  return v_row;
end;
$$;

create or replace function public.lockdown_status()
returns table (id uuid, engaged_at timestamptz, engaged_by_email text, reason text, is_mine boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.engaged_at, p.email, l.reason, l.engaged_by = auth.uid()
  from public.lockdown l join public.profile p on p.id = l.engaged_by
  where l.released_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Notices and messages
-- ---------------------------------------------------------------------------

create or replace function public.set_account_notice(
  p_profile_id uuid,
  p_body text,
  p_severity public.notification_severity default 'important',
  p_blocking boolean default true
)
returns public.account_notice
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.account_notice;
begin
  perform app.require('accounts.message');
  perform app.require_target(p_profile_id, 'put a notice on it');

  insert into public.account_notice (profile_id, body, severity, blocking, created_by)
  values (p_profile_id, btrim(p_body), p_severity, p_blocking, auth.uid())
  returning * into v_row;

  perform app.audit('account.notice_set', 'account_notice', v_row.id::text,
    case when p_blocking
      then 'Set a notice the account must confirm before continuing to work'
      else 'Sent a notice to the account' end,
    null, jsonb_build_object('blocking', p_blocking, 'severity', p_severity), null, p_profile_id);

  return v_row;
end;
$$;

-- The account confirms they read it. Their own action, so no permission gate: a
-- blocking notice denies everything else until this runs, and gating it would
-- deadlock.
create or replace function public.acknowledge_notice(p_notice_id uuid)
returns public.account_notice
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.account_notice;
begin
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

create or replace function public.clear_account_notice(p_notice_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  perform app.require('accounts.message');

  update public.account_notice
     set cleared_at = now(), cleared_by = auth.uid()
   where id = p_notice_id and cleared_at is null
  returning profile_id into v_profile;

  perform app.audit('account.notice_cleared', 'account_notice', p_notice_id::text,
    'Cleared the notice', null, null, null, v_profile);
end;
$$;
