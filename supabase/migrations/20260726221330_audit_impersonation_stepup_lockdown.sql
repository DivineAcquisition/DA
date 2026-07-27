-- ---------------------------------------------------------------------------
-- The audit log
--
-- Rule 4: one append-only log across every surface. No role can alter it,
-- including Owner, which is the only thing that makes it worth anything in a
-- dispute.
-- ---------------------------------------------------------------------------

create table public.audit_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- Rule 5: during impersonation the actor is the real admin, never the target.
  actor_profile_id uuid references public.profile (id) on delete set null,
  actor_email text,
  actor_role public.user_role,
  acting_as_profile_id uuid references public.profile (id) on delete set null,
  impersonation_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  case_file_id uuid references public.client_case_file (id) on delete set null,
  summary text,
  before_value jsonb,
  after_value jsonb,
  ip inet,
  user_agent text,
  surface text
);

comment on table public.audit_event is
  'Rule 4: append only. The forbid triggers below refuse UPDATE and DELETE for every role, and the grants withhold them as well, so an attempt fails twice.';

create index audit_event_at_idx on public.audit_event (at desc);
create index audit_event_actor_idx on public.audit_event (actor_profile_id, at desc);
create index audit_event_target_idx on public.audit_event (acting_as_profile_id, at desc);
create index audit_event_entity_idx on public.audit_event (entity_type, entity_id);
create index audit_event_case_file_idx on public.audit_event (case_file_id, at desc);
create index audit_event_action_idx on public.audit_event (action, at desc);

create or replace function app.forbid_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_is_append_only: the audit log cannot be edited or deleted, by any role. This is what makes it answer a dispute.'
    using errcode = '23514';
end;
$$;

create trigger audit_event_no_update before update on public.audit_event
  for each row execute function app.forbid_audit_change();
create trigger audit_event_no_delete before delete on public.audit_event
  for each row execute function app.forbid_audit_change();
create trigger audit_event_no_truncate before truncate on public.audit_event
  for each statement execute function app.forbid_audit_change();

-- Events that reach the Owner in real time rather than waiting to be found.
create table public.owner_alert (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null,
  severity public.notification_severity not null default 'important',
  summary text not null,
  audit_event_id bigint references public.audit_event (id),
  subject_profile_id uuid references public.profile (id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profile (id)
);

create index owner_alert_open_idx on public.owner_alert (at desc) where acknowledged_at is null;

-- ---------------------------------------------------------------------------
-- Sign in history
--
-- auth.sessions carries the live session, its IP and its user agent, but it says
-- nothing once a session ends and nothing about a failed attempt. This is the
-- record that answers "was this account being guessed at".
-- ---------------------------------------------------------------------------

create table public.login_event (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  profile_id uuid references public.profile (id) on delete set null,
  email text not null,
  outcome text not null,
  detail text,
  ip inet,
  user_agent text,
  -- Resolved from the edge headers where the platform provides them, rather than
  -- from a geolocation lookup at display time, so the history keeps what was true
  -- at the time.
  country text,
  city text,
  session_id uuid,
  surface text
);

create index login_event_profile_idx on public.login_event (profile_id, at desc);
create index login_event_email_idx on public.login_event (lower(email), at desc);

-- Which devices an account has signed in from before, so an Owner signing in from
-- somewhere new can be told about it.
create table public.known_device (
  profile_id uuid not null references public.profile (id) on delete cascade,
  fingerprint text not null,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (profile_id, fingerprint)
);

-- ---------------------------------------------------------------------------
-- Step-up authentication
--
-- Certain actions require re-entering credentials inside a live session. The
-- server action verifies the password against the auth server on a throwaway
-- client, so the caller's own session and its AAL are left alone, then records the
-- result here.
-- ---------------------------------------------------------------------------

create table public.step_up_verification (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  purpose text not null,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  ip inet
);

create index step_up_live_idx on public.step_up_verification (profile_id, purpose, expires_at desc);

-- ---------------------------------------------------------------------------
-- Impersonation
--
-- The actor keeps their own session. This row is what makes the application
-- resolve reads as the target while every write is attributed to the real admin,
-- which is the only arrangement where the audit log stays honest.
-- ---------------------------------------------------------------------------

create table public.impersonation (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profile (id) on delete cascade,
  target_profile_id uuid not null references public.profile (id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text,
  step_up_id uuid references public.step_up_verification (id),
  notified_target_at timestamptz,
  constraint impersonation_not_self check (actor_profile_id <> target_profile_id)
);

-- One live impersonation per actor, so "who am I acting as" has one answer.
create unique index impersonation_one_live_per_actor
  on public.impersonation (actor_profile_id) where ended_at is null;

create index impersonation_target_idx on public.impersonation (target_profile_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Break glass
-- ---------------------------------------------------------------------------

create table public.lockdown (
  id uuid primary key default gen_random_uuid(),
  engaged_at timestamptz not null default now(),
  engaged_by uuid not null references public.profile (id),
  reason text not null,
  released_at timestamptz,
  released_by uuid references public.profile (id)
);

create unique index lockdown_one_live on public.lockdown ((released_at is null)) where released_at is null;

-- ---------------------------------------------------------------------------
-- Required acknowledgements
-- ---------------------------------------------------------------------------

create table public.account_notice (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  body text not null,
  severity public.notification_severity not null default 'important',
  -- A blocking notice stops the account working until they confirm they read it.
  blocking boolean not null default true,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  cleared_at timestamptz,
  cleared_by uuid references public.profile (id)
);

create index account_notice_open_idx on public.account_notice (profile_id)
  where acknowledged_at is null and cleared_at is null;

-- ---------------------------------------------------------------------------
-- Contractor tasks
--
-- A Contractor is scoped to specific clients and specific tasks. This is the task
-- half of that, and it is the only client-attached thing they read.
-- ---------------------------------------------------------------------------

create table public.contractor_task (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  title text not null,
  spec text,
  due_on date,
  completed_at timestamptz,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index contractor_task_profile_idx on public.contractor_task (profile_id) where completed_at is null;
