-- ---------------------------------------------------------------------------
-- Sign in
--
-- GoTrue is still the authenticator: this function decides whether the attempt is
-- allowed to proceed and keeps the record of it, then the server action exchanges
-- the same password for a session. The password is verified here as well, because
-- otherwise the lockout counter and the blocked-state pages could be driven from
-- outside by anyone who knew an email address.
--
-- The message never reveals whether the email exists, and the account state is only
-- disclosed after the password verifies, so neither is an oracle.
-- ---------------------------------------------------------------------------

create or replace function app.password_matches(p_profile_id uuid, p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select u.encrypted_password is not null
     and u.encrypted_password = extensions.crypt(p_password, u.encrypted_password)
  from auth.users u where u.id = p_profile_id;
$$;

revoke all on function app.password_matches(uuid, text) from public;

-- Whether now falls inside the account's shift window, for the accounts restricted
-- to it. Read from the live placement rather than stored twice, and the shift is
-- text like '09:00' so it needs casting. An overnight window wraps midnight.
create or replace function app.within_shift_window(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_or(
    case
      when pl.shift_start::time <= pl.shift_end::time then
        local_now.t between pl.shift_start::time and pl.shift_end::time
      else
        local_now.t >= pl.shift_start::time or local_now.t <= pl.shift_end::time
    end
  ), false)
  from public.profile p
  join public.operator o on o.profile_id = p.id
  join public.placement pl on pl.operator_id = o.id and pl.status = 'active'
  cross join lateral (
    select (now() at time zone coalesce(pl.time_zone, p.time_zone, 'UTC'))::time as t
  ) local_now
  where p.id = p_profile_id;
$$;

create or replace function public.attempt_sign_in(
  p_email text,
  p_password text,
  p_ip inet default null,
  p_user_agent text default null,
  p_country text default null,
  p_city text default null,
  p_surface text default null
)
returns table (ok boolean, code text, message text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profile;
  v_state public.account_state;
  v_attempts integer;
  v_fingerprint text;
  v_known boolean;
  -- One message for every failure that is not about the account's own state.
  c_generic constant text := 'Those details do not match an account.';
begin
  select * into v_profile from public.profile
  where lower(email) = lower(btrim(coalesce(p_email, '')));

  if v_profile.id is null then
    insert into public.login_event (email, outcome, ip, user_agent, country, city, surface)
    values (lower(btrim(coalesce(p_email, ''))), 'unknown_email', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'invalid', c_generic;
    return;
  end if;

  -- The password first, so the account state is not disclosed to someone who does
  -- not already have the password.
  if not app.password_matches(v_profile.id, coalesce(p_password, '')) then
    update public.profile
       set failed_attempts = failed_attempts + 1
     where id = v_profile.id
    returning failed_attempts into v_attempts;

    insert into public.login_event (profile_id, email, outcome, detail, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'wrong_password',
            format('attempt %s', v_attempts), p_ip, p_user_agent, p_country, p_city, p_surface);

    -- Repeated failures lock the account and tell the Owner.
    if v_attempts >= 5 and (v_profile.locked_until is null or v_profile.locked_until < now()) then
      update public.profile
         set locked_until = now() + interval '30 minutes',
             locked_reason = format('%s failed sign in attempts', v_attempts)
       where id = v_profile.id;

      insert into public.owner_alert (kind, summary, subject_profile_id, severity)
      values ('account_locked',
              format('%s was locked after %s failed sign in attempts from %s',
                     v_profile.email, v_attempts, coalesce(host(p_ip), 'an unknown address')),
              v_profile.id, 'urgent');
    end if;

    return query select false, 'invalid', c_generic;
    return;
  end if;

  -- The password is right, so the person is entitled to know why they are still
  -- being refused. Each of these gets its own page rather than failing silently at
  -- the login screen.
  v_state := app.effective_state(v_profile.id);

  if v_state = 'locked' then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'locked', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'locked',
      format('This account is locked until %s after repeated failed sign in attempts. An Owner can unlock it sooner.',
             to_char(v_profile.locked_until, 'HH24:MI'));
    return;
  end if;

  if v_state = 'suspended' then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'suspended', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'suspended',
      coalesce(v_profile.suspended_reason, 'This account is suspended.');
    return;
  end if;

  if v_state = 'expired' then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'expired', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'expired',
      format('This account expired on %s. Ask the person who set it up to extend it.', v_profile.expires_on);
    return;
  end if;

  if v_state = 'archived' then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'archived', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'archived', 'This account has been closed.';
    return;
  end if;

  if v_state = 'pending' then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'pending', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'pending',
      'This account has not finished accepting its invitation. Use the invitation link you were sent.';
    return;
  end if;

  -- Sign in restrictions. `<<=` rather than `<<`, so a single-address /32 entry in
  -- the allowlist matches itself.
  if v_profile.ip_allowlist is not null and array_length(v_profile.ip_allowlist, 1) > 0 then
    if p_ip is null or not exists (
      select 1 from unnest(v_profile.ip_allowlist) as allowed where p_ip <<= allowed
    ) then
      insert into public.login_event (profile_id, email, outcome, detail, ip, user_agent, country, city, surface)
      values (v_profile.id, v_profile.email, 'ip_blocked', host(p_ip), p_ip, p_user_agent, p_country, p_city, p_surface);
      return query select false, 'ip_blocked',
        'This account can only sign in from an approved network.';
      return;
    end if;
  end if;

  if v_profile.restrict_to_shift and not v_profile.shift_override
     and not app.within_shift_window(v_profile.id) then
    insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
    values (v_profile.id, v_profile.email, 'outside_shift', p_ip, p_user_agent, p_country, p_city, p_surface);
    return query select false, 'outside_shift',
      'This account can only sign in during its shift window. An Owner can lift that.';
    return;
  end if;

  -- Allowed.
  v_fingerprint := encode(extensions.digest(coalesce(p_user_agent, '') || '|' || coalesce(p_country, ''), 'sha256'), 'hex');
  select true into v_known from public.known_device
  where profile_id = v_profile.id and fingerprint = v_fingerprint;

  insert into public.known_device (profile_id, fingerprint, label)
  values (v_profile.id, v_fingerprint, coalesce(nullif(p_country, ''), 'unknown location'))
  on conflict (profile_id, fingerprint) do update set last_seen_at = now();

  update public.profile
     set failed_attempts = 0, locked_until = null, locked_reason = null, last_sign_in_at = now()
   where id = v_profile.id;

  insert into public.login_event (profile_id, email, outcome, ip, user_agent, country, city, surface)
  values (v_profile.id, v_profile.email, 'success', p_ip, p_user_agent, p_country, p_city, p_surface);

  -- An Owner signing in from somewhere new is told about it through every channel.
  if v_profile.role = 'owner' and coalesce(v_known, false) = false then
    insert into public.owner_alert (kind, summary, subject_profile_id, severity)
    values ('owner_new_device',
            format('Owner %s signed in from a new device or location: %s, %s',
                   v_profile.email,
                   coalesce(nullif(p_city, ''), 'unknown city'),
                   coalesce(nullif(p_country, ''), 'unknown country')),
            v_profile.id, 'urgent');
  end if;

  return query select true, 'ok', null::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Step-up
--
-- The password is checked here rather than trusted from the caller, so a step-up
-- record cannot be minted by calling the API directly. Where the role requires a
-- second factor, the live session must already carry it.
-- ---------------------------------------------------------------------------

create or replace function public.verify_step_up(p_password text, p_purpose text)
returns table (ok boolean, message text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile public.profile;
  v_aal text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', 'aal1');
begin
  if auth.uid() is null then
    return query select false, 'Sign in first.';
    return;
  end if;

  select * into v_profile from public.profile where id = auth.uid();

  if not app.password_matches(auth.uid(), coalesce(p_password, '')) then
    insert into public.login_event (profile_id, email, outcome, detail, surface)
    values (auth.uid(), v_profile.email, 'step_up_failed', p_purpose, 'ad');
    return query select false, 'That password does not match.';
    return;
  end if;

  if app.mfa_is_required(v_profile.role, v_profile.mfa_required) and v_aal <> 'aal2' then
    return query select false,
      'This role needs its second factor on the session before a sensitive action. Sign in again and complete the challenge.';
    return;
  end if;

  insert into public.step_up_verification (profile_id, purpose, expires_at)
  values (auth.uid(), p_purpose, now() + interval '5 minutes');

  insert into public.login_event (profile_id, email, outcome, detail, surface)
  values (auth.uid(), v_profile.email, 'step_up', p_purpose, 'ad');

  return query select true, null::text;
end;
$$;

-- What the workspace asks before showing a confirmation dialogue.
create or replace function public.step_up_needed(p_purpose text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.step_up_verification
    where profile_id = auth.uid() and purpose = p_purpose
      and consumed_at is null and expires_at > now()
  );
$$;

-- A reset revokes every other session, so a stolen session does not outlive the
-- password it was created with.
create or replace function public.complete_password_reset()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current uuid := (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id')::uuid;
begin
  if auth.uid() is null then
    raise exception 'no_session: sign in with the reset link first' using errcode = '42501';
  end if;

  update public.profile set must_change_password = false where id = auth.uid();

  delete from auth.sessions where user_id = auth.uid() and id is distinct from v_current;

  perform app.audit('account.password_reset', 'profile', auth.uid()::text,
    'Set a new password. Every other session was ended.');
end;
$$;

-- Anonymous callers need the sign in attempt and the invitation preview, and
-- nothing else.
revoke all on function public.attempt_sign_in(text, text, inet, text, text, text, text) from public;
grant execute on function public.attempt_sign_in(text, text, inet, text, text, text, text) to anon, authenticated;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
revoke all on function public.verify_step_up(text, text) from public;
grant execute on function public.verify_step_up(text, text) to authenticated;
revoke all on function public.step_up_needed(text) from public;
grant execute on function public.step_up_needed(text) to authenticated;
revoke all on function public.complete_password_reset() from public;
grant execute on function public.complete_password_reset() to authenticated;
