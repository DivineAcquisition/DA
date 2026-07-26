create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
revoke all on schema app from anon, authenticated;

create type public.user_role as enum ('admin', 'operator');

create type public.engagement_status as enum ('audit', 'installing', 'active', 'paused', 'ended');

create type public.measurement_source as enum ('measured', 'client_estimate');

create type public.snapshot_kind as enum ('baseline', 'progress');

create type public.snapshot_trigger as enum ('automatic', 'manual');

create type public.metric_direction as enum ('up_is_good', 'down_is_good');

create type public.milestone_type as enum ('install_complete', 'operator_placed', 'campaign_launched', 'first_lead', 'first_booking', 'first_reactivation_revenue', 'first_month_over_goal', 'custom');

create type public.evidence_category as enum ('evidence', 'deliverables', 'reports', 'client_provided');

create type public.scope_verdict as enum ('in_scope', 'out_of_scope');

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'declined');

create type public.report_mode as enum ('client_facing', 'internal', 'case_study_draft');

create table public.profile (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile is 'Authorization role per auth user. Roles live here rather than in user_metadata, which is user-editable and therefore unsafe for authorization.';

create index profile_role_idx on public.profile (role);

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

comment on function app.is_admin() is 'True when the caller is an admin. Rule 8: this surface is admin-only, so every policy on it gates on this.';

create or replace function app.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_only: this surface is restricted to Divine Acquisition admins' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile (id, email, full_name)
  values (new.id, new.email, nullif(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%_is_immutable: % rows cannot be % once written. Corrections create a new version.', tg_table_name, tg_table_name, lower(tg_op) using errcode = '23514';
end;
$$;

alter table public.profile enable row level security;

create policy profile_select_self_or_admin on public.profile
  for select to authenticated
  using (id = auth.uid() or app.is_admin());

create policy profile_update_self_name on public.profile
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profile_admin_all on public.profile
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());
