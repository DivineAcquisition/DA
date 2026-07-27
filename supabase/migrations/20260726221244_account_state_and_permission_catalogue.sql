-- ---------------------------------------------------------------------------
-- The account
--
-- One user table across every surface. A person signing in at ops.vistrial.io and
-- a person signing in at ad.vistrial.io are the same row with the same audit
-- trail; only the role and the scope differ.
-- ---------------------------------------------------------------------------

alter table public.profile
  add column state public.account_state not null default 'pending',
  -- Mandatory for a Contractor, optional for everyone else. Enforced in
  -- invite_account() rather than as a check constraint, because the role can
  -- change later and a constraint would then block unrelated edits.
  add column expires_on date,
  add column time_zone text,
  add column must_change_password boolean not null default false,
  add column mfa_required boolean,
  add column failed_attempts integer not null default 0,
  add column locked_until timestamptz,
  add column locked_reason text,
  -- Sign in restrictions, for accounts where they are warranted.
  add column ip_allowlist cidr[],
  add column restrict_to_shift boolean not null default false,
  add column shift_override boolean not null default false,
  add column session_timeout_minutes integer,
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column suspended_by uuid references public.profile (id),
  -- Rule 7: archived, never deleted, while any history references them. A soft
  -- delete holds a recovery window before an Owner can purge.
  add column soft_deleted_at timestamptz,
  add column soft_deleted_by uuid references public.profile (id),
  add column purge_after timestamptz,
  add column archived_at timestamptz,
  add column last_sign_in_at timestamptz,
  add column invited_by uuid references public.profile (id),
  add column accepted_at timestamptz,
  add column notes text;

comment on column public.profile.state is
  'Rule 9: suspension takes effect immediately. Every permission check reads this, so a suspended account is refused on its next query rather than at its next sign in.';

create index profile_account_state_idx on public.profile (state);

-- Existing accounts predate the lifecycle, and they are in use.
update public.profile set state = 'active', accepted_at = created_at;

