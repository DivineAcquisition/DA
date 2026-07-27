-- ---------------------------------------------------------------------------
-- Invitations
--
-- Rule 3: there is no public signup anywhere in the system. Accounts are created
-- by invitation only, and that is enforced at the data layer rather than by the
-- absence of a signup form: a profile created without a matching invitation lands
-- in `pending` with no scope, and app.decide() refuses everything a pending
-- account asks for.
-- ---------------------------------------------------------------------------

create table public.account_invite (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role public.user_role not null,
  -- The scope and expiry the account will be created with, decided at invite time
  -- so nobody lands in the system unscoped.
  scope_kind public.scope_kind not null default 'clients',
  scope_case_file_ids uuid[] not null default '{}',
  expires_on date,
  time_zone text,
  -- Single use. The token is stored hashed, so the log and a database dump do not
  -- hand out working invitations.
  token_hash text not null,
  invited_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_profile_id uuid references public.profile (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profile (id),
  resent_count integer not null default 0,
  last_sent_at timestamptz not null default now()
);

create unique index account_invite_live_email
  on public.account_invite (lower(email))
  where accepted_at is null and cancelled_at is null;

create index account_invite_token_idx on public.account_invite (token_hash);

create or replace function app.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Creating the invitation. Returns the raw token exactly once, for the link.
create or replace function public.invite_account(
  p_email text,
  p_role public.user_role,
  p_full_name text default null,
  p_scope_kind public.scope_kind default 'clients',
  p_scope_case_file_ids uuid[] default '{}',
  p_expires_on date default null,
  p_time_zone text default null,
  p_valid_days integer default 7
)
returns table (invite_id uuid, token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
  v_actor_role public.user_role;
begin
  perform app.require('accounts.invite');

  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_required: an invitation needs an email address' using errcode = '23514';
  end if;

  select role into v_actor_role from public.profile where id = auth.uid();

  -- Only an Owner creates another Owner, and no role invites above its own level.
  if app.rank(p_role) >= app.rank(v_actor_role) and v_actor_role <> 'owner' then
    raise exception 'outranked: a % cannot invite a %', v_actor_role, p_role using errcode = '42501';
  end if;

  -- An expiry date is mandatory for a Contractor. Temporary help that never
  -- expires is just help, and it is how stale access accumulates.
  if p_role = 'contractor' and p_expires_on is null then
    raise exception 'expiry_required: a Contractor account must be given an expiry date at creation'
      using errcode = '23514';
  end if;

  if exists (select 1 from public.profile where lower(email) = lower(p_email) and archived_at is null) then
    raise exception 'already_exists: % already has an account', p_email using errcode = '23505';
  end if;

  insert into public.account_invite (
    email, full_name, role, scope_kind, scope_case_file_ids,
    expires_on, time_zone, token_hash, invited_by, expires_at
  ) values (
    lower(btrim(p_email)), nullif(btrim(coalesce(p_full_name, '')), ''), p_role,
    p_scope_kind, coalesce(p_scope_case_file_ids, '{}'),
    p_expires_on, p_time_zone, app.hash_token(v_token), auth.uid(),
    now() + make_interval(days => greatest(coalesce(p_valid_days, 7), 1))
  ) returning id into v_id;

  perform app.audit(
    'account.invited', 'account_invite', v_id::text,
    format('Invited %s as %s', lower(p_email), p_role),
    null, jsonb_build_object('email', lower(p_email), 'role', p_role, 'scope_kind', p_scope_kind)
  );

  return query select v_id, v_token;
end;
$$;

create or replace function public.resend_invite(p_invite_id uuid)
returns table (invite_id uuid, token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_invite public.account_invite;
begin
  perform app.require('accounts.invite');

  select * into v_invite from public.account_invite where id = p_invite_id;
  if v_invite.id is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'already_accepted: this invitation has been used' using errcode = '23514';
  end if;
  if v_invite.cancelled_at is not null then
    raise exception 'already_cancelled: this invitation was cancelled' using errcode = '23514';
  end if;

  -- A fresh token, so the old link stops working.
  update public.account_invite
     set token_hash = app.hash_token(v_token),
         expires_at = now() + interval '7 days',
         resent_count = resent_count + 1,
         last_sent_at = now()
   where id = p_invite_id;

  perform app.audit('account.invite_resent', 'account_invite', p_invite_id::text,
    format('Resent the invitation to %s', v_invite.email));

  return query select p_invite_id, v_token;
end;
$$;

create or replace function public.cancel_invite(p_invite_id uuid)
returns public.account_invite
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite public.account_invite;
begin
  perform app.require('accounts.invite');

  update public.account_invite
     set cancelled_at = now(), cancelled_by = auth.uid()
   where id = p_invite_id and accepted_at is null and cancelled_at is null
  returning * into v_invite;

  if v_invite.id is null then
    raise exception 'invite_not_cancellable: this invitation has already been used or cancelled'
      using errcode = '23514';
  end if;

  perform app.audit('account.invite_cancelled', 'account_invite', p_invite_id::text,
    format('Cancelled the invitation to %s', v_invite.email));

  return v_invite;
end;
$$;

-- What the acceptance page shows before a password is set. Deliberately callable
-- without a session, and deliberately tells the visitor nothing but the email and
-- the role.
create or replace function public.invite_preview(p_token text)
returns table (email text, full_name text, role public.user_role, expires_at timestamptz, valid boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.account_invite;
begin
  select * into v from public.account_invite where token_hash = app.hash_token(p_token);

  if v.id is null then
    return query select null::text, null::text, null::public.user_role, null::timestamptz, false,
      'This invitation link is not recognised.';
  elsif v.accepted_at is not null then
    return query select v.email, v.full_name, v.role, v.expires_at, false,
      'This invitation has already been used. An invitation works once.';
  elsif v.cancelled_at is not null then
    return query select v.email, v.full_name, v.role, v.expires_at, false,
      'This invitation was cancelled.';
  elsif v.expires_at < now() then
    return query select v.email, v.full_name, v.role, v.expires_at, false,
      'This invitation has expired. Ask for a new one.';
  else
    return query select v.email, v.full_name, v.role, v.expires_at, true, null::text;
  end if;
end;
$$;

-- Called once the new account has authenticated with the password they just set.
-- The invitation decides the role, the scope and the expiry: nothing about an
-- account is chosen by the person signing up, because nobody signs up.
create or replace function public.accept_account_invite(
  p_token text,
  p_full_name text default null,
  p_time_zone text default null
)
returns public.profile
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v public.account_invite;
  v_profile public.profile;
  v_case_file uuid;
begin
  if auth.uid() is null then
    raise exception 'no_session: set your password first, then accept' using errcode = '42501';
  end if;

  select * into v from public.account_invite where token_hash = app.hash_token(p_token);

  if v.id is null or v.cancelled_at is not null then
    raise exception 'invite_invalid: this invitation link is not usable' using errcode = '23514';
  end if;
  if v.accepted_at is not null then
    raise exception 'invite_used: an invitation works once' using errcode = '23514';
  end if;
  if v.expires_at < now() then
    raise exception 'invite_expired: this invitation has expired. Ask for a new one.' using errcode = '23514';
  end if;
  if lower(coalesce((select email from auth.users where id = auth.uid()), '')) <> lower(v.email) then
    raise exception 'invite_email_mismatch: this invitation was issued to a different address'
      using errcode = '42501';
  end if;

  update public.profile
     set role = v.role,
         state = 'active',
         full_name = coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), v.full_name, full_name),
         time_zone = coalesce(nullif(btrim(coalesce(p_time_zone, '')), ''), v.time_zone),
         expires_on = v.expires_on,
         session_timeout_minutes = app.default_session_minutes(v.role),
         invited_by = v.invited_by,
         accepted_at = now()
   where id = auth.uid()
  returning * into v_profile;

  insert into public.account_scope (profile_id, kind, set_by)
  values (auth.uid(), v.scope_kind, v.invited_by)
  on conflict (profile_id) do update set kind = excluded.kind, set_by = excluded.set_by, updated_at = now();

  foreach v_case_file in array v.scope_case_file_ids loop
    insert into public.account_scope_client (profile_id, case_file_id, added_by)
    values (auth.uid(), v_case_file, v.invited_by)
    on conflict do nothing;
  end loop;

  update public.account_invite
     set accepted_at = now(), accepted_profile_id = auth.uid()
   where id = v.id;

  perform app.audit('account.invite_accepted', 'profile', auth.uid()::text,
    format('%s accepted the %s invitation', v.email, v.role));

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rule 3, at the trigger
--
-- The existing trigger created an active operator for any auth user, which is
-- public signup in all but name if email signups are ever switched on. A profile
-- now arrives pending and unscoped, and app.decide() refuses a pending account
-- everything, so an uninvited account can authenticate and still do nothing.
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_user()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite public.account_invite;
begin
  select * into v_invite
  from public.account_invite
  where lower(email) = lower(new.email)
    and accepted_at is null and cancelled_at is null and expires_at > now()
  order by created_at desc
  limit 1;

  insert into public.profile (id, email, full_name, role, state, invited_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', v_invite.full_name),
    coalesce(v_invite.role, 'operator'),
    'pending',
    v_invite.invited_by
  )
  on conflict (id) do nothing;

  if v_invite.id is null then
    -- Worth an Owner's attention: somebody authenticated who was never invited.
    insert into public.owner_alert (kind, summary, subject_profile_id, severity)
    values (
      'uninvited_signup',
      format('%s authenticated without an invitation. The account is pending and can do nothing.', new.email),
      new.id,
      'urgent'
    );
  end if;

  return new;
end;
$$;
