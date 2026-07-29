-- ---------------------------------------------------------------------------
-- The machine doors.
--
-- Until now GoHighLevel and the payment processor were assumed to have written
-- their rows already: `booking.source = 'ghl'` and `tracking_metric_daily` were
-- landing zones with no visible way in. That left three of the platform's rules
-- with nowhere to live. There was no raw payload to replay when parsing failed,
-- no way to tell a duplicate delivery from a second booking, and no record of an
-- event that could not be attributed to a client.
--
-- This is the door itself. One immutable log of everything that arrived, keyed
-- so a retry cannot become a second record, and resolvable to exactly one client
-- or to nothing at all.
-- ---------------------------------------------------------------------------

create type public.ingest_provider as enum ('gohighlevel', 'payments');

-- How a door proves who is knocking.
--
-- GoHighLevel workflows post a static secret in a header. The payment processor
-- signs the body, which is stronger but needs the key in the clear to verify, so
-- that one lives in the Vault rather than as a digest.
create type public.ingest_auth_mode as enum ('shared_secret', 'hmac_sha256');

-- The life of one delivery.
--
-- `received` means logged and not yet interpreted, which is the only state that
-- is allowed to be transient. Everything else is terminal until an admin
-- replays it.
create type public.ingest_status as enum (
  'received',
  'processed',
  'unattributed',
  'unknown_type',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------

create table public.ingest_endpoint (
  id uuid primary key default gen_random_uuid(),
  provider public.ingest_provider not null,
  -- The public half. It names which door was knocked on, so the secret to check
  -- against can be found without reading the body first.
  key text not null unique check (length(key) between 16 and 128),
  auth_mode public.ingest_auth_mode not null default 'shared_secret',
  -- shared_secret mode: the digest of the expected header value. The secret
  -- itself is shown once, at creation, and then only ever compared.
  secret_hash text,
  -- hmac_sha256 mode: a Vault secret id, because verifying a signature needs the
  -- key and not its digest.
  signing_secret_id uuid,
  label text not null,
  -- A per-client door. Null for a platform door: the payment processor sends
  -- every client's events down one pipe, so its tenant comes from the payload.
  case_file_id uuid references public.client_case_file (id) on delete cascade,
  active boolean not null default true,
  last_event_at timestamptz,
  rotated_at timestamptz,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingest_endpoint_secret_present check (
    case auth_mode
      when 'shared_secret' then secret_hash is not null
      when 'hmac_sha256' then signing_secret_id is not null
    end
  )
);

comment on table public.ingest_endpoint is
  'A machine door. Authentication happens against this row before the body is parsed, so an unsigned request never reaches the interpreter.';

comment on column public.ingest_endpoint.case_file_id is
  'Set for a per-client door, null for a platform door. It is the fallback tenant, used only when the payload names no account of its own.';

create index ingest_endpoint_case_file_idx on public.ingest_endpoint (case_file_id);

create trigger ingest_endpoint_touch before update on public.ingest_endpoint
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Tenant resolution
--
-- "Every inbound event carries the sending account identifier, which maps to
-- exactly one client." The unique constraint is that sentence: one account
-- reference cannot resolve two ways, so attribution is a lookup and never a
-- judgement.
-- ---------------------------------------------------------------------------

create table public.ingest_source (
  id uuid primary key default gen_random_uuid(),
  provider public.ingest_provider not null,
  -- As it appears in the payload: a GoHighLevel location id, a processor account.
  account_ref text not null,
  case_file_id uuid not null references public.client_case_file (id) on delete cascade,
  label text,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  unique (provider, account_ref)
);

comment on table public.ingest_source is
  'Sending account to client. Unique per provider so an event resolves to exactly one client or to none, never to a guess.';

create index ingest_source_case_file_idx on public.ingest_source (case_file_id);

-- ---------------------------------------------------------------------------
-- What the system knows how to do
--
-- An event type absent from this table is logged as unknown and raised, which is
-- almost always a workflow added in GoHighLevel with no handler behind it. Held
-- as data rather than as a CASE inside the dispatcher so the gap is legible to
-- an admin instead of being buried in a function body.
-- ---------------------------------------------------------------------------

create table public.ingest_event_type (
  provider public.ingest_provider not null,
  event_type text not null,
  -- The app-schema handler, or 'none' for a type that is deliberately inert. The
  -- dispatcher calls this by name, so the shape is constrained here: an admin
  -- editing the catalogue can add a handler, not point the door at any function.
  handler text not null check (handler = 'none' or handler ~ '^ingest_handle_[a-z_]+$'),
  description text not null,
  primary key (provider, event_type)
);

comment on table public.ingest_event_type is
  'The handled types. Anything not listed lands as unknown_type and is raised to the admin rather than dropped.';

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------

create table public.ingest_event (
  id uuid primary key default gen_random_uuid(),
  provider public.ingest_provider not null,
  endpoint_id uuid references public.ingest_endpoint (id) on delete set null,

  -- Idempotency. The provider's own event id where it sends one, otherwise a
  -- digest of the body. Unique per provider, so a retry storm produces one row.
  dedupe_key text not null,
  external_event_id text,

  -- The body exactly as it arrived. Kept as text and not only as jsonb because a
  -- payload that fails to parse is the case that most needs to be on record.
  raw_body text not null,
  -- Null when the body was not valid JSON.
  payload jsonb,
  headers jsonb not null default '{}'::jsonb,

  event_type text,
  account_ref text,
  case_file_id uuid references public.client_case_file (id) on delete set null,

  status public.ingest_status not null default 'received',
  handler text,
  error text,
  attempts integer not null default 0,

  -- Minted by ingest_receive so the caller can trigger processing straight after
  -- the acknowledgement without holding a credential. One event, one use.
  process_token_hash text,
  process_token_expires_at timestamptz,

  received_at timestamptz not null default now(),
  processed_at timestamptz,
  replayed_at timestamptz,
  replayed_by uuid references public.profile (id),
  attributed_by uuid references public.profile (id),

  unique (provider, dedupe_key)
);

comment on table public.ingest_event is
  'Every delivery through a machine door, logged before it is interpreted. Immutable in its payload; only the outcome of processing may change. This is the evidence trail a client dispute is answered from and the queue a failed parse is replayed from.';

comment on column public.ingest_event.dedupe_key is
  'Rule 4: duplicate events produce one record. Providers retry, and a duplicated booking is a duplicated commission and a duplicated invoice line.';

comment on column public.ingest_event.raw_body is
  'Rule 2: logged before processing. A body that cannot be parsed is still on record here and can be replayed once a handler understands it.';

create index ingest_event_open_idx on public.ingest_event (status, received_at)
  where status <> 'processed';
create index ingest_event_case_file_idx on public.ingest_event (case_file_id, received_at desc);
create index ingest_event_type_idx on public.ingest_event (provider, event_type, received_at desc);
create index ingest_event_received_idx on public.ingest_event (received_at desc);

-- The payload is the evidence, so it is frozen. The outcome of processing is
-- not: a replay writes a new status, and an admin resolving an unattributed
-- event writes the client it belongs to.
create or replace function app.guard_ingest_event_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider is distinct from old.provider
     or new.dedupe_key is distinct from old.dedupe_key
     or new.raw_body is distinct from old.raw_body
     or new.payload is distinct from old.payload
     or new.headers is distinct from old.headers
     or new.received_at is distinct from old.received_at
     or new.endpoint_id is distinct from old.endpoint_id
  then
    raise exception 'ingest_event_payload_is_immutable: the delivery is evidence. Processing may write its outcome, nothing may rewrite what arrived.'
      using errcode = '23514';
  end if;

  -- Once attributed, the client is settled. Correcting a mistake means adding a
  -- source mapping and replaying, not quietly moving the row.
  if old.case_file_id is not null and new.case_file_id is distinct from old.case_file_id then
    raise exception 'ingest_event_already_attributed: this event is already resolved to a client'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ingest_event_no_payload_rewrite before update on public.ingest_event
  for each row execute function app.guard_ingest_event_update();

create trigger ingest_event_no_delete before delete on public.ingest_event
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Rejections
--
-- A request that fails authentication is refused before its body is read, so it
-- has no place in the event log — nothing was accepted. It still needs a record,
-- because "the door is being knocked on with the wrong key" is a question an
-- admin has to be able to answer.
-- ---------------------------------------------------------------------------

create table public.ingest_auth_failure (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  provider public.ingest_provider,
  endpoint_key text,
  reason text not null,
  body_bytes integer,
  ip inet,
  user_agent text
);

comment on table public.ingest_auth_failure is
  'Refused at the door. Append only, and deliberately not the event log: an unauthenticated body is not evidence of anything.';

create index ingest_auth_failure_at_idx on public.ingest_auth_failure (at desc);

create trigger ingest_auth_failure_no_update before update on public.ingest_auth_failure
  for each row execute function app.forbid_mutation();

create trigger ingest_auth_failure_no_delete before delete on public.ingest_auth_failure
  for each row execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Access
--
-- The credential tables are admin only, like the rest of the vault. The event
-- log is readable by a manager inside their scope, because diagnosing a client's
-- missing bookings is their work, and it carries no commercial detail.
-- ---------------------------------------------------------------------------

alter table public.ingest_endpoint enable row level security;
alter table public.ingest_source enable row level security;
alter table public.ingest_event_type enable row level security;
alter table public.ingest_event enable row level security;
alter table public.ingest_auth_failure enable row level security;

create policy ingest_endpoint_admin_only on public.ingest_endpoint
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy ingest_source_admin_only on public.ingest_source
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy ingest_event_type_admin_only on public.ingest_event_type
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy ingest_auth_failure_admin_only on public.ingest_auth_failure
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy ingest_event_admin_all on public.ingest_event
  for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy ingest_event_manager_scope on public.ingest_event
  for select to authenticated
  using (app.is_manager() and app.in_scope_case_file(case_file_id));

revoke all on public.ingest_endpoint from anon;
revoke all on public.ingest_source from anon;
revoke all on public.ingest_event_type from anon;
revoke all on public.ingest_event from anon;
revoke all on public.ingest_auth_failure from anon;

-- ---------------------------------------------------------------------------
-- The handled types
--
-- Named for the DA snapshot's workflows. Adding a workflow in GoHighLevel means
-- adding a row here and a handler; until both exist the event is logged as
-- unknown and surfaced, which is the intended behaviour rather than a gap.
-- ---------------------------------------------------------------------------

insert into public.ingest_event_type (provider, event_type, handler, description) values
  ('gohighlevel', 'ContactCreate', 'ingest_handle_lead', 'A lead exists. Stamps lead-in and records source and UTMs.'),
  ('gohighlevel', 'lead.created', 'ingest_handle_lead', 'A lead exists. Stamps lead-in and records source and UTMs.'),
  ('gohighlevel', 'InboundMessage', 'ingest_handle_lead', 'An inbound message from a contact the system may not have seen yet.'),
  ('gohighlevel', 'OutboundMessage', 'ingest_handle_touch', 'A human replied. Stamps first touch, which is what makes response time truthful.'),
  ('gohighlevel', 'lead.contacted', 'ingest_handle_touch', 'A human replied. Stamps first touch.'),
  ('gohighlevel', 'NoteCreate', 'ingest_handle_touch', 'A logged call or note counts as a touch.'),
  ('gohighlevel', 'OpportunityStageUpdate', 'ingest_handle_stage', 'Pipeline stage moved.'),
  ('gohighlevel', 'stage.changed', 'ingest_handle_stage', 'Pipeline stage moved.'),
  ('gohighlevel', 'AppointmentCreate', 'ingest_handle_booking', 'A booking the system can evidence. Reconciles against operator claims.'),
  ('gohighlevel', 'appointment.booked', 'ingest_handle_booking', 'A booking the system can evidence. Reconciles against operator claims.'),
  ('gohighlevel', 'AppointmentUpdate', 'ingest_handle_booking', 'A booking moved or was confirmed.'),
  ('gohighlevel', 'ContactDelete', 'none', 'Acknowledged and inert. Vistrial does not delete tracked history.'),
  ('payments', 'payment_intent.succeeded', 'ingest_handle_payment', 'Client payment confirmed against an invoice.'),
  ('payments', 'charge.succeeded', 'ingest_handle_payment', 'Client payment confirmed against an invoice.'),
  ('payments', 'invoice.payment_succeeded', 'ingest_handle_payment', 'Client payment confirmed against an invoice.'),
  ('payments', 'payment_intent.payment_failed', 'ingest_handle_payment', 'Client payment failed. Opens the dunning sequence.'),
  ('payments', 'invoice.payment_failed', 'ingest_handle_payment', 'Client payment failed. Opens the dunning sequence.'),
  ('payments', 'charge.refunded', 'ingest_handle_payment', 'Client payment refunded.');
