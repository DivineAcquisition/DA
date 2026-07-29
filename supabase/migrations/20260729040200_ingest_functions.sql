-- ---------------------------------------------------------------------------
-- The ingestion pipeline.
--
-- Seven rules apply to every machine door, in this order, and the order is the
-- design:
--
--   1. Authenticate before parsing. A body that fails the door's secret is
--      refused unread, so a forged payload never reaches an interpreter.
--   2. Log the raw body before interpreting it. ingest_receive() writes the row
--      and stops. Nothing downstream can lose a payload it failed to understand.
--   3. Idempotency. One unique key per provider delivery, so a retry storm
--      produces one record.
--   4. Resolve the tenant by lookup. No client, no guess: the event is stored
--      unattributed and raised.
--   5. Stamp once. Enforced at the lead table, not here, so a handler cannot
--      forget it.
--   6. Unknown types are stored and surfaced, never dropped.
--   7. Acknowledge quickly, then process. Receiving and dispatching are separate
--      calls for exactly this reason.
--
-- Both entry points are granted to anon, as attempt_sign_in() and
-- shared_dashboard() already are: a webhook arrives with no session, and the
-- door's secret is what authorises it. Neither function trusts anything else.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Reading payloads
--
-- Providers move fields between releases and between workflow versions, so every
-- read is a list of candidate paths rather than one. Returning null instead of
-- guessing is the point: a missing field becomes an explicit gap the admin sees.
-- ---------------------------------------------------------------------------

