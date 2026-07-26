create type public.document_type as enum (
  'audit_findings',
  'install_completion',
  'monthly_performance',
  'quarterly_review',
  'proposal_scope',
  'case_study'
);

-- Four states, and the transitions run one way only.
create type public.document_state as enum ('draft', 'in_review', 'published', 'archived');

-- `fixed` copy comes from the template, `narrative` is admin-written because the
-- reading of the numbers is DA's judgment, and everything else resolves from the
-- tracked record at generation time.
create type public.section_kind as enum (
  'fixed',
  'narrative',
  'bound_metrics',
  'bound_table',
  'milestones',
  'evidence',
  'effort',
  'scope'
);

create type public.anonymisation_kind as enum ('client_name', 'person', 'location', 'brand', 'other');

-- ---------------------------------------------------------------------------
-- Templates, versioned
-- ---------------------------------------------------------------------------

create table public.document_template (
  id uuid primary key default gen_random_uuid(),
  type public.document_type not null,
  version integer not null,
  name text not null,
  producer_line text not null default 'Prepared by Divine Acquisition',
  is_current boolean not null default true,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (type, version)
);

comment on table public.document_template is
  'Rule 8: templates are versioned and a document keeps its own copy of the sections it was generated from, so a template change can never alter a document already produced.';

create unique index document_template_one_current on public.document_template (type) where is_current;

create table public.document_template_section (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_template (id) on delete cascade,
  key text not null,
  title text not null,
  kind public.section_kind not null,
  sort_order integer not null,
  -- Fixed copy, or the prompt shown to the admin for a narrative section.
  body text,
  -- Which resolver output this section reads, for bound kinds.
  bound_source text,
  required boolean not null default true,
  -- Sections that only appear for a given vertical, matching the case file
  -- configuration: a med spa monthly and a home services monthly share a core.
  vertical text,
  created_at timestamptz not null default now(),
  unique (template_id, key)
);

create index document_template_section_order_idx on public.document_template_section (template_id, sort_order);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------

create table public.document (
  id uuid primary key default gen_random_uuid(),
  -- An audit findings report is produced before any engagement exists. In this
  -- model the case file is created at the audit, so a prospect is a case file in
  -- `audit` status: no install, no placement, no invoices.
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  type public.document_type not null,
  template_id uuid not null references public.document_template (id),
  template_version integer not null,
  title text not null,
  period_start date,
  period_end date,
  state public.document_state not null default 'draft',
  version integer not null default 1,
  supersedes_id uuid references public.document (id),
  superseded_by_id uuid references public.document (id),
  -- Rule 4: a correction publishes a new version carrying a visible note.
  correction_note text,
  -- Rule 3: filled at publication and never touched again. This is the document
  -- exactly as the client received it, numbers included.
  frozen_payload jsonb,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profile (id),
  published_at timestamptz,
  published_by uuid references public.profile (id),
  archived_at timestamptz,
  -- Case study drafts are internal and never reach a client account.
  is_case_study boolean not null default false,
  anonymised_descriptor text,
  anonymisation_confirmed_at timestamptz,
  anonymisation_confirmed_by uuid references public.profile (id),
  -- DA chooses whether a monthly report discloses the work behind the numbers.
  include_effort boolean not null default false,
  share_link_id uuid references public.client_dashboard_link (id) on delete set null,
  drive_file_id text,
  drive_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.document.frozen_payload is
  'Rule 3: a published report is a statement of what was true on a date, not a live view.';

create index document_case_file_idx on public.document (case_file_id, generated_at desc);
create index document_state_idx on public.document (state);
create index document_published_idx on public.document (case_file_id, published_at desc) where state = 'published';

create trigger document_touch before update on public.document
  for each row execute function app.touch_updated_at();

-- The document's own copy of its sections. Narrative bodies are admin-written;
-- bound_data is only ever written by the resolver.
create table public.document_section (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document (id) on delete cascade,
  key text not null,
  title text not null,
  kind public.section_kind not null,
  sort_order integer not null,
  body text,
  bound_data jsonb,
  -- Rule 2: true when any bound field in this section had no data, so the
  -- rendered document shows an explicit gap rather than a zero.
  has_gap boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, key)
);

create index document_section_order_idx on public.document_section (document_id, sort_order);

create trigger document_section_touch before update on public.document_section
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Delivery, opens, anonymisation
-- ---------------------------------------------------------------------------

create table public.document_delivery (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document (id) on delete cascade,
  channel text not null,
  status text not null,
  detail text,
  delivered_at timestamptz not null default now()
);

