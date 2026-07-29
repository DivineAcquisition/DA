-- Harness-only reconstruction of the document generation subsystem.
--
-- It exists in the live project but was never exported to supabase/migrations,
-- so 20260726221532 (which puts a manager-scope policy on public.document) and
-- open_work_for() cannot replay from a clean database without it. Shapes come
-- from lib/supabase/database.types.ts. This file is NOT a migration; it only
-- lets the local chain reach the end so new migrations can be validated.

create type public.document_state as enum ('draft', 'in_review', 'published', 'archived');

create type public.document_type as enum (
  'audit_findings', 'install_completion', 'monthly_performance',
  'quarterly_review', 'proposal_scope', 'case_study'
);

create type public.anonymisation_kind as enum ('client_name', 'person', 'location', 'brand', 'other');

create table public.document_template (
  id uuid primary key default gen_random_uuid(),
  type public.document_type not null,
  name text not null,
  version integer not null default 1,
  is_current boolean not null default true,
  producer_line text not null,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create table public.document (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  template_id uuid not null references public.document_template (id),
  template_version integer not null,
  type public.document_type not null,
  title text not null,
  state public.document_state not null default 'draft',
  version integer not null default 1,
  supersedes_id uuid references public.document (id),
  superseded_by_id uuid references public.document (id),
  correction_note text,
  period_start date,
  period_end date,
  include_effort boolean not null default false,
  is_case_study boolean not null default false,
  anonymised_descriptor text,
  anonymisation_confirmed_at timestamptz,
  anonymisation_confirmed_by uuid references public.profile (id),
  frozen_payload jsonb,
  drive_file_id text,
  drive_url text,
  share_link_id uuid references public.client_dashboard_link (id),
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profile (id),
  published_at timestamptz,
  published_by uuid references public.profile (id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.anonymisation_flag (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document (id) on delete cascade,
  kind public.anonymisation_kind not null,
  section_key text not null,
  snippet text not null,
  suggestion text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

alter table public.document_template enable row level security;
alter table public.document enable row level security;
alter table public.anonymisation_flag enable row level security;

create policy document_template_admin_only on public.document_template
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy document_admin_only on public.document
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy anonymisation_flag_admin_only on public.anonymisation_flag
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
