-- Local stand-in for the parts of a Supabase project the migrations depend on.
-- Enough to run the real migration chain and exercise RLS as anon/authenticated.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then create role supabase_admin nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
  -- PostgREST connects as this one. The password is local-only and matches
  -- local/postgrest.conf.
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login password 'authpass'; end if;
  if not exists (select 1 from pg_roles where rolname = 'dashboard_user') then create role dashboard_user nologin noinherit; end if;
end
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase projects ship these default privileges, which is why the migrations
-- only ever REVOKE from anon and never GRANT to authenticated. Without them here
-- RLS would appear to work simply because nothing had any grant at all.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default extensions.gen_random_uuid(),
  email text,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth.sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  refreshed_at timestamp,
  not_after timestamptz,
  factor_id uuid,
  aal text,
  ip inet,
  user_agent text,
  tag text
);

create table if not exists auth.mfa_factors (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friendly_name text,
  factor_type text not null default 'totp',
  status text not null default 'unverified',
  created_at timestamptz not null default now()
);

-- The real auth.uid() reads the verified JWT off the request. Locally the two
-- GUCs PostgREST would have set are settable by hand, so a test can act as any
-- user with `set local request.jwt.claim.sub`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;

-- Supabase ships this event-trigger function in every project. The migrations
-- only ever revoke grants on it, but the revoke needs it to exist.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
as $$
begin
  return;
end;
$$;

grant execute on function public.rls_auto_enable() to anon, authenticated;

-- Supabase Vault: id-addressed secrets with a decrypting view.
create schema if not exists vault;

create table if not exists vault.secrets (
  id uuid primary key default extensions.gen_random_uuid(),
  name text,
  description text default '',
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, created_at, updated_at
  from vault.secrets;

create or replace function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
returns uuid
language sql
as $$
  insert into vault.secrets (secret, name, description)
  values (new_secret, new_name, coalesce(new_description, ''))
  returning id;
$$;

create or replace function vault.update_secret(
  secret_id uuid,
  new_secret text default null,
  new_name text default null,
  new_description text default null
)
returns void
language sql
as $$
  update vault.secrets
     set secret = coalesce(new_secret, secret),
         name = coalesce(new_name, name),
         description = coalesce(new_description, description),
         updated_at = now()
   where id = secret_id;
$$;
