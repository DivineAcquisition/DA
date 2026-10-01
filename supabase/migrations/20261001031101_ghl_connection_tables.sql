-- ===========================================================================
-- GHL connection layer, part 1: tables
--
-- One agency connection and one connection per client sub-account, each a
-- Private Integration Token held in the Vault. Nothing in this file stores a
-- token in a column: ghl_connection.secret_id points into vault.secrets and only
-- the last four characters live here, for recognition.
--
-- Every table below has row level security on and no policy, so nothing but the
-- SECURITY DEFINER functions in the following migrations (and the service role,
-- which the server-side worker uses) can read or write them. The screens read
-- through functions that check permission and scope first.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Connections
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.ghl_connection_level as enum ('agency', 'location');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ghl_health as enum ('untested', 'healthy', 'degraded', 'failing', 'retired');
exception when duplicate_object then null; end $$;

create table if not exists public.ghl_connection (
  id uuid primary key default gen_random_uuid(),
  level public.ghl_connection_level not null,
  -- A location connection belongs to exactly one client. The agency one to none.
  case_file_id uuid references public.client_case_file (id) on delete restrict,
  location_id text,
  company_id text,
  label text not null,
  -- 'pit' today. 'oauth' is the replacement path: the request layer asks for "a
  -- working connection for this sub-account" and never for a token kind.
  auth_kind text not null default 'pit' check (auth_kind in ('pit', 'oauth')),
  secret_id uuid not null,
  token_last4 text not null check (char_length(token_last4) = 4),
  token_created_on date not null default current_date,
  rotation_interval_days integer not null default 90 check (rotation_interval_days between 7 and 365),
  rotation_reminded_at timestamptz,
  status public.ghl_health not null default 'untested',
  scopes_present text[] not null default '{}',
  scopes_missing text[] not null default '{}',
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  next_check_at timestamptz not null default now(),
  check_requested_at timestamptz,
  -- Set while dependent work (provisioning, owner assignment) is held back.
  paused_at timestamptz,
  paused_reason text,
  -- A rotation candidate points at the connection it will replace. It is tested
  -- before the old one is retired, so a bad new token never takes over.
  replaces_id uuid references public.ghl_connection (id),
  retired_at timestamptz,
  retired_by uuid references public.profile (id),
  retired_reason text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ghl_connection_shape check (
    (level = 'agency' and case_file_id is null)
    or (level = 'location' and case_file_id is not null and location_id is not null)
  )
);

comment on table public.ghl_connection is
  'GHL Private Integration Tokens. The token is in the Vault (secret_id); this row holds only its last four characters, its scopes and its health.';

-- One live agency connection, one live connection per client, one client per
-- location. A rotation candidate (replaces_id set) sits beside the live one.
create unique index if not exists ghl_connection_one_agency
  on public.ghl_connection (level) where level = 'agency' and retired_at is null and replaces_id is null;
create unique index if not exists ghl_connection_one_per_client
  on public.ghl_connection (case_file_id) where level = 'location' and retired_at is null and replaces_id is null;
create unique index if not exists ghl_connection_one_per_location
  on public.ghl_connection (location_id) where level = 'location' and retired_at is null and replaces_id is null;
create unique index if not exists ghl_connection_one_candidate
  on public.ghl_connection (replaces_id) where replaces_id is not null and retired_at is null;