create or replace function app.jsonb_first(p_payload jsonb, variadic p_paths text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select candidate.value
  from unnest(p_paths) with ordinality as p(path, ord)
  cross join lateral (
    select nullif(btrim(coalesce(p_payload #>> string_to_array(p.path, '.'), '')), '') as value
  ) candidate
  where candidate.value is not null
  order by p.ord
  limit 1;
$$;

comment on function app.jsonb_first is 'First non-blank value among dotted paths. Returns null rather than inventing a value when a provider moves a field.';

-- Timestamps arrive as ISO strings, epoch seconds or epoch milliseconds, and
-- occasionally as something unparseable. An unparseable one must not abort the
-- whole delivery, so this yields null and the caller decides.
create or replace function app.ingest_ts(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  if p_value ~ '^\d{10}$' then
    return to_timestamp(p_value::bigint);
  end if;
  if p_value ~ '^\d{13}$' then
    return to_timestamp(p_value::bigint / 1000.0);
  end if;
  return p_value::timestamptz;
exception
  when others then return null;
end;
$$;

create or replace function app.ingest_event_type(p_provider public.ingest_provider, p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_provider
    when 'gohighlevel' then app.jsonb_first(p_payload, 'type', 'event', 'eventType', 'webhook_type')
    when 'payments' then app.jsonb_first(p_payload, 'type', 'event_type')
  end;
$$;

create or replace function app.ingest_external_id(p_provider public.ingest_provider, p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_provider
    when 'gohighlevel' then app.jsonb_first(p_payload, 'webhookId', 'eventId', 'messageId')
    when 'payments' then app.jsonb_first(p_payload, 'id', 'event_id')
  end;
$$;

-- The sending account identifier. For GoHighLevel that is the location. For the
-- payment processor there is usually no per-client account at all, because every
-- client's payments come down one platform pipe, so this is often null and the
-- tenant is resolved from the invoice the payment references instead.
create or replace function app.ingest_account_ref(p_provider public.ingest_provider, p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_provider
    when 'gohighlevel' then app.jsonb_first(
      p_payload, 'locationId', 'location.id', 'location_id', 'companyId')
    when 'payments' then app.jsonb_first(p_payload, 'account', 'data.object.on_behalf_of')
  end;
$$;

create or replace function app.ingest_contact_ref(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select app.jsonb_first(p_payload, 'contact.id', 'contactId', 'contact_id', 'customer.id');
$$;

create or replace function app.ingest_contact_name(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    app.jsonb_first(p_payload, 'contact.name', 'contact.fullName', 'full_name', 'name'),
    nullif(btrim(concat_ws(' ',
      app.jsonb_first(p_payload, 'contact.firstName', 'firstName', 'first_name'),
      app.jsonb_first(p_payload, 'contact.lastName', 'lastName', 'last_name')
    )), '')
  );
$$;

-- ---------------------------------------------------------------------------
-- Tenant resolution
--
-- Lookup only, in a fixed order, and null when nothing matches. Never a guess:
-- attributing a booking to the wrong client bills the wrong client.
-- ---------------------------------------------------------------------------

create or replace function app.ingest_resolve_case_file(
  p_provider public.ingest_provider,
  p_account_ref text,
  p_endpoint_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_case_file uuid;
  v_invoice_ref text;
begin
  -- The account identifier the payload carries, mapped to exactly one client.
  if p_account_ref is not null then
    select s.case_file_id into v_case_file
    from public.ingest_source s
    where s.provider = p_provider and s.account_ref = p_account_ref;

    if v_case_file is not null then
      return v_case_file;
    end if;
  end if;

  -- A per-client door names its own client. A platform door does not, and leaves
  -- this null.
  select e.case_file_id into v_case_file
  from public.ingest_endpoint e
  where e.id = p_endpoint_id;

  if v_case_file is not null then
    return v_case_file;
  end if;

  -- Payments come down one pipe, so the client is whoever the invoice belongs
  -- to. An unrecognised invoice reference stays unattributed rather than being
  -- matched on amount, which would be a guess with money behind it.
  if p_provider = 'payments' then
    v_invoice_ref := app.jsonb_first(
      p_payload,
      'data.object.metadata.vistrial_invoice_id',
      'data.object.metadata.invoice_id',
      'metadata.vistrial_invoice_id',
      'data.object.invoice',
      'data.object.number'
    );

    if v_invoice_ref is not null then
      select i.case_file_id into v_case_file
      from public.invoice i
      where i.id::text = v_invoice_ref
         or i.number = v_invoice_ref
         or i.processor_invoice_id = v_invoice_ref
      limit 1;
    end if;
  end if;

  return v_case_file;
end;
$$;

comment on function app.ingest_resolve_case_file is
  'Rule 9: an event that cannot be resolved returns null and is stored unattributed. There is no branch here that guesses a tenant.';

-- The placement working a client at a given moment, so response performance is
-- attributed to whoever was actually on shift.
create or replace function app.ingest_placement_at(p_case_file_id uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pl.id
  from public.placement pl
  where pl.case_file_id = p_case_file_id
    and pl.status in ('active', 'renewed')
    and pl.start_date <= (p_at at time zone 'UTC')::date
    and pl.end_date >= (p_at at time zone 'UTC')::date
  order by pl.start_date desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Door 1: receive
--
-- Authenticate, log, deduplicate. Deliberately does no interpretation beyond
-- deriving the deduplication key, because the caller is waiting and a slow
-- acknowledgement triggers a provider retry storm.
-- ---------------------------------------------------------------------------

create or replace function public.ingest_receive(
  p_endpoint_key text,
  p_body text,
  -- shared_secret mode: the secret as presented in a header.
  p_secret text default null,
  -- hmac_sha256 mode: the hex digest the provider signed the body with, and the
  -- signed timestamp prefix where the provider uses one.
  p_signature text default null,
  p_signed_at text default null,
  p_headers jsonb default '{}'::jsonb,
  p_ip text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_endpoint public.ingest_endpoint;
  v_secret text;
  v_expected text;
  v_payload jsonb;
  v_event_type text;
  v_external_id text;
  v_account_ref text;
  v_dedupe text;
  v_event public.ingest_event;
  v_token text;
  v_existing uuid;
  v_refusal text;
begin
  select * into v_endpoint
  from public.ingest_endpoint
  where key = p_endpoint_key;

  -- ---- Rule 1: authenticate before parsing ----
  --
  -- Each check names its own reason for the record, and every one of them returns
  -- the same opaque refusal, so a caller probing the door learns nothing from the
  -- difference between a wrong key and a wrong secret.
  if p_body is null then
    v_refusal := 'empty_body';
  elsif v_endpoint.id is null then
    v_refusal := 'unknown_endpoint';
  elsif not v_endpoint.active then
    v_refusal := 'endpoint_inactive';
  elsif v_endpoint.auth_mode = 'shared_secret' then
    if p_secret is null or app.hash_token(p_secret) <> v_endpoint.secret_hash then
      v_refusal := 'bad_secret';
    end if;
  else
    select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_endpoint.signing_secret_id;

    if v_secret is null then
      v_refusal := 'signing_secret_missing';
    else
      -- Processors that timestamp a signature sign "<timestamp>.<body>", so the
      -- signature cannot be lifted off one request and replayed on another.
      v_expected := encode(
        extensions.hmac(
          case when p_signed_at is null then p_body else p_signed_at || '.' || p_body end,
          v_secret,
          'sha256'
        ),
        'hex'
      );

      if p_signature is null or lower(p_signature) <> v_expected then
        v_refusal := 'bad_signature';
      end if;
    end if;
  end if;

  -- A refusal returns rather than raising. Raising would roll back the very row
  -- that records it, and "the door is being knocked on with the wrong key" is
  -- something an admin has to be able to see. The caller turns this into a 401.
  if v_refusal is not null then
    insert into public.ingest_auth_failure (provider, endpoint_key, reason, body_bytes, ip, user_agent)
    values (v_endpoint.provider, p_endpoint_key, v_refusal, length(coalesce(p_body, '')), p_ip::inet, p_user_agent);

    -- One wrong secret is a misconfigured workflow. Ten in ten minutes is either
    -- a rotation nobody finished or someone trying keys.
    if (
      select count(*) from public.ingest_auth_failure
      where endpoint_key = p_endpoint_key and at > now() - interval '10 minutes'
    ) = 10 then
      perform app.raise_owner_alert(
        'ingest.refused_repeatedly',
        format('Ten deliveries in ten minutes have been refused at a %s door (%s). Either a secret rotation was left half done or the key is being guessed at.',
               coalesce(v_endpoint.provider::text, 'unknown'), v_refusal),
        null, null, 'urgent');
    end if;

    return jsonb_build_object('ok', false, 'reason', 'unauthorised');
  end if;

  -- ---- Rule 2: log the raw body before interpreting it ----
  --
  -- The parse below is deliberately allowed to fail. A body that is not JSON is
  -- still written, with payload null and a reason, because the payload that
  -- could not be read is the one most worth keeping.
  begin
    v_payload := p_body::jsonb;
  exception when others then
    v_payload := null;
  end;

  if v_payload is not null then
    v_event_type := app.ingest_event_type(v_endpoint.provider, v_payload);
    v_external_id := app.ingest_external_id(v_endpoint.provider, v_payload);
    v_account_ref := app.ingest_account_ref(v_endpoint.provider, v_payload);
  end if;

  -- ---- Rule 3: idempotency ----
  --
  -- The provider's own event id where there is one. Where there is not, a digest
  -- of the body: two identical bodies through one door are one delivery.
  v_dedupe := coalesce(
    v_external_id,
    'sha256:' || encode(extensions.digest(p_body, 'sha256'), 'hex')
  );

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.ingest_event (
    provider, endpoint_id, dedupe_key, external_event_id,
    raw_body, payload, headers,
    event_type, account_ref, status, error,
    process_token_hash, process_token_expires_at
  )
  values (
    v_endpoint.provider, v_endpoint.id, v_dedupe, v_external_id,
    p_body, v_payload, coalesce(p_headers, '{}'::jsonb),
    v_event_type, v_account_ref,
    (case when v_payload is null then 'failed' else 'received' end)::public.ingest_status,
    case when v_payload is null then 'payload_not_json: the body is on record and can be replayed once it can be read' end,
    app.hash_token(v_token), now() + interval '5 minutes'
  )
  on conflict (provider, dedupe_key) do nothing
  returning * into v_event;

  if v_event.id is null then
    -- Already delivered. One record, and the caller is told so rather than being
    -- handed a second id it might process again.
    select id into v_existing
    from public.ingest_event
    where provider = v_endpoint.provider and dedupe_key = v_dedupe;

    return jsonb_build_object(
      'ok', true,
      'event_id', v_existing,
      'duplicate', true,
      'status', 'received',
      'process_token', null
    );
  end if;

  update public.ingest_endpoint set last_event_at = now() where id = v_endpoint.id;

  if v_payload is null then
    perform app.raise_owner_alert(
      'ingest.unparseable',
      format('A %s delivery through %s could not be read as JSON. The body is logged and can be replayed.',
             v_endpoint.provider, v_endpoint.label),
      null, null, 'important');

    return jsonb_build_object(
      'ok', true, 'event_id', v_event.id, 'duplicate', false, 'status', 'failed', 'process_token', null);
  end if;

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event.id,
    'duplicate', false,
    'status', 'received',
    'process_token', v_token
  );
end;
$$;

comment on function public.ingest_receive is
  'Rules 1 to 3. Authenticates against the door, writes the raw body, and returns. No interpretation, so the acknowledgement is fast and nothing can be lost by a handler that fails.';

-- ---------------------------------------------------------------------------
-- Dispatch
--
-- Resolve the tenant, find the handler, run it, record the outcome. Every exit
-- writes a status: there is no path where an event is silently left alone.
-- ---------------------------------------------------------------------------

create or replace function app.ingest_dispatch(p_event_id uuid)
returns public.ingest_status
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.ingest_event;
  v_case_file uuid;
  v_handler text;
  v_summary text;
  v_label text;
begin
  select * into v_event from public.ingest_event where id = p_event_id for update;

  if v_event.id is null then
    raise exception 'ingest_event_not_found: %', p_event_id using errcode = 'P0002';
  end if;

  if v_event.status = 'processed' then
    return 'processed';
  end if;

  update public.ingest_event set attempts = attempts + 1 where id = p_event_id;

  if v_event.payload is null then
    update public.ingest_event
       set status = 'failed',
           error = 'payload_not_json: the body is on record and can be replayed once it can be read'
     where id = p_event_id;
    return 'failed';
  end if;

  -- ---- Rule 4: resolve the tenant, or store unattributed ----
  v_case_file := coalesce(
    v_event.case_file_id,
    app.ingest_resolve_case_file(v_event.provider, v_event.account_ref, v_event.endpoint_id, v_event.payload)
  );

  if v_case_file is null then
    update public.ingest_event
       set status = 'unattributed',
           error = format('no client for %s account %s', v_event.provider,
                          coalesce(v_event.account_ref, '(none sent)'))
     where id = p_event_id;

    perform app.raise_owner_alert(
      'ingest.unattributed',
      format('A %s %s event resolved to no client (account %s). It is stored and waiting to be attributed.',
             v_event.provider, coalesce(v_event.event_type, 'untyped'),
             coalesce(v_event.account_ref, 'not sent')),
      null, null, 'important');

    return 'unattributed';
  end if;

  if v_event.case_file_id is null then
    update public.ingest_event set case_file_id = v_case_file where id = p_event_id;
  end if;

  -- ---- Rule 6: unknown types are stored and surfaced ----
  select t.handler into v_handler
  from public.ingest_event_type t
  where t.provider = v_event.provider and t.event_type = v_event.event_type;

  if v_handler is null then
    update public.ingest_event
       set status = 'unknown_type',
           error = format('no handler for %s event %s', v_event.provider,
                          coalesce(v_event.event_type, '(no type in payload)'))
     where id = p_event_id;

    perform app.raise_owner_alert(
      'ingest.unknown_type',
      format('%s sent event type %s, which has no handler. This is usually a workflow added without one.',
             v_event.provider, coalesce(v_event.event_type, '(none)')),
      null, null, 'important');

    return 'unknown_type';
  end if;

  if v_handler = 'none' then
    update public.ingest_event
       set status = 'processed', handler = 'none', processed_at = now(), error = null
     where id = p_event_id;
    return 'processed';
  end if;

  -- A handler that throws must not lose the delivery. The payload is already on
  -- record, so the failure is caught, named, and left replayable.
  begin
    execute format('select app.%I($1)', v_handler) into v_summary using p_event_id;
  exception when others then
    update public.ingest_event
       set status = 'failed', handler = v_handler, error = left(sqlerrm, 500)
     where id = p_event_id;

    select label into v_label from public.ingest_endpoint where id = v_event.endpoint_id;

    perform app.raise_owner_alert(
      'ingest.failed',
      format('Handling a %s %s event through %s failed: %s. It is logged and replayable.',
             v_event.provider, v_event.event_type, coalesce(v_label, 'a door'), left(sqlerrm, 200)),
      null, null, 'important');

    return 'failed';
  end;

  update public.ingest_event
     set status = 'processed', handler = v_handler, processed_at = now(), error = null
   where id = p_event_id;

  return 'processed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Door 2: process
--
-- Called straight after the acknowledgement, holding the one-time token
-- ingest_receive minted. The token is what lets this be granted to anon without
-- becoming a way to drive the dispatcher over other people's events.
-- ---------------------------------------------------------------------------

create or replace function public.ingest_process(p_event_id uuid, p_process_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.ingest_event;
  v_status public.ingest_status;
begin
  select * into v_event from public.ingest_event where id = p_event_id;

  if v_event.id is null
     or v_event.process_token_hash is null
     or p_process_token is null
     or v_event.process_token_hash <> app.hash_token(p_process_token)
     or v_event.process_token_expires_at < now()
  then
    raise exception 'ingest_unauthorised' using errcode = '42501';
  end if;

  -- Spent on use, so a token cannot drive the dispatcher twice.
  update public.ingest_event
     set process_token_hash = null, process_token_expires_at = null
   where id = p_event_id;

  v_status := app.ingest_dispatch(p_event_id);

  return jsonb_build_object('event_id', p_event_id, 'status', v_status);
end;
$$;

grant execute on function public.ingest_receive(text, text, text, text, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.ingest_process(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The backstop
--
-- If the process call never arrives — the function that received the webhook
-- died, the token expired — the delivery is still logged and still 'received'.
-- Cron drains it. This is what makes rule 7 safe: acknowledging early can delay
-- processing but cannot lose it.
-- ---------------------------------------------------------------------------

create or replace function app.drain_ingest_backlog(
  p_limit integer default 200,
  -- Cron leaves a grace period so it does not race the process call the route is
  -- already making. An admin draining by hand wants everything, now.
  p_older_than interval default interval '2 minutes'
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_done integer := 0;
begin
  for v_id in
    select id from public.ingest_event
    where status = 'received' and received_at < now() - p_older_than
    order by received_at
    limit greatest(p_limit, 1)
  loop
    perform app.ingest_dispatch(v_id);
    v_done := v_done + 1;
  end loop;

  return v_done;
end;
$$;

create or replace function public.drain_ingest_backlog(p_limit integer default 200)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  perform app.require_admin();
  return app.drain_ingest_backlog(p_limit, interval '0');
end;
$$;

revoke all on function public.drain_ingest_backlog(integer) from anon;

select cron.schedule(
  'vistrial-ingest-backlog',
  '* * * * *',
  $$select app.drain_ingest_backlog(200)$$
);

-- ---------------------------------------------------------------------------
-- Handlers
--
-- Each one takes an event id, reads the payload, and writes to the table that
-- owns the fact. None of them decide a status; the dispatcher does that, so a
-- handler that half-succeeds cannot report success.
-- ---------------------------------------------------------------------------

create or replace function app.ingest_handle_lead(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_contact text;
  v_at timestamptz;
  v_lead public.lead;
begin
  select * into e from public.ingest_event where id = p_event_id;

  v_contact := app.ingest_contact_ref(e.payload);
  if v_contact is null then
    raise exception 'no_contact_id: the payload names no contact, so there is no lead to key on'
      using errcode = '22023';
  end if;

  v_at := coalesce(
    app.ingest_ts(app.jsonb_first(e.payload,
      'contact.dateAdded', 'dateAdded', 'date_created', 'createdAt', 'timestamp')),
    e.received_at
  );

  insert into public.lead (
    case_file_id, placement_id, external_id, name, email, phone, source,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content,
    lead_in_at, first_ingest_event_id
  )
  values (
    e.case_file_id,
    app.ingest_placement_at(e.case_file_id, v_at),
    v_contact,
    app.ingest_contact_name(e.payload),
    lower(app.jsonb_first(e.payload, 'contact.email', 'email', 'customer.email')),
    app.jsonb_first(e.payload, 'contact.phone', 'phone', 'customer.phone'),
    app.jsonb_first(e.payload, 'contact.source', 'source', 'contact.attributionSource.medium'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmSource', 'attributionSource.utmSource', 'utm_source', 'utmSource'),
    app.jsonb_first(e.payload, 'contact.attributionSource.medium', 'attributionSource.medium', 'utm_medium', 'utmMedium'),
    app.jsonb_first(e.payload, 'contact.attributionSource.campaign', 'attributionSource.campaign', 'utm_campaign', 'utmCampaign'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmTerm', 'utm_term', 'utmTerm'),
    app.jsonb_first(e.payload, 'contact.attributionSource.utmContent', 'utm_content', 'utmContent'),
    v_at,
    e.id
  )
  on conflict (case_file_id, external_id) do update
    -- Contact detail is the provider's to correct, so a later delivery may fill
    -- a gap. lead_in_at is not in this list, and the stamp-once trigger would
    -- refuse it even if it were.
    set name = coalesce(excluded.name, public.lead.name),
        email = coalesce(excluded.email, public.lead.email),
        phone = coalesce(excluded.phone, public.lead.phone),
        source = coalesce(public.lead.source, excluded.source),
        utm_source = coalesce(public.lead.utm_source, excluded.utm_source),
        utm_medium = coalesce(public.lead.utm_medium, excluded.utm_medium),
        utm_campaign = coalesce(public.lead.utm_campaign, excluded.utm_campaign),
        utm_term = coalesce(public.lead.utm_term, excluded.utm_term),
        utm_content = coalesce(public.lead.utm_content, excluded.utm_content)
  returning * into v_lead;

  -- An inbound message is also a touch, but an inbound one: it is the lead
  -- talking, not a human replying, so it must not stamp first touch.
  if e.event_type in ('InboundMessage', 'lead.inbound') then
    insert into public.lead_touch (lead_id, case_file_id, placement_id, channel, direction, occurred_at, ingest_event_id)
    values (
      v_lead.id, e.case_file_id, v_lead.placement_id,
      coalesce(app.jsonb_first(e.payload, 'messageType', 'message.type', 'channel'), 'message'),
      'inbound', v_at, e.id
    );
  end if;

  perform app.refresh_lead_rollups(e.case_file_id, (v_at at time zone 'UTC')::date);

  return format('lead %s', v_lead.id);
end;
$$;

create or replace function app.ingest_handle_touch(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_contact text;
  v_at timestamptz;
  v_lead public.lead;
begin
  select * into e from public.ingest_event where id = p_event_id;

  v_contact := app.ingest_contact_ref(e.payload);
  if v_contact is null then
    raise exception 'no_contact_id: a touch with no contact cannot be attributed to a lead'
      using errcode = '22023';
  end if;

  v_at := coalesce(
    app.ingest_ts(app.jsonb_first(e.payload, 'dateAdded', 'timestamp', 'createdAt', 'date_created')),
    e.received_at
  );

  select * into v_lead from public.lead
  where case_file_id = e.case_file_id and external_id = v_contact;

  -- Providers do not guarantee order, and a reply can land before the contact
  -- event that created the lead. Creating the lead from the touch keeps the
  -- response measurable; lead_in_at is the touch time, which is the most
  -- conservative reading available and never flatters the response.
  if v_lead.id is null then
    insert into public.lead (case_file_id, placement_id, external_id, name, email, phone, lead_in_at, first_ingest_event_id)
    values (
      e.case_file_id, app.ingest_placement_at(e.case_file_id, v_at), v_contact,
      app.ingest_contact_name(e.payload),
      lower(app.jsonb_first(e.payload, 'contact.email', 'email')),
      app.jsonb_first(e.payload, 'contact.phone', 'phone'),
      v_at, e.id
    )
    returning * into v_lead;
  end if;

  insert into public.lead_touch (lead_id, case_file_id, placement_id, channel, direction, occurred_at, ingest_event_id)
  values (
    v_lead.id, e.case_file_id, v_lead.placement_id,
    coalesce(app.jsonb_first(e.payload, 'messageType', 'message.type', 'channel'),
             case when e.event_type = 'NoteCreate' then 'note' else 'message' end),
    'outbound', v_at, e.id
  );

  -- Rule 3. The trigger on lead keeps the earlier value, so a fifth follow-up
  -- cannot make a slow first reply look fast.
  update public.lead set first_touch_at = v_at where id = v_lead.id;

  perform app.refresh_lead_rollups(e.case_file_id, (v_lead.lead_in_at at time zone 'UTC')::date);

  return format('touch on lead %s', v_lead.id);
end;
$$;

create or replace function app.ingest_handle_stage(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_contact text;
  v_at timestamptz;
  v_to text;
  v_lead public.lead;
begin
  select * into e from public.ingest_event where id = p_event_id;

  v_contact := app.ingest_contact_ref(e.payload);
  v_to := app.jsonb_first(e.payload, 'pipelineStage', 'stage', 'opportunity.stage', 'to_stage', 'pipleineStageId');

  if v_contact is null or v_to is null then
    raise exception 'incomplete_stage_change: need a contact and a destination stage'
      using errcode = '22023';
  end if;

  select * into v_lead from public.lead
  where case_file_id = e.case_file_id and external_id = v_contact;

  if v_lead.id is null then
    raise exception 'no_such_lead: stage moved for contact % before any lead event arrived', v_contact
      using errcode = 'P0002';
  end if;

  v_at := coalesce(app.ingest_ts(app.jsonb_first(e.payload, 'dateUpdated', 'timestamp', 'dateAdded')), e.received_at);

  insert into public.lead_stage_event (lead_id, case_file_id, from_stage, to_stage, occurred_at, ingest_event_id)
  values (v_lead.id, e.case_file_id, v_lead.stage, v_to, v_at, e.id);

  update public.lead set stage = v_to, stage_changed_at = v_at where id = v_lead.id;

  return format('stage %s on lead %s', v_to, v_lead.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bookings
--
-- The highest-consequence handler, because one booking touches operator pay and
-- client billing at the same time.
-- ---------------------------------------------------------------------------

create or replace function app.ingest_handle_booking(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_ref text;
  v_at timestamptz;
  v_placement public.placement;
  v_lead public.lead;
  v_contact text;
  v_booking public.booking;
  v_matched integer := 0;
begin
  select * into e from public.ingest_event where id = p_event_id;

  v_at := app.ingest_ts(app.jsonb_first(e.payload,
    'appointment.startTime', 'startTime', 'start_time', 'appointment.start_time', 'calendar.startTime'));

  if v_at is null then
    raise exception 'no_appointment_time: an appointment with no start time cannot be reconciled or billed'
      using errcode = '22023';
  end if;

  v_ref := app.jsonb_first(e.payload, 'appointment.id', 'appointmentId', 'calendar.appointmentId', 'id');

  select * into v_placement from public.placement
  where id = app.ingest_placement_at(e.case_file_id, v_at);

  if v_placement.id is null then
    raise exception 'no_live_placement: no placement covers % for this client, so there is no operator to credit', v_at
      using errcode = 'P0002';
  end if;

  v_contact := app.ingest_contact_ref(e.payload);
  if v_contact is not null then
    select * into v_lead from public.lead
    where case_file_id = e.case_file_id and external_id = v_contact;
  end if;

  -- Rule 4 at the booking, belt and braces. Deduplication at the event log
  -- already stops one delivery being handled twice; the unique index on
  -- (case_file_id, external_ref) additionally stops two *different* deliveries
  -- about the same appointment — a create followed by an update — becoming two
  -- commissions and two invoice lines.
  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for, recorded_at,
    source, state, customer_name, customer_phone, customer_email,
    lead_id, external_ref, ingest_event_id
  )
  values (
    v_placement.id, e.case_file_id, v_placement.operator_id, v_at, e.received_at,
    'ghl', 'system_only',
    coalesce(app.ingest_contact_name(e.payload), 'Unnamed'),
    app.jsonb_first(e.payload, 'contact.phone', 'phone'),
    lower(app.jsonb_first(e.payload, 'contact.email', 'email')),
    v_lead.id, v_ref, e.id
  )
  on conflict (case_file_id, external_ref) where external_ref is not null
  do update set
    scheduled_for = excluded.scheduled_for,
    customer_phone = coalesce(excluded.customer_phone, public.booking.customer_phone),
    customer_email = coalesce(excluded.customer_email, public.booking.customer_email)
  returning * into v_booking;

  if v_lead.id is not null then
    -- Stamped once: the first booking is the one that answers "how long did it
    -- take to convert", so a rebooking must not overwrite it.
    update public.lead set first_booking_at = v_at where id = v_lead.id;
  end if;

  -- Section 12: while ingestion was down operators logged manually and their
  -- claims queued as pending. Ingestion resuming is what confirms them.
  v_matched := app.reconcile_booking_claims(v_placement.id);

  perform app.refresh_lead_rollups(e.case_file_id, (v_at at time zone 'UTC')::date);

  return format('booking %s, %s claim(s) reconciled', v_booking.id, v_matched);
end;
$$;

-- The reconciliation rule, in the database, on the path that money moves along.
--
-- It mirrors reconcilePlacement() in lib/vistrial/rules/bookings.ts, which is
-- what the hub renders from. The match window and the identifier precedence must
-- stay the same in both; if either moves, move both.
create or replace function app.reconcile_booking_claims(p_placement_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window constant interval := interval '120 minutes';
  v_claim record;
  v_match uuid;
  v_confirmed integer := 0;
begin
  for v_claim in
    select b.* from public.booking b
    where b.placement_id = p_placement_id
      and b.source = 'manual'
      and b.state = 'pending_review'
    order by b.scheduled_for
  loop
    select g.id into v_match
    from public.booking g
    where g.placement_id = p_placement_id
      and g.source = 'ghl'
      and abs(extract(epoch from (g.scheduled_for - v_claim.scheduled_for))) <= extract(epoch from v_window)
      -- An ingested booking answers for one claim only, or a single appointment
      -- would confirm two claims and pay twice.
      and not exists (
        select 1 from public.booking other
        where other.matched_booking_id = g.id and other.id <> v_claim.id
      )
      and (
        -- Phone and email are strong. Name alone is a last resort, because
        -- common names collide and a wrong match here pays the wrong operator.
        (nullif(regexp_replace(coalesce(g.customer_phone, ''), '\D', '', 'g'), '') is not null
          and nullif(regexp_replace(coalesce(v_claim.customer_phone, ''), '\D', '', 'g'), '') is not null
          and right(regexp_replace(g.customer_phone, '\D', '', 'g'), 10)
            = right(regexp_replace(v_claim.customer_phone, '\D', '', 'g'), 10))
        or (g.customer_email is not null and v_claim.customer_email is not null
          and lower(g.customer_email) = lower(v_claim.customer_email))
        or (g.customer_phone is null and v_claim.customer_phone is null
          and g.customer_email is null and v_claim.customer_email is null
          and lower(btrim(g.customer_name)) = lower(btrim(v_claim.customer_name)))
      )
    order by abs(extract(epoch from (g.scheduled_for - v_claim.scheduled_for)))
    limit 1;

    if v_match is not null then
      update public.booking
         set state = 'confirmed', matched_booking_id = v_match
       where id = v_claim.id;

      -- Its ingested twin is no longer system-only. booking_is_creditable()
      -- keeps the credit with the ingested row, so the pair counts once.
      update public.booking set state = 'confirmed' where id = v_match;

      v_confirmed := v_confirmed + 1;
    end if;
  end loop;

  return v_confirmed;
end;
$$;

create or replace function app.ingest_handle_payment(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.ingest_event;
  v_ref text;
  v_invoice public.invoice;
  v_amount numeric(12, 2);
  v_status public.payment_attempt_status;
begin
  select * into e from public.ingest_event where id = p_event_id;

  v_ref := app.jsonb_first(e.payload,
    'data.object.metadata.vistrial_invoice_id', 'data.object.metadata.invoice_id',
    'metadata.vistrial_invoice_id', 'data.object.invoice', 'data.object.number');

  if v_ref is null then
    raise exception 'no_invoice_reference: a payment with nothing to apply it to is not applied. Nothing is inferred from the amount.'
      using errcode = '22023';
  end if;

  select * into v_invoice from public.invoice
  where (id::text = v_ref or number = v_ref or processor_invoice_id = v_ref)
    and case_file_id = e.case_file_id
  limit 1;

  if v_invoice.id is null then
    raise exception 'no_such_invoice: % is not an invoice for this client', v_ref using errcode = 'P0002';
  end if;

  v_status := case
    when e.event_type in ('payment_intent.succeeded', 'charge.succeeded', 'invoice.payment_succeeded') then 'succeeded'
    when e.event_type in ('payment_intent.payment_failed', 'invoice.payment_failed') then 'failed'
    when e.event_type = 'charge.refunded' then 'refunded'
  end::public.payment_attempt_status;

  if v_status is null then
    raise exception 'unmapped_payment_event: %', e.event_type using errcode = '22023';
  end if;

  -- Processors quote minor units. A missing amount means the invoice total, which
  -- is what record_payment already assumes.
  v_amount := (
    nullif(app.jsonb_first(e.payload, 'data.object.amount_received', 'data.object.amount_paid',
                           'data.object.amount', 'amount'), '')
  )::numeric / 100.0;

  -- record_payment is idempotent on the revenue side: revenue_record is unique on
  -- invoice_id, so a redelivered success cannot double-count DA revenue.
  perform public.record_payment(
    v_invoice.id, v_status, v_amount,
    app.jsonb_first(e.payload, 'data.object.id', 'id'),
    app.jsonb_first(e.payload, 'data.object.last_payment_error.code', 'data.object.failure_code'),
    app.jsonb_first(e.payload, 'data.object.last_payment_error.message', 'data.object.failure_message')
  );

  return format('%s on invoice %s', v_status, coalesce(v_invoice.number, v_invoice.id::text));
end;
$$;

-- ---------------------------------------------------------------------------
-- Rollups derived from leads
--
-- response_day and tracking_funnel_daily were landing zones written by whatever
-- was feeding them. They are now caches over `lead`, recomputed for a whole day
-- rather than incremented, so replaying an event cannot inflate them.
--
-- The funnel row is shared with facts this does not own — ad spend and revenue
-- are entered by an admin — so the upsert names only the lead-derived columns and
-- leaves the rest untouched.
-- ---------------------------------------------------------------------------

create or replace function app.refresh_lead_rollups(p_case_file_id uuid, p_day date)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into public.tracking_funnel_daily (
    case_file_id, day, source, leads, booked, avg_response_minutes, responded_within_standard, ingested_at
  )
  select
    l.case_file_id,
    p_day,
    coalesce(nullif(btrim(l.source), ''), 'unattributed'),
    count(*),
    count(l.first_booking_at),
    round(avg(l.response_minutes), 2),
    count(*) filter (
      where l.response_minutes is not null
        and l.response_minutes <= coalesce(pl.response_standard_minutes, 5)
    ),
    now()
  from public.lead l
  left join public.placement pl on pl.id = l.placement_id
  where l.case_file_id = p_case_file_id
    and (l.lead_in_at at time zone 'UTC')::date = p_day
  group by l.case_file_id, coalesce(nullif(btrim(l.source), ''), 'unattributed')
  on conflict (case_file_id, day, source) do update
    set leads = excluded.leads,
        booked = excluded.booked,
        avg_response_minutes = excluded.avg_response_minutes,
        responded_within_standard = excluded.responded_within_standard,
        ingested_at = excluded.ingested_at;

  -- A lead that was never answered still counts as a conversation. Excluding it
  -- would let ignoring a lead improve the compliance figure.
  insert into public.response_day (placement_id, day, conversations, within_standard)
  select
    l.placement_id,
    p_day,
    count(*),
    count(*) filter (
      where l.response_minutes is not null
        and l.response_minutes <= coalesce(pl.response_standard_minutes, 5)
    )
  from public.lead l
  join public.placement pl on pl.id = l.placement_id
  where l.case_file_id = p_case_file_id
    and (l.lead_in_at at time zone 'UTC')::date = p_day
  group by l.placement_id
  on conflict (placement_id, day) do update
    set conversations = excluded.conversations,
        within_standard = excluded.within_standard;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin resolution
-- ---------------------------------------------------------------------------

-- Section 12: an event that resolved to no client is never guessed at. An admin
-- says which client it belongs to, and the event is then processed normally.
create or replace function public.attribute_ingest_event(p_event_id uuid, p_case_file_id uuid)
returns public.ingest_event
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_event public.ingest_event;
begin
  perform app.require_admin();

  select * into v_event from public.ingest_event where id = p_event_id;

  if v_event.id is null then
    raise exception 'ingest_event_not_found: %', p_event_id using errcode = 'P0002';
  end if;

  if v_event.case_file_id is not null then
    raise exception 'already_attributed: this event already belongs to a client' using errcode = '23514';
  end if;

  update public.ingest_event
     set case_file_id = p_case_file_id, attributed_by = auth.uid()
   where id = p_event_id;

  perform app.audit('ingest.attributed', 'ingest_event', p_event_id::text,
    format('Attributed a %s %s event to a client by hand', v_event.provider,
           coalesce(v_event.event_type, 'untyped')),
    jsonb_build_object('case_file_id', null),
    jsonb_build_object('case_file_id', p_case_file_id),
    p_case_file_id);

  perform app.ingest_dispatch(p_event_id);

  select * into v_event from public.ingest_event where id = p_event_id;
  return v_event;
end;
$$;

-- Replay. The raw body never moved, so this is the same delivery being
-- interpreted again, not a new one.
create or replace function public.replay_ingest_event(p_event_id uuid)
returns public.ingest_event
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_event public.ingest_event;
begin
  perform app.require_admin();

  select * into v_event from public.ingest_event where id = p_event_id;

  if v_event.id is null then
    raise exception 'ingest_event_not_found: %', p_event_id using errcode = 'P0002';
  end if;

  update public.ingest_event
     set replayed_at = now(), replayed_by = auth.uid()
   where id = p_event_id;

  perform app.audit('ingest.replayed', 'ingest_event', p_event_id::text,
    format('Replayed a %s %s event that was %s', v_event.provider,
           coalesce(v_event.event_type, 'untyped'), v_event.status),
    null, null, v_event.case_file_id);

  perform app.ingest_dispatch(p_event_id);

  select * into v_event from public.ingest_event where id = p_event_id;
  return v_event;
end;
$$;

-- ---------------------------------------------------------------------------
-- Door management
-- ---------------------------------------------------------------------------

-- Returns the secret exactly once, in the same shape invite_account() uses. It
-- is never readable again: shared_secret doors keep only a digest.
create or replace function public.register_ingest_endpoint(
  p_provider public.ingest_provider,
  p_label text,
  p_case_file_id uuid default null,
  p_auth_mode public.ingest_auth_mode default 'shared_secret'
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_secret text;
  v_secret_id uuid;
  v_row public.ingest_endpoint;
begin
  perform app.require_admin();

  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'label_required: name the door, so an unexpected delivery can be traced to it'
      using errcode = '23514';
  end if;

  v_key := encode(extensions.gen_random_bytes(24), 'hex');
  v_secret := encode(extensions.gen_random_bytes(32), 'hex');

  if p_auth_mode = 'hmac_sha256' then
    v_secret_id := vault.create_secret(
      v_secret,
      'ingest_endpoint:' || v_key,
      format('Signing key for the %s door %s', p_provider, btrim(p_label))
    );
  end if;

  insert into public.ingest_endpoint (
    provider, key, auth_mode, secret_hash, signing_secret_id, label, case_file_id, created_by
  )
  values (
    p_provider, v_key, p_auth_mode,
    case when p_auth_mode = 'shared_secret' then app.hash_token(v_secret) end,
    v_secret_id, btrim(p_label), p_case_file_id, auth.uid()
  )
  returning * into v_row;

  perform app.audit('ingest.endpoint_registered', 'ingest_endpoint', v_row.id::text,
    format('Opened a %s door: %s', p_provider, btrim(p_label)),
    null, jsonb_build_object('provider', p_provider, 'auth_mode', p_auth_mode),
    p_case_file_id);

  return jsonb_build_object(
    'id', v_row.id,
    'key', v_key,
    'secret', v_secret,
    'auth_mode', p_auth_mode
  );
end;
$$;

create or replace function public.rotate_ingest_secret(p_endpoint_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row public.ingest_endpoint;
  v_secret text;
begin
  perform app.require_admin();

  select * into v_row from public.ingest_endpoint where id = p_endpoint_id;

  if v_row.id is null then
    raise exception 'ingest_endpoint_not_found: %', p_endpoint_id using errcode = 'P0002';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');

  if v_row.auth_mode = 'hmac_sha256' then
    perform vault.update_secret(v_row.signing_secret_id, v_secret);
  else
    update public.ingest_endpoint
       set secret_hash = app.hash_token(v_secret), rotated_at = now()
     where id = p_endpoint_id;
  end if;

  update public.ingest_endpoint set rotated_at = now() where id = p_endpoint_id;

  perform app.audit('ingest.secret_rotated', 'ingest_endpoint', p_endpoint_id::text,
    format('Rotated the secret on the %s door %s', v_row.provider, v_row.label),
    null, null, v_row.case_file_id);

  return jsonb_build_object('id', p_endpoint_id, 'secret', v_secret);
end;
$$;

create or replace function public.set_ingest_endpoint_active(p_endpoint_id uuid, p_active boolean)
returns public.ingest_endpoint
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row public.ingest_endpoint;
begin
  perform app.require_admin();

  update public.ingest_endpoint set active = p_active where id = p_endpoint_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ingest_endpoint_not_found: %', p_endpoint_id using errcode = 'P0002';
  end if;

  perform app.audit(
    case when p_active then 'ingest.endpoint_opened' else 'ingest.endpoint_closed' end,
    'ingest_endpoint', p_endpoint_id::text,
    format('%s the %s door %s', case when p_active then 'Opened' else 'Closed' end,
           v_row.provider, v_row.label),
    null, null, v_row.case_file_id);

  return v_row;
end;
$$;

-- Mapping a sending account to a client. This is what turns an unattributed
-- backlog into attributable events, so it replays them on the way out.
create or replace function public.map_ingest_account(
  p_provider public.ingest_provider,
  p_account_ref text,
  p_case_file_id uuid,
  p_label text default null
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_replayed integer := 0;
begin
  perform app.require_admin();

  if btrim(coalesce(p_account_ref, '')) = '' then
    raise exception 'account_ref_required' using errcode = '23514';
  end if;

  insert into public.ingest_source (provider, account_ref, case_file_id, label, created_by)
  values (p_provider, btrim(p_account_ref), p_case_file_id, nullif(btrim(coalesce(p_label, '')), ''), auth.uid())
  on conflict (provider, account_ref) do update set case_file_id = excluded.case_file_id
  returning id into v_id;

  perform app.audit('ingest.account_mapped', 'ingest_source', v_id::text,
    format('Mapped %s account %s to a client', p_provider, btrim(p_account_ref)),
    null, jsonb_build_object('account_ref', btrim(p_account_ref)), p_case_file_id);

  for v_id in
    select id from public.ingest_event
    where provider = p_provider
      and account_ref = btrim(p_account_ref)
      and status = 'unattributed'
    order by received_at
  loop
    perform app.ingest_dispatch(v_id);
    v_replayed := v_replayed + 1;
  end loop;

  return v_replayed;
end;
$$;

revoke all on function public.attribute_ingest_event(uuid, uuid) from anon;
revoke all on function public.replay_ingest_event(uuid) from anon;
revoke all on function public.register_ingest_endpoint(public.ingest_provider, text, uuid, public.ingest_auth_mode) from anon;
revoke all on function public.rotate_ingest_secret(uuid) from anon;
revoke all on function public.set_ingest_endpoint_active(uuid, boolean) from anon;
revoke all on function public.map_ingest_account(public.ingest_provider, text, uuid, text) from anon;