-- The session timeout is shortest for a Contractor and longest for an Owner.
create or replace function app.default_session_minutes(p_role public.user_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then 720
    when 'admin' then 480
    when 'manager' then 240
    when 'operator' then 240
    when 'contractor' then 60
    else 120
  end;
$$;

-- A second factor is required for Owner, Admin and Manager, and encouraged for
-- the rest. `mfa_required` overrides this per account when it is set.
create or replace function app.mfa_is_required(p_role public.user_role, p_override boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_override, p_role in ('owner', 'admin', 'manager'));
$$;

-- ---------------------------------------------------------------------------
-- The permission catalogue
-- ---------------------------------------------------------------------------

create table public.permission (
  key text primary key,
  label text not null,
  description text not null,
  category text not null,
  sort_order integer not null default 100,
  -- Destructive actions need step-up authentication and a typed confirmation.
  is_destructive boolean not null default false,
  requires_step_up boolean not null default false,
  -- Rule 5: some things are never done while impersonating, whatever the real
  -- admin's own permissions are.
  blocked_during_impersonation boolean not null default false
);

comment on table public.permission is
  'The catalogue of things an account can be allowed to do. A role grants a default set, scope decides which records, and an override adjusts one key for one account.';

insert into public.permission (key, label, description, category, sort_order, is_destructive, requires_step_up, blocked_during_impersonation) values
  ('accounts.view', 'See accounts', 'Read the account roster and account detail pages.', 'Accounts', 10, false, false, false),
  ('accounts.invite', 'Invite accounts', 'Create, resend and cancel invitations.', 'Accounts', 20, false, false, true),
  ('accounts.suspend', 'Suspend and reactivate', 'Suspend an account immediately, and bring it back.', 'Accounts', 30, false, false, true),
  ('accounts.role_change', 'Change roles', 'Move an account between roles.', 'Accounts', 40, false, true, true),
  ('accounts.scope_change', 'Change scope', 'Set which clients or placements an account can reach.', 'Accounts', 50, false, false, true),
  ('accounts.override_change', 'Grant and deny permissions', 'Layer an individual grant or denial on an account.', 'Accounts', 60, false, true, true),
  ('accounts.soft_delete', 'Soft delete accounts', 'Remove an account with a recovery window.', 'Accounts', 70, true, true, true),
  ('accounts.permanent_delete', 'Permanently delete accounts', 'Purge a soft deleted account for good. Owner only.', 'Accounts', 80, true, true, true),
  ('accounts.revoke_sessions', 'Revoke sessions', 'End every active session for an account at once.', 'Accounts', 90, false, false, true),
  ('accounts.reset_credentials', 'Reset passwords and second factors', 'Force a password reset or re-enrol a second factor.', 'Accounts', 100, false, true, true),
  ('accounts.impersonate', 'Impersonate', 'View the application as another account.', 'Accounts', 110, false, true, true),
  ('accounts.export', 'Export account records', 'Export everything associated with an account. Never includes credentials.', 'Accounts', 120, false, false, false),
  ('accounts.message', 'Message accounts', 'Send a direct message at any severity.', 'Accounts', 130, false, false, false),

  ('clients.view', 'See clients', 'Read case files inside scope.', 'Clients', 200, false, false, false),
  ('clients.edit', 'Edit clients', 'Change case file configuration and terms.', 'Clients', 210, false, false, false),
  ('clients.delete_data', 'Permanently delete client data', 'Remove a case file and its history. Owner only.', 'Clients', 220, true, true, true),

  ('documents.generate', 'Generate documents', 'Produce and edit client documents.', 'Documents', 300, false, false, false),
  ('documents.publish', 'Publish documents', 'Release a document to a client.', 'Documents', 310, false, false, false),

  ('billing.view', 'See billing', 'Read invoices, revenue and margin.', 'Money', 400, false, false, false),
  ('billing.manage', 'Manage billing', 'Issue invoices, record payments, write off.', 'Money', 410, false, false, true),
  ('payroll.view', 'See payroll', 'Read pay periods, statements and payouts.', 'Money', 420, false, false, false),
  ('payroll.close', 'Close pay periods', 'Lock a pay period and its statements.', 'Money', 430, false, true, true),
  ('approvals.financial', 'Approve financial items', 'Approve booking claims, expense claims and quotes.', 'Money', 440, false, false, true),

  ('credentials.view', 'View credentials', 'Reveal a stored client credential. Not implied by any role.', 'Credentials', 500, false, true, true),
  ('credentials.manage', 'Manage credentials', 'Add, rotate and archive stored credentials.', 'Credentials', 510, false, true, true),
  ('credentials.grant', 'Grant credential access', 'Give another account time limited access to a credential.', 'Credentials', 520, false, true, true),

  ('audit.view', 'Read the audit log', 'Read the log across every surface.', 'Oversight', 600, false, false, false),
  ('audit.export', 'Export the audit log', 'Export a filtered slice of the log.', 'Oversight', 610, false, false, false),

  ('evidence.upload', 'Upload evidence', 'Add files to a client evidence vault.', 'Work', 700, false, false, false),
  ('bookings.approve', 'Approve booking claims', 'Approve or reject a manually logged booking.', 'Work', 710, false, false, true),
  ('scope.approve', 'Decide scope requests', 'Mark a request in or out of scope, and quote it.', 'Work', 720, false, false, false),

  ('system.lockdown', 'Global lockdown', 'Revoke every session except your own. Owner only.', 'System', 800, true, true, true);

-- Role defaults. Presence is a grant; absence is not a denial, it is simply no
-- default, which an override can still supply.
create table public.role_permission (
  role public.user_role not null,
  permission_key text not null references public.permission (key) on delete cascade,
  primary key (role, permission_key)
);

-- Owner: full control, including the destructive and financial actions.
insert into public.role_permission (role, permission_key)
select 'owner', key from public.permission;

-- Admin: everything Owner has except deleting accounts, changing Owner-level
-- roles, billing, and permanently deleting client data. The Owner-role exception
-- is not a permission key, it is a rank check in app.can_target().
insert into public.role_permission (role, permission_key)
select 'admin', key from public.permission
where key not in (
  'accounts.permanent_delete',
  'clients.delete_data',
  'billing.view',
  'billing.manage',
  'credentials.view',
  'credentials.manage',
  'credentials.grant',
  'system.lockdown'
);

-- Manager: full access to assigned clients. No financial totals, no credentials.
insert into public.role_permission (role, permission_key) values
  ('manager', 'accounts.view'),
  ('manager', 'accounts.message'),
  ('manager', 'clients.view'),
  ('manager', 'clients.edit'),
  ('manager', 'documents.generate'),
  ('manager', 'documents.publish'),
  ('manager', 'evidence.upload'),
  ('manager', 'bookings.approve'),
  ('manager', 'scope.approve'),
  ('manager', 'audit.view');

-- Operator: their own placements and their own records, nothing else.
insert into public.role_permission (role, permission_key) values
  ('operator', 'clients.view');

-- Contractor: the build spec and the systems they need. No commercial terms, no
-- revenue, no growth reporting.
insert into public.role_permission (role, permission_key) values
  ('contractor', 'clients.view');

-- Reserved. The client account surface exists and has its own RLS; the role is
-- listed here so the permission model already accounts for it.
insert into public.role_permission (role, permission_key) values
  ('client', 'clients.view');

-- ---------------------------------------------------------------------------
-- Scope and overrides
-- ---------------------------------------------------------------------------

create table public.account_scope (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  kind public.scope_kind not null default 'clients',
  set_by uuid references public.profile (id),
  updated_at timestamptz not null default now()
);

create table public.account_scope_client (
  profile_id uuid not null references public.profile (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  added_by uuid references public.profile (id),
  added_at timestamptz not null default now(),
  primary key (profile_id, case_file_id)
);

create table public.account_scope_placement (
  profile_id uuid not null references public.profile (id) on delete cascade,
  placement_id uuid not null references public.placement (id) on delete cascade,
  added_by uuid references public.profile (id),
  added_at timestamptz not null default now(),
  primary key (profile_id, placement_id)
);

create table public.account_permission (
  profile_id uuid not null references public.profile (id) on delete cascade,
  permission_key text not null references public.permission (key) on delete cascade,
  effect public.permission_effect not null,
  reason text,
  expires_at timestamptz,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, permission_key)
);

comment on table public.account_permission is
  'Rule 2: an explicit denial beats a grant at every layer, so a row with effect = deny outranks the role default and any grant.';

-- Owners and admins already have scope over everything.
insert into public.account_scope (profile_id, kind)
select id, 'all_clients' from public.profile where role in ('owner', 'admin')
on conflict do nothing;