create index document_delivery_document_idx on public.document_delivery (document_id);

-- A client who has not opened three monthly reports is telling you something
-- before they cancel.
create table public.document_open (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document (id) on delete cascade,
  opened_at timestamptz not null default now(),
  opened_by uuid references public.profile (id) on delete set null,
  via text not null default 'account',
  user_agent text
);

create index document_open_document_idx on public.document_open (document_id, opened_at desc);

-- Rule 9: anonymisation is assisted, not automatic. Automatic anonymisation that
-- misses one reference is worse than none, because it creates false confidence.
create table public.anonymisation_flag (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document (id) on delete cascade,
  section_key text not null,
  kind public.anonymisation_kind not null,
  snippet text not null,
  suggestion text,
  confirmed_at timestamptz,
  confirmed_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index anonymisation_flag_document_idx on public.anonymisation_flag (document_id);

-- ---------------------------------------------------------------------------
-- Rule 10, and the freeze
-- ---------------------------------------------------------------------------

-- No em dashes in generated prose. A DA brand rule, so it is enforced rather
-- than remembered.
create or replace function app.reject_em_dash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is not null and position(chr(8212) in new.body) > 0 then
    raise exception 'em_dash_not_permitted: DA prose uses commas, colons, parentheses or full stops instead of em dashes. Found one in the "%" section.', new.title
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger document_section_no_em_dash
  before insert or update on public.document_section
  for each row execute function app.reject_em_dash();

create trigger document_template_section_no_em_dash
  before insert or update on public.document_template_section
  for each row execute function app.reject_em_dash();

-- Rules 3 and 4. A published document freezes; only delivery references and the
-- supersede pointer may still be written.
create or replace function app.guard_document_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.state in ('published', 'archived') then
    if to_jsonb(new)
         - 'drive_file_id' - 'drive_url' - 'share_link_id'
         - 'superseded_by_id' - 'state' - 'archived_at' - 'updated_at'
       <> to_jsonb(old)
         - 'drive_file_id' - 'drive_url' - 'share_link_id'
         - 'superseded_by_id' - 'state' - 'archived_at' - 'updated_at' then
      raise exception 'document_is_published: this document was published on % and is frozen, numbers included. Correct it by publishing a new version with a note.', old.published_at::date
        using errcode = '23514';
    end if;

    -- Published may only move to archived. Nothing returns to draft.
    if new.state <> old.state and not (old.state = 'published' and new.state = 'archived') then
      raise exception 'document_state_is_final: a % document cannot move to %', old.state, new.state
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger document_guard_update before update on public.document
  for each row execute function app.guard_document_update();

create trigger document_guard_delete before delete on public.document
  for each row execute function app.forbid_mutation();

-- Sections of a published document are equally frozen.
create or replace function app.guard_document_section()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_state public.document_state;
  v_document uuid := coalesce(new.document_id, old.document_id);
begin
  select state into v_state from public.document where id = v_document;

  if v_state in ('published', 'archived') then
    raise exception 'document_is_published: the sections of a published document cannot change. Publish a corrected version instead.'
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger document_section_guard
  before insert or update or delete on public.document_section
  for each row execute function app.guard_document_section();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.document_template enable row level security;
alter table public.document_template_section enable row level security;
alter table public.document enable row level security;
alter table public.document_section enable row level security;
alter table public.document_delivery enable row level security;
alter table public.document_open enable row level security;
alter table public.anonymisation_flag enable row level security;

create policy document_template_admin on public.document_template
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy document_template_section_admin on public.document_template_section
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy document_admin on public.document
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy document_section_admin on public.document_section
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy document_delivery_admin on public.document_delivery
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy document_open_admin on public.document_open
  for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy anonymisation_flag_admin on public.anonymisation_flag
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

-- A client sees published documents on their own engagement, and case study
-- drafts never reach them.
create policy document_client_read on public.document
  for select to authenticated
  using (
    app.client_can_read(case_file_id)
    and state = 'published'
    and is_case_study = false
  );

create policy document_section_client_read on public.document_section
  for select to authenticated
  using (exists (
    select 1 from public.document d
    where d.id = document_id
      and app.client_can_read(d.case_file_id)
      and d.state = 'published'
      and d.is_case_study = false
  ));

-- A client may record that they opened a document, and nothing else.
create policy document_open_client_insert on public.document_open
  for insert to authenticated
  with check (exists (
    select 1 from public.document d
    where d.id = document_id and app.client_can_read(d.case_file_id) and d.state = 'published'
  ));

revoke all on all tables in schema public from anon;
