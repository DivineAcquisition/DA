-- The Client role activates here. Rule 1: a client account is scoped to exactly
-- one client record, and the schema is what makes that true -- the primary key
-- on profile_id means an account physically cannot hold two engagements.

alter type public.user_role add value 'client';

create type public.client_account_state as enum ('invited', 'active', 'suspended', 'archived', 'closed');

create table public.client_account (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  full_name text,
  job_title text,
  state public.client_account_state not null default 'active',
  -- Several people from one business may hold accounts and see identical data.
  -- Never a shared login.
  is_primary boolean not null default false,
  -- Rule 9: when an engagement ends the account goes read-only until this date
  -- rather than being cut off. Cutting a client off the day they cancel is how a
  -- neutral ending becomes a bad review.
  access_until date,
  suspended_reason text,
  invited_by uuid references public.profile (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.client_account is 'Rule 1: one row per profile, so a client account is bound to exactly one engagement at the schema level.';

create index client_account_case_file_idx on public.client_account (case_file_id);

create trigger client_account_touch before update on public.client_account
  for each row execute function app.touch_updated_at();

-- Invitation only, single use, expiring.
create table public.client_invite (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  email text not null,
  full_name text,
  job_title text,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  invited_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index client_invite_email_idx on public.client_invite (lower(email));

-- A6: the lower-friction alternative for clients who will not create an account.
-- Same data, same boundary rules, every view logged.
create table public.client_dashboard_link (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  token text not null unique,
  label text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- Optional gate. Stored as a digest; the passphrase itself is never kept.
  password_hash text,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

comment on column public.client_dashboard_link.password_hash is 'bcrypt digest. The passphrase is never stored.';

create table public.client_dashboard_link_view (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.client_dashboard_link (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create index client_dashboard_link_view_link_idx on public.client_dashboard_link_view (link_id, viewed_at desc);

-- A7: a request channel with a record, not a chat product.
create type public.client_message_status as enum ('open', 'answered', 'closed');

create table public.client_message (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  author_profile_id uuid references public.profile (id) on delete set null,
  author_name text not null,
  body text not null,
  status public.client_message_status not null default 'open',
  response_due_at timestamptz not null,
  answered_at timestamptz,
  answer text,
  answered_by uuid references public.profile (id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index client_message_case_file_idx on public.client_message (case_file_id, created_at desc);
create index client_message_open_idx on public.client_message (response_due_at) where status = 'open';

-- A8: clients control their own preferences except billing notices, which always
-- send and therefore are not represented here at all.
create table public.client_notification_pref (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  weekly_digest boolean not null default true,
  milestone_alerts boolean not null default true,
  report_published boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.client_notification_pref is 'Billing notices are deliberately absent: they always send.';

create trigger client_notification_pref_touch before update on public.client_notification_pref
  for each row execute function app.touch_updated_at();

-- A report is only visible to a client once DA has explicitly published it.
alter table public.growth_report
  add column published_to_client_at timestamptz,
  add column published_by uuid references public.profile (id);

comment on column public.growth_report.published_to_client_at is 'Null means DA generated it but has not shown it. Clients never see unpublished reports.';

-- Client uploads are distinguishable from DA's own evidence so the case file can
-- surface them as new items awaiting review.
alter table public.evidence_item
  add column uploaded_by_client boolean not null default false,
  add column reviewed_by_admin_at timestamptz;

-- Pass-through costs, needed for the margin view.
create table public.pass_through_cost (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  occurred_on date not null,
  description text not null,
  amount numeric(12, 2) not null,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now()
);

create index pass_through_cost_case_file_idx on public.pass_through_cost (case_file_id, occurred_on desc);