create trigger ghl_connection_touch before update on public.ghl_connection
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The client's sub-account: one location per case file, one case file per
-- location, for life. Survives token rotation.
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_location (
  case_file_id uuid primary key references public.client_case_file (id) on delete restrict,
  location_id text not null unique,
  location_name text,
  location_time_zone text,
  -- The test sub-account (Novara Cleaning or a sandbox). Tests run only here.
  is_test boolean not null default false,
  ingest_endpoint_id uuid references public.ingest_endpoint (id),
  mapping_checked_at timestamptz,
  mapping_drift integer not null default 0,
  mapping_missing integer not null default 0,
  calendars_found integer not null default 0,
  -- A2P 10DLC registration, recorded here and enforced from Prompt 10.
  a2p_recorded_at timestamptz,
  a2p_reference text,
  -- When conversation polling last read this location, and how far it got.
  poll_cursor timestamptz,
  polled_at timestamptz,
  -- Location-level users list, last read for reconciliation.
  users_checked_at timestamptz,
  reconcile_requested_at timestamptz,
  mapping_requested_at timestamptz,
  -- Live activity silence alert, one per episode.
  silence_alerted_at timestamptz,
  linked_by uuid references public.profile (id),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ghl_location is
  'Rule: each case file links to exactly one GHL Location ID, and each Location ID belongs to one client only.';

create trigger ghl_location_touch before update on public.ghl_location
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- The shared request log. Method, path, status, timing, rate-limit headroom.
-- Never a token, never a request or response body.
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_request_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  connection_id uuid references public.ghl_connection (id) on delete set null,
  case_file_id uuid references public.client_case_file (id) on delete set null,
  method text not null,
  path text not null,
  purpose text not null,
  attempt integer not null default 1,
  status_code integer,
  outcome text not null check (outcome in ('ok', 'rate_limited', 'auth_failed', 'scope_missing', 'not_found', 'client_error', 'server_error', 'network', 'skipped')),
  duration_ms integer,
  burst_remaining integer,
  daily_remaining integer,
  idempotency_key text,
  error text
);

create index if not exists ghl_request_log_at_idx on public.ghl_request_log (at desc);
create index if not exists ghl_request_log_case_idx on public.ghl_request_log (case_file_id, at desc);

comment on table public.ghl_request_log is
  'Every GHL API call. Paths only (query strings stripped of anything but ids), no bodies, no tokens.';

-- ---------------------------------------------------------------------------
-- Snapshot standard and per-client mapping
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_standard_item (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pipeline', 'stage', 'custom_field', 'tag', 'calendar')),
  name text not null check (btrim(name) <> ''),
  -- A stage belongs to a pipeline, named here.
  parent_name text,
  position integer,
  -- A custom field's data type, as GHL names it (TEXT, LARGE_TEXT, NUMERICAL,
  -- PHONE, MONETORY, CHECKBOX, SINGLE_OPTIONS, MULTIPLE_OPTIONS, DATE, ...).
  field_type text,
  active boolean not null default true,
  note text,
  updated_by uuid references public.profile (id),
  updated_at timestamptz not null default now(),
  constraint ghl_standard_stage_parent check ((kind = 'stage') = (parent_name is not null))
);

create unique index if not exists ghl_standard_item_unique
  on public.ghl_standard_item (kind, lower(btrim(coalesce(parent_name, ''))), lower(btrim(name)));

comment on table public.ghl_standard_item is
  'The DA snapshot standard every client sub-account is checked against: pipeline, stages in order, custom fields with types, tags, calendars.';

create table if not exists public.ghl_location_map (
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  standard_item_id uuid not null references public.ghl_standard_item (id) on delete cascade,
  ghl_id text,
  found_name text,
  found_type text,
  found_position integer,
  status text not null check (status in ('mapped', 'missing', 'different')),
  detail text,
  checked_at timestamptz not null default now(),
  primary key (case_file_id, standard_item_id)
);

comment on table public.ghl_location_map is
  'Each client''s GHL ids for the standard, matched by name on connect and on every health check. missing and different are drift.';

