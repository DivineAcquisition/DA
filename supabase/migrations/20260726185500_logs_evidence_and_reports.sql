create table public.milestone (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  occurred_on date not null,
  type public.milestone_type not null,
  title text not null,
  description text,
  auto_generated boolean not null default false,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on table public.milestone is 'Dated events that give the growth numbers a narrative. Plotted on the same timeline as snapshots so a change in the numbers can be seen following a change in the system.';

create index milestone_case_file_idx on public.milestone (case_file_id, occurred_on desc);

create unique index milestone_one_auto_per_type on public.milestone (case_file_id, type) where auto_generated;

create table public.effort_entry (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  performed_on date not null,
  phase text not null,
  description text not null,
  hours numeric(6, 2),
  version integer not null default 1,
  supersedes_id uuid references public.effort_entry (id),
  superseded_by_id uuid references public.effort_entry (id),
  correction_reason text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on table public.effort_entry is 'Rule 2: immutable once saved. A correction inserts a new version and both remain visible.';

create index effort_entry_case_file_idx on public.effort_entry (case_file_id, performed_on desc);
create index effort_entry_current_idx on public.effort_entry (case_file_id) where superseded_by_id is null;

create table public.scope_request (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  requested_on date not null,
  requested_by_name text,
  summary text not null,
  detail text,
  verdict public.scope_verdict not null,
  reason text not null,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on table public.scope_request is 'The paper trail that keeps a productized engagement from quietly becoming custom consulting.';

create index scope_request_case_file_idx on public.scope_request (case_file_id, requested_on desc);

create table public.scope_quote (
  id uuid primary key default gen_random_uuid(),
  scope_request_id uuid not null references public.scope_request (id) on delete cascade,
  proposed_on date not null,
  summary text not null,
  amount numeric(12, 2),
  status public.quote_status not null default 'draft',
  decided_on date,
  decision_note text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger scope_quote_touch
  before update on public.scope_quote
  for each row execute function app.touch_updated_at();

create index scope_quote_request_idx on public.scope_quote (scope_request_id);

create table public.decision (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  decided_on date not null,
  decided_by text not null,
  what_was_decided text not null,
  reasoning text not null,
  against_recommendation boolean not null default false,
  version integer not null default 1,
  supersedes_id uuid references public.decision (id),
  superseded_by_id uuid references public.decision (id),
  correction_reason text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on table public.decision is 'Short by design. It captures the decisions that would matter if the engagement went badly, particularly where the client chose against the recommendation.';
comment on column public.decision.against_recommendation is 'Flags a decision taken against DA advice, which is the subset that matters most in a dispute.';

create index decision_case_file_idx on public.decision (case_file_id, decided_on desc);
create index decision_current_idx on public.decision (case_file_id) where superseded_by_id is null;

create table public.evidence_item (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  category public.evidence_category not null default 'evidence',
  drive_file_id text not null,
  drive_url text,
  filename text not null,
  mime_type text,
  byte_size bigint,
  thumbnail_url text,
  what_it_proves text,
  happened_on date,
  needs_metadata boolean not null generated always as (what_it_proves is null or happened_on is null) stored,
  discovered_by_sync boolean not null default false,
  uploaded_at timestamptz not null default now(),
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_file_id, drive_file_id)
);

comment on table public.evidence_item is 'Rule 5: Drive holds the bytes, this table holds the reference and the metadata.';
comment on column public.evidence_item.needs_metadata is 'Rule 4 in practice: a file found by the Drive sync arrives untagged and is surfaced as awaiting metadata rather than left invisible. Anything uploaded through the app must supply both fields.';

create index evidence_item_case_file_idx on public.evidence_item (case_file_id, happened_on desc nulls last);
create index evidence_item_needs_metadata_idx on public.evidence_item (case_file_id) where needs_metadata;

create trigger evidence_item_touch
  before update on public.evidence_item
  for each row execute function app.touch_updated_at();

create table public.evidence_link (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_item (id) on delete cascade,
  milestone_id uuid references public.milestone (id) on delete cascade,
  snapshot_id uuid references public.snapshot (id) on delete cascade,
  effort_entry_id uuid references public.effort_entry (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint evidence_link_exactly_one_target check (
    (milestone_id is not null)::int + (snapshot_id is not null)::int + (effort_entry_id is not null)::int = 1
  )
);

comment on table public.evidence_link is 'Evidence attaches to a milestone, a snapshot, or an effort entry. Anything with no link stands alone in the vault.';

create unique index evidence_link_milestone_uniq on public.evidence_link (evidence_id, milestone_id) where milestone_id is not null;
create unique index evidence_link_snapshot_uniq on public.evidence_link (evidence_id, snapshot_id) where snapshot_id is not null;
create unique index evidence_link_effort_uniq on public.evidence_link (evidence_id, effort_entry_id) where effort_entry_id is not null;

create table public.evidence_share_link (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence_item (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  shared_with text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on table public.evidence_share_link is 'Rule 6: sharing issues a time-limited link rather than changing the Drive file permissions permanently.';

create index evidence_share_link_evidence_idx on public.evidence_share_link (evidence_id);

create table public.growth_report (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  mode public.report_mode not null,
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  generated_by uuid references public.profile (id),
  payload jsonb not null,
  included_evidence_ids uuid[] not null default '{}',
  drive_file_id text,
  drive_url text
);

comment on table public.growth_report is 'Rule 7: the payload is the report exactly as it was shown, archived at generation time so it never drifts with the underlying data.';

create index growth_report_case_file_idx on public.growth_report (case_file_id, generated_at desc);

create table public.drive_sync_run (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid references public.client_case_file (id) on delete cascade,
  ran_at timestamptz not null default now(),
  discovered_count integer not null default 0,
  status text not null default 'ok',
  detail text
);

create index drive_sync_run_case_file_idx on public.drive_sync_run (case_file_id, ran_at desc);

create trigger effort_entry_immutable
  before delete on public.effort_entry
  for each row execute function app.forbid_mutation();

create trigger decision_immutable
  before delete on public.decision
  for each row execute function app.forbid_mutation();

create trigger growth_report_immutable
  before update or delete on public.growth_report
  for each row execute function app.forbid_mutation();