-- ---------------------------------------------------------------------------
-- Access: GHL users, permission profiles, grants, the job queue and the log
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_permission_profile (
  key text primary key check (key in ('va', 'manager')),
  label text not null,
  -- GHL user role and type for Create/Update User.
  ghl_role text not null default 'user' check (ghl_role in ('user', 'admin')),
  ghl_type text not null default 'account' check (ghl_type in ('account', 'agency')),
  -- The permissions object exactly as the Users API takes it.
  permissions jsonb not null,
  -- What DA wants that the API has no field for. Shown as "verify manually".
  verify_manually text[] not null default '{}',
  updated_by uuid references public.profile (id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ghl_user (
  ghl_user_id text primary key,
  -- The DA person this GHL user is, when there is one.
  profile_id uuid unique references public.profile (id) on delete set null,
  email text,
  name text,
  ghl_role text,
  ghl_type text,
  -- Only users the app created may ever be removed without an admin confirming.
  created_by_app boolean not null default false,
  -- Marked by an admin: never touched by provisioning or reconciliation.
  known_kind text check (known_kind in ('client_staff', 'agency_staff')),
  known_case_file_id uuid references public.client_case_file (id) on delete set null,
  known_marked_by uuid references public.profile (id),
  known_marked_at timestamptz,
  deactivated_at timestamptz,
  location_ids text[] not null default '{}',
  permissions jsonb,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ghl_user_email_idx on public.ghl_user (lower(email));

create trigger ghl_user_touch before update on public.ghl_user
  for each row execute function app.touch_updated_at();

-- What GHL says each user can reach, from the last location users read.
create table if not exists public.ghl_user_location (
  ghl_user_id text not null references public.ghl_user (ghl_user_id) on delete cascade,
  location_id text not null,
  permissions jsonb,
  seen_at timestamptz not null default now(),
  primary key (ghl_user_id, location_id)
);

-- Admins and owners get GHL access only when explicitly enabled, per person.
create table if not exists public.ghl_access_optin (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  enabled_by uuid references public.profile (id),
  enabled_at timestamptz not null default now(),
  reason text
);

-- "Revoke all GHL access" for one person. Holds until an admin lifts it.
create table if not exists public.ghl_access_block (
  profile_id uuid primary key references public.profile (id) on delete cascade,
  blocked_by uuid references public.profile (id),
  blocked_at timestamptz not null default now(),
  reason text not null
);

create table if not exists public.ghl_access_grant (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profile (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  location_id text not null,
  reason text not null check (reason in ('placement', 'manager_scope', 'admin_optin')),
  placement_id uuid references public.placement (id) on delete set null,
  profile_key text not null references public.ghl_permission_profile (key),
  ghl_user_id text,
  state text not null default 'pending' check (state in ('pending', 'active', 'failed', 'revoking', 'revoked')),
  requested_at timestamptz not null default now(),
  granted_at timestamptz,
  revoke_requested_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,
  last_error text,
  -- API permissions DA could not set and someone must check by hand.
  verify_manually text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create unique index if not exists ghl_access_grant_live
  on public.ghl_access_grant (profile_id, case_file_id) where state <> 'revoked';
create index if not exists ghl_access_grant_state_idx on public.ghl_access_grant (state);

create trigger ghl_access_grant_touch before update on public.ghl_access_grant
  for each row execute function app.touch_updated_at();

-- Work for the server-side worker. dedupe_key keeps one live job per purpose, so
-- a retry or a second trigger cannot double a GHL write.
create table if not exists public.ghl_job (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('grant', 'revoke', 'fix_permissions', 'remove_extra', 'assign_owner')),
  case_file_id uuid references public.client_case_file (id) on delete cascade,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  priority integer not null default 5,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'dead', 'cancelled')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_error text,
  result jsonb,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create unique index if not exists ghl_job_live_dedupe
  on public.ghl_job (dedupe_key) where status in ('queued', 'running', 'failed');
create index if not exists ghl_job_due_idx on public.ghl_job (priority, next_attempt_at) where status in ('queued', 'failed');

-- Every change to a GHL user, successful or not.
create table if not exists public.ghl_user_change (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_profile_id uuid references public.profile (id),
  actor_label text not null default 'system',
  job_id bigint references public.ghl_job (id) on delete set null,
  ghl_user_id text,
  profile_id uuid references public.profile (id) on delete set null,
  case_file_id uuid references public.client_case_file (id) on delete set null,
  location_id text,
  action text not null check (action in ('create', 'link_existing', 'add_location', 'remove_location', 'update_permissions', 'deactivate', 'assign_owner')),
  outcome text not null check (outcome in ('ok', 'failed', 'verify_manually')),
  detail text
);

create index if not exists ghl_user_change_at_idx on public.ghl_user_change (at desc);

create table if not exists public.ghl_access_mismatch (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  location_id text not null,
  kind text not null check (kind in ('missing', 'extra', 'wrong_permissions')),
  profile_id uuid references public.profile (id) on delete cascade,
  ghl_user_id text,
  detail text,
  found_at timestamptz not null default now(),
  alerted_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references public.profile (id),
  resolution text
);

create unique index if not exists ghl_access_mismatch_open
  on public.ghl_access_mismatch (case_file_id, kind, coalesce(profile_id::text, ''), coalesce(ghl_user_id, ''))
  where resolved_at is null;

-- ---------------------------------------------------------------------------
-- Routing
-- ---------------------------------------------------------------------------

create table if not exists public.ghl_routing_setting (
  case_file_id uuid primary key references public.client_case_file (id) on delete cascade,
  enabled boolean not null default true,
  remind_after_minutes integer not null default 4 check (remind_after_minutes between 1 and 120),
  manager_after_minutes integer not null default 8 check (manager_after_minutes between 1 and 240),
  max_open_leads integer not null default 8 check (max_open_leads between 1 and 100),
  -- Off unless an admin turns it on for this client.
  auto_reassign boolean not null default false,
  reassign_after_minutes integer not null default 15 check (reassign_after_minutes between 2 and 240),
  silence_alert_minutes integer not null default 180 check (silence_alert_minutes between 15 and 1440),
  updated_by uuid references public.profile (id),
  updated_at timestamptz not null default now(),
  constraint ghl_routing_order check (manager_after_minutes > remind_after_minutes)
);

create table if not exists public.lead_routing (
  lead_id uuid primary key references public.lead (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  placement_id uuid references public.placement (id) on delete set null,
  operator_id uuid references public.operator (id) on delete set null,
  state text not null check (state in ('assigned', 'after_hours', 'no_one_eligible', 'touched', 'reassigned')),
  assigned_at timestamptz,
  owner_state text not null default 'not_needed' check (owner_state in ('not_needed', 'pending', 'set', 'failed')),
  owner_set_at timestamptz,
  owner_error text,
  reminded_at timestamptz,
  manager_alerted_at timestamptz,
  touched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_routing_open_idx on public.lead_routing (case_file_id, state) where state in ('assigned', 'after_hours', 'no_one_eligible');

create trigger lead_routing_touch before update on public.lead_routing
  for each row execute function app.touch_updated_at();

create table if not exists public.lead_routing_decision (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  lead_id uuid not null references public.lead (id) on delete cascade,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  kind text not null check (kind in ('initial', 'after_hours_release', 'reassign', 'manual')),
  -- Every VA considered, and why each was or was not eligible.
  candidates jsonb not null default '[]'::jsonb,
  chosen_placement_id uuid references public.placement (id) on delete set null,
  chosen_operator_id uuid references public.operator (id) on delete set null,
  reason text not null,
  decided_by uuid references public.profile (id)
);

create index if not exists lead_routing_decision_case_idx on public.lead_routing_decision (case_file_id, at desc);

-- ---------------------------------------------------------------------------
-- Attribution on the existing tables. Extended, not repurposed.
-- ---------------------------------------------------------------------------

alter table public.lead_touch
  add column if not exists actor_kind text,
  add column if not exists attribution text,
  add column if not exists is_human boolean,
  add column if not exists ghl_user_id text,
  add column if not exists actor_profile_id uuid references public.profile (id) on delete set null,
  add column if not exists message_source text,
  add column if not exists signal text;

do $$ begin
  alter table public.lead_touch add constraint lead_touch_actor_kind_chk
    check (actor_kind is null or actor_kind in ('va', 'staff', 'client', 'automated', 'unattributed', 'customer'));
  alter table public.lead_touch add constraint lead_touch_attribution_chk
    check (attribution is null or attribution in ('exact', 'estimated', 'none'));
exception when duplicate_object then null; end $$;

comment on column public.lead_touch.actor_kind is
  'Who touched: va, staff, client, automated, unattributed (never guessed), or customer for inbound.';
comment on column public.lead_touch.attribution is
  'exact: matched on the GHL user id. estimated: the shift-window fallback, used only when GHL sent no user. none: not attributed.';

alter table public.lead
  add column if not exists placement_basis text,
  add column if not exists first_touch_profile_id uuid references public.profile (id) on delete set null,
  add column if not exists first_touch_kind text,
  add column if not exists counts_toward_response boolean not null default true;

do $$ begin
  alter table public.lead add constraint lead_placement_basis_chk
    check (placement_basis is null or placement_basis in ('routed', 'exact', 'estimated'));
exception when duplicate_object then null; end $$;

comment on column public.lead.counts_toward_response is
  'False for a lead that arrived while nobody was on shift: it waits in the after-hours queue and is never counted against anyone.';

-- ---------------------------------------------------------------------------
-- Row level security: on, with no policy. Reads go through checked functions.
-- ---------------------------------------------------------------------------

alter table public.ghl_connection enable row level security;
alter table public.ghl_location enable row level security;
alter table public.ghl_request_log enable row level security;
alter table public.ghl_standard_item enable row level security;
alter table public.ghl_location_map enable row level security;
alter table public.ghl_permission_profile enable row level security;
alter table public.ghl_user enable row level security;
alter table public.ghl_user_location enable row level security;
alter table public.ghl_access_optin enable row level security;
alter table public.ghl_access_block enable row level security;
alter table public.ghl_access_grant enable row level security;
alter table public.ghl_job enable row level security;
alter table public.ghl_user_change enable row level security;
alter table public.ghl_access_mismatch enable row level security;
alter table public.ghl_routing_setting enable row level security;
alter table public.lead_routing enable row level security;
alter table public.lead_routing_decision enable row level security;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permission (key, label, description, category, sort_order, is_destructive, requires_step_up, blocked_during_impersonation)
values
  ('ghl.view', 'View GHL status', 'See connection health, readiness, access and routing for clients in scope.', 'GHL', 10, false, false, false),
  ('ghl.connections.manage', 'Manage GHL connections', 'Add, rotate or remove a GHL token, and link a client to its sub-account.', 'GHL', 20, true, true, true),
  ('ghl.standard.manage', 'Edit the GHL standard', 'Define the snapshot standard and the VA and manager permission profiles.', 'GHL', 30, false, false, true),
  ('ghl.access.manage', 'Manage GHL access', 'Fix access mismatches, mark client staff, enable admin access, revoke all GHL access.', 'GHL', 40, true, true, true),
  ('ghl.routing.manage', 'Manage lead routing', 'Change routing settings and reassign leads.', 'GHL', 50, false, false, true)
on conflict (key) do nothing;

insert into public.role_permission (role, permission_key)
select r.role::public.user_role, p.key
from (values ('owner'), ('admin')) r(role)
cross join (values ('ghl.view'), ('ghl.connections.manage'), ('ghl.standard.manage'), ('ghl.access.manage'), ('ghl.routing.manage')) p(key)
on conflict do nothing;

insert into public.role_permission (role, permission_key)
values ('manager', 'ghl.view')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Default permission profiles. Admin-editable; these are the starting point.
--
-- VA: the selling functions (contacts, conversations, opportunities,
-- appointments, calls, tags) and nothing else. Denied: bulk actions, settings
-- (which holds integrations), workflows and triggers, marketing and campaigns,
-- payments, websites and funnels, reporting, reputation, memberships.
-- ---------------------------------------------------------------------------

insert into public.ghl_permission_profile (key, label, ghl_role, ghl_type, permissions, verify_manually)
values
  ('va', 'DA VA', 'user', 'account',
   jsonb_build_object(
     'contactsEnabled', true, 'conversationsEnabled', true, 'opportunitiesEnabled', true,
     'appointmentsEnabled', true, 'phoneCallEnabled', true, 'tagsEnabled', true,
     'dashboardStatsEnabled', false, 'bulkRequestsEnabled', false,
     'settingsEnabled', false, 'workflowsEnabled', false, 'workflowsReadOnly', false,
     'triggersEnabled', false, 'campaignsEnabled', false, 'campaignsReadOnly', false,
     'marketingEnabled', false, 'socialPlanner', false, 'bloggingEnabled', false,
     'paymentsEnabled', false, 'invoiceEnabled', false, 'recordPaymentEnabled', false, 'refundsEnabled', false,
     'cancelSubscriptionEnabled', false,
     'websitesEnabled', false, 'funnelsEnabled', false, 'membershipEnabled', false, 'communitiesEnabled', false,
     'onlineListingsEnabled', false, 'reviewsEnabled', false, 'affiliateManagerEnabled', false,
     'adwordsReportingEnabled', false, 'facebookAdsReportingEnabled', false, 'attributionsReportingEnabled', false,
     'agentReportingEnabled', false, 'leadValueEnabled', false, 'contentAiEnabled', false,
     'assignedDataOnly', false
   ),
   array[
     'Contact export is off (no API field: check the role in GHL)',
     'Contact delete is off (no API field: check the role in GHL)',
     'Integrations are off (covered by settings being off; confirm in GHL)',
     'Billing is off (agency-level; confirm the user is not an agency user)',
     'User management is off (role is "user"; confirm in GHL)'
   ]),
  ('manager', 'DA Manager', 'user', 'account',
   jsonb_build_object(
     'contactsEnabled', true, 'conversationsEnabled', true, 'opportunitiesEnabled', true,
     'appointmentsEnabled', true, 'phoneCallEnabled', true, 'tagsEnabled', true,
     'dashboardStatsEnabled', true, 'agentReportingEnabled', true, 'attributionsReportingEnabled', true,
     'bulkRequestsEnabled', false,
     'settingsEnabled', false, 'workflowsEnabled', false, 'workflowsReadOnly', true,
     'triggersEnabled', false, 'campaignsEnabled', false, 'campaignsReadOnly', true,
     'marketingEnabled', false, 'socialPlanner', false, 'bloggingEnabled', false,
     'paymentsEnabled', false, 'invoiceEnabled', false, 'recordPaymentEnabled', false, 'refundsEnabled', false,
     'cancelSubscriptionEnabled', false,
     'websitesEnabled', false, 'funnelsEnabled', false, 'membershipEnabled', false, 'communitiesEnabled', false,
     'onlineListingsEnabled', false, 'reviewsEnabled', false, 'affiliateManagerEnabled', false,
     'adwordsReportingEnabled', false, 'facebookAdsReportingEnabled', false,
     'leadValueEnabled', false, 'contentAiEnabled', false,
     'assignedDataOnly', false
   ),
   array[
     'Contact export is off (no API field: check the role in GHL)',
     'Contact delete is off (no API field: check the role in GHL)',
     'Billing is off (agency-level; confirm the user is not an agency user)',
     'User management is off (role is "user"; confirm in GHL)'
   ])
on conflict (key) do nothing;

-- The default standard: one pipeline in order, the fields routing and reporting
-- rely on, the tags and one calendar. Admins replace it with their snapshot.
insert into public.ghl_standard_item (kind, name, parent_name, position, field_type, note)
values
  ('pipeline', 'DA Sales Pipeline', null, null, null, 'The pipeline every VA works.'),
  ('stage', 'New Lead', 'DA Sales Pipeline', 1, null, null),
  ('stage', 'Contacted', 'DA Sales Pipeline', 2, null, null),
  ('stage', 'Quote Sent', 'DA Sales Pipeline', 3, null, null),
  ('stage', 'Booked', 'DA Sales Pipeline', 4, null, null),
  ('stage', 'Lost', 'DA Sales Pipeline', 5, null, null),
  ('custom_field', 'Lead Source Detail', null, null, 'TEXT', null),
  ('custom_field', 'Service Requested', null, null, 'SINGLE_OPTIONS', null),
  ('tag', 'da-lead', null, null, null, null),
  ('tag', 'da-booked', null, null, null, null),
  ('calendar', 'DA Booking Calendar', null, null, null, 'At least one calendar is required for readiness.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- New GHL event types the snapshot workflows send. Messages (inbound and
-- outbound) come from the conversation poller as InboundMessage and
-- OutboundMessage, which already have handlers.
-- ---------------------------------------------------------------------------

insert into public.ingest_event_type (provider, event_type, handler, description)
values
  ('gohighlevel', 'PipelineStageChanged', 'ingest_handle_stage', 'Snapshot workflow: opportunity moved stage.'),
  ('gohighlevel', 'AppointmentStatus', 'ingest_handle_booking', 'Snapshot workflow: appointment booked or changed.')
on conflict (provider, event_type) do nothing;
