-- End-to-end exercise of the ingestion spine against a real database.
-- Every block asserts, so a regression fails the run rather than printing badly.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures =='
do $$
declare
  v_client uuid;
  v_op uuid;
begin
  insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@divineacquisition.io');
  update public.profile set role = 'admin', state = 'active' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  insert into public.client_case_file (id, name, slug, status)
  values ('cccccccc-0000-0000-0000-000000000001', 'Northside Dental', 'northside-dental', 'active')
  returning id into v_client;

  insert into public.operator (id, name, email, status, base_monthly)
  values ('11111111-2222-0000-0000-000000000001', 'Joy Mensah', 'joy@example.com', 'placed', 600)
  returning id into v_op;

  insert into public.placement (
    id, operator_id, case_file_id, start_date, end_date, status,
    monthly_booking_quota, commission_per_booking, client_rate_per_booking, response_standard_minutes
  )
  values (
    '22222222-3333-0000-0000-000000000001', v_op, v_client,
    '2026-07-01', '2026-09-30', 'active', 20, 15, 60, 5
  );
end $$;

-- Act as that admin for the rest of the run. Session scope, not local, so it
-- survives each DO block.
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== a door, and its secret returned once =='
do $$
declare
  v jsonb;
begin
  v := public.register_ingest_endpoint('gohighlevel', 'Northside GHL', 'cccccccc-0000-0000-0000-000000000001');
  create temp table door (key text, secret text);
  insert into door values (v ->> 'key', v ->> 'secret');

  assert length(v ->> 'key') = 48, 'endpoint key should be 24 random bytes as hex';
  assert length(v ->> 'secret') = 64, 'secret should be 32 random bytes as hex';
  assert not exists (
    select 1 from public.ingest_endpoint where secret_hash = v ->> 'secret'
  ), 'the secret must be stored as a digest, never in the clear';
end $$;

\echo '== rule 1: a wrong secret is refused before the body is read =='
do $$
declare
  v_key text;
  v_before bigint;
begin
  select key into v_key from door;
  select count(*) into v_before from public.ingest_event;

  assert (public.ingest_receive(v_key, '{"type":"ContactCreate"}', 'not-the-secret') ->> 'ok')::boolean = false,
    'a bad secret must be refused';

  assert (select count(*) from public.ingest_event) = v_before,
    'a refused request must not reach the event log';
  assert exists (select 1 from public.ingest_auth_failure where reason = 'bad_secret'),
    'a refusal must still be on record';
end $$;

\echo '== rule 1: an unknown door is refused, and says nothing about why =='
do $$
begin
  assert (public.ingest_receive('0000000000000000000000000000000000000000', '{}', 'x') ->> 'reason') = 'unauthorised',
    'an unknown door is refused with the same opaque reason as a bad secret';

  assert exists (select 1 from public.ingest_auth_failure where reason = 'unknown_endpoint');
end $$;

\echo '== rules 2 and 3: a lead arrives, is logged, and is deduplicated =='
do $$
declare
  d record;
  v jsonb;
  v_again jsonb;
  v_body text;
  v_lead public.lead;
begin
  select * into d from door;

  v_body := json_build_object(
    'type', 'ContactCreate',
    'webhookId', 'wh-lead-1',
    'locationId', 'loc-northside',
    'contact', json_build_object(
      'id', 'contact-1',
      'firstName', 'Ruth', 'lastName', 'Ellis',
      'email', 'Ruth@Example.com', 'phone', '+1 (312) 555-0101',
      'dateAdded', '2026-07-29T09:00:00Z',
      'attributionSource', json_build_object('utmSource', 'google', 'campaign', 'brand-search')
    )
  )::text;

  v := public.ingest_receive(d.key, v_body, d.secret);
  assert (v ->> 'duplicate')::boolean = false, 'first delivery is not a duplicate';
  assert (v ->> 'status') = 'received', 'receive logs and stops, it does not process';

  assert (select payload is not null and raw_body = v_body from public.ingest_event where id = (v ->> 'event_id')::uuid),
    'the raw body is stored verbatim alongside the parsed payload';

  -- The provider retries the identical delivery.
  v_again := public.ingest_receive(d.key, v_body, d.secret);
  assert (v_again ->> 'duplicate')::boolean = true, 'a redelivery must be reported as a duplicate';
  assert (v_again ->> 'event_id')::uuid = (v ->> 'event_id')::uuid, 'and must point at the one record';
  assert (select count(*) from public.ingest_event where external_event_id = 'wh-lead-1') = 1,
    'rule 4: duplicate events produce one record';

  -- Nothing has been interpreted yet.
  assert (select count(*) from public.lead) = 0, 'receive must not interpret';

  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  select * into v_lead from public.lead where external_id = 'contact-1';
  assert v_lead.id is not null, 'processing should create the lead';
  assert v_lead.case_file_id = 'cccccccc-0000-0000-0000-000000000001', 'tenant came from the per-client door';
  assert v_lead.email = 'ruth@example.com', 'email is normalised';
  assert v_lead.name = 'Ruth Ellis', 'name is assembled from first and last';
  assert v_lead.utm_source = 'google', 'UTMs are captured';
  assert v_lead.placement_id = '22222222-3333-0000-0000-000000000001', 'attributed to whoever was on shift';
  assert v_lead.lead_in_at = '2026-07-29T09:00:00Z', 'lead-in is the provider timestamp, not receipt';
  assert v_lead.response_minutes is null, 'no response yet, so the figure is a gap and not a zero';
  assert (select status from public.ingest_event where id = (v ->> 'event_id')::uuid) = 'processed';
end $$;

\echo '== the process token is single use =='
do $$
declare
  d record;
  v jsonb;
begin
  select * into d from door;
  v := public.ingest_receive(d.key,
    json_build_object('type','ContactCreate','webhookId','wh-lead-token','locationId','loc-x',
      'contact', json_build_object('id','contact-token','dateAdded','2026-06-01T09:00:00Z'))::text,
    d.secret);

  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  begin
    perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');
    raise exception 'a spent token should not work twice';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== rule 3 (stamp once): first touch is the first, not the latest =='
do $$
declare
  d record;
  v jsonb;
  v_lead public.lead;
begin
  select * into d from door;

  -- A human replies at 09:04:30.
  v := public.ingest_receive(d.key,
    json_build_object('type','OutboundMessage','webhookId','wh-touch-1','locationId','loc-northside',
      'contactId','contact-1','messageType','SMS','dateAdded','2026-07-29T09:04:30Z')::text,
    d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  select * into v_lead from public.lead where external_id = 'contact-1';
  assert v_lead.first_touch_at = '2026-07-29T09:04:30Z', 'first touch stamps';
  assert v_lead.response_minutes = 4.50, 'response time is computed from the two stamps';

  -- A follow-up eight hours later.
  v := public.ingest_receive(d.key,
    json_build_object('type','OutboundMessage','webhookId','wh-touch-2','locationId','loc-northside',
      'contactId','contact-1','messageType','SMS','dateAdded','2026-07-29T17:00:00Z')::text,
    d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  select * into v_lead from public.lead where external_id = 'contact-1';
  assert v_lead.first_touch_at = '2026-07-29T09:04:30Z',
    'a later event of the same type leaves the existing value alone';
  assert v_lead.response_minutes = 4.50, 'so response time stays truthful';
  assert (select count(*) from public.lead_touch where lead_id = v_lead.id and direction = 'outbound') = 2,
    'but both touches are on record underneath the stamp';
end $$;

\echo '== response time cannot be entered, only computed =='
do $$
begin
  begin
    update public.lead set response_minutes = 1 where external_id = 'contact-1';
    raise exception 'response_minutes should not be writable';
  exception when sqlstate '428C9' then null;
  end;

  -- app.stamp_once() returns a record it rebuilds from jsonb, so this checks the
  -- generated column is still recomputed from the stamps afterwards rather than
  -- being carried through the trigger as a value.
  update public.lead set stage = 'Contacted' where external_id = 'contact-1';
  assert (select response_minutes from public.lead where external_id = 'contact-1') = 4.50,
    'an unrelated update must leave the computed figure agreeing with the stamps';
end $$;

\echo '== the rollups are recomputed, not incremented =='
do $$
declare
  r record;
begin
  select * into r from public.tracking_funnel_daily
  where case_file_id = 'cccccccc-0000-0000-0000-000000000001' and day = '2026-07-29' and source = 'unattributed';

  assert r.leads = 1, format('one lead on the day, got %s', r.leads);
  assert r.avg_response_minutes = 4.50, 'mean response comes from the leads';
  assert r.responded_within_standard = 1, '4.5 minutes beats a 5 minute standard';

  select * into r from public.response_day where placement_id = '22222222-3333-0000-0000-000000000001' and day = '2026-07-29';
  assert r.conversations = 1 and r.within_standard = 1, 'response compliance is derived from leads';
end $$;

\echo '== admin-entered columns on a shared rollup row are not trampled =='
do $$
declare
  r record;
begin
  update public.tracking_funnel_daily set ad_spend = 250.00, revenue = 1800.00
  where case_file_id = 'cccccccc-0000-0000-0000-000000000001' and day = '2026-07-29';

  perform app.refresh_lead_rollups('cccccccc-0000-0000-0000-000000000001', '2026-07-29');

  select * into r from public.tracking_funnel_daily
  where case_file_id = 'cccccccc-0000-0000-0000-000000000001' and day = '2026-07-29' and source = 'unattributed';

  assert r.ad_spend = 250.00, 'ad spend is owned by admin entry and must survive a rollup refresh';
  assert r.revenue = 1800.00, 'so must revenue';
  assert r.leads = 1, 'while the lead-derived columns are still recomputed';
end $$;

\echo '== rule 9: an event that resolves to no client is stored and raised =='
do $$
declare
  v jsonb;
  v_event public.ingest_event;
  v_platform jsonb;
begin
  -- A platform door: no case file of its own, so the tenant must come from the
  -- payload or not at all.
  v_platform := public.register_ingest_endpoint('gohighlevel', 'Shared GHL agency door', null);
  create temp table shared (key text, secret text);
  insert into shared values (v_platform ->> 'key', v_platform ->> 'secret');

  v := public.ingest_receive(v_platform ->> 'key',
    json_build_object('type','ContactCreate','webhookId','wh-orphan-1','locationId','loc-nobody',
      'contact', json_build_object('id','contact-orphan'))::text,
    v_platform ->> 'secret');
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  select * into v_event from public.ingest_event where id = (v ->> 'event_id')::uuid;
  assert v_event.status = 'unattributed', format('expected unattributed, got %s', v_event.status);
  assert v_event.case_file_id is null, 'the tenant is not guessed';
  assert v_event.raw_body is not null, 'and the payload is kept';
  assert exists (select 1 from public.owner_alert where kind = 'ingest.unattributed'),
    'the admin is told rather than the event being dropped';
  assert (select count(*) from public.lead where external_id = 'contact-orphan') = 0,
    'nothing is written against a client until one is known';
end $$;

\echo '== mapping the account resolves the backlog =='
do $$
declare
  v_replayed integer;
begin
  v_replayed := public.map_ingest_account('gohighlevel', 'loc-nobody', 'cccccccc-0000-0000-0000-000000000001', 'Northside second location');

  assert v_replayed = 1, format('expected one queued event replayed, got %s', v_replayed);
  assert (select status from public.ingest_event where external_event_id = 'wh-orphan-1') = 'processed';
  assert (select case_file_id from public.lead where external_id = 'contact-orphan') = 'cccccccc-0000-0000-0000-000000000001',
    'the lead lands once the mapping exists';
end $$;

\echo '== rule 6: an unknown type is stored and surfaced =='
do $$
declare
  d record;
  v jsonb;
begin
  select * into d from door;
  v := public.ingest_receive(d.key,
    json_build_object('type','SomethingNewInGHL','webhookId','wh-unknown-1','locationId','loc-northside')::text,
    d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  assert (select status from public.ingest_event where id = (v ->> 'event_id')::uuid) = 'unknown_type';
  assert (select error from public.ingest_event where id = (v ->> 'event_id')::uuid) like '%SomethingNewInGHL%',
    'the error names the type so the missing handler is obvious';
  assert exists (select 1 from public.owner_alert where kind = 'ingest.unknown_type');
end $$;

\echo '== section 12: a body that is not JSON is logged, not dropped =='
do $$
declare
  d record;
  v jsonb;
  v_event public.ingest_event;
begin
  select * into d from door;
  v := public.ingest_receive(d.key, '{"type":"ContactCreate", this is not json', d.secret);

  select * into v_event from public.ingest_event where id = (v ->> 'event_id')::uuid;
  assert v_event.status = 'failed', 'a parse failure is visible';
  assert v_event.payload is null, 'there is no parsed payload to pretend with';
  assert v_event.raw_body = '{"type":"ContactCreate", this is not json',
    'but the body is on record exactly as it arrived, so it can be replayed';
  assert exists (select 1 from public.owner_alert where kind = 'ingest.unparseable');
end $$;

\echo '== the payload is immutable, the outcome is not =='
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.ingest_event where external_event_id = 'wh-lead-1';

  begin
    update public.ingest_event set raw_body = 'tampered' where id = v_id;
    raise exception 'the raw body should not be rewritable';
  exception when sqlstate '23514' then null;
  end;

  begin
    update public.ingest_event set payload = '{}'::jsonb where id = v_id;
    raise exception 'the payload should not be rewritable';
  exception when sqlstate '23514' then null;
  end;

  begin
    delete from public.ingest_event where id = v_id;
    raise exception 'deliveries should not be deletable';
  exception when sqlstate '23514' then null;
  end;

  -- Reprocessing is allowed to write a status.
  update public.ingest_event set status = 'received' where id = v_id;
  update public.ingest_event set status = 'processed' where id = v_id;
end $$;

\echo '== a booking arrives and is credited once =='
do $$
declare
  d record;
  v jsonb;
  v_body text;
  v_lead public.lead;
begin
  select * into d from door;

  v_body := json_build_object(
    'type', 'AppointmentCreate', 'webhookId', 'wh-appt-1', 'locationId', 'loc-northside',
    'contactId', 'contact-1',
    'contact', json_build_object('id','contact-1','name','Ruth Ellis','email','ruth@example.com','phone','+1 (312) 555-0101'),
    'appointment', json_build_object('id','appt-1','startTime','2026-07-30T14:00:00Z')
  )::text;

  v := public.ingest_receive(d.key, v_body, d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  assert (select count(*) from public.booking where external_ref = 'appt-1') = 1;
  assert (select state from public.booking where external_ref = 'appt-1') = 'system_only',
    'ingested with no claim against it is system-only and auto-credited';
  assert (select public.booking_is_creditable(state, source, matched_booking_id)
          from public.booking where external_ref = 'appt-1') = true;

  select * into v_lead from public.lead where external_id = 'contact-1';
  assert v_lead.first_booking_at = '2026-07-30T14:00:00Z', 'the lead records its first booking';
  assert (select lead_id from public.booking where external_ref = 'appt-1') = v_lead.id,
    'and the booking points back at the lead';
end $$;

\echo '== an AppointmentUpdate about the same appointment does not create a second booking =='
do $$
declare
  d record;
  v jsonb;
begin
  select * into d from door;

  v := public.ingest_receive(d.key,
    json_build_object('type','AppointmentUpdate','webhookId','wh-appt-1-upd','locationId','loc-northside',
      'contactId','contact-1',
      'appointment', json_build_object('id','appt-1','startTime','2026-07-30T15:30:00Z'))::text,
    d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  assert (select count(*) from public.booking where external_ref = 'appt-1') = 1,
    'one appointment, one booking, however many events describe it';
  assert (select scheduled_for from public.booking where external_ref = 'appt-1') = '2026-07-30T15:30:00Z',
    'but the reschedule is reflected';
end $$;

\echo '== section 12: GHL was down, the operator logged manually, ingestion resumes =='
do $$
declare
  d record;
  v jsonb;
  v_claim uuid;
  v_ghl uuid;
begin
  select * into d from door;

  -- The operator claims a booking taken over the phone. Counts toward nothing.
  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for, source, state,
    customer_name, customer_phone, customer_email, operator_note
  )
  values (
    '22222222-3333-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
    '11111111-2222-0000-0000-000000000001', '2026-08-03T16:00:00Z', 'manual', 'pending_review',
    'Marcus Boateng', null, 'marcus@example.com', 'Booked on the phone while GHL was down'
  )
  returning id into v_claim;

  assert (select public.booking_is_creditable(state, source, matched_booking_id) from public.booking where id = v_claim) = false,
    'a pending claim counts toward nothing';

  -- Ingestion resumes and the event for that appointment lands.
  v := public.ingest_receive(d.key,
    json_build_object('type','AppointmentCreate','webhookId','wh-appt-2','locationId','loc-northside',
      'contactId','contact-2',
      'contact', json_build_object('id','contact-2','name','Marcus Boateng','email','Marcus@example.com'),
      'appointment', json_build_object('id','appt-2','startTime','2026-08-03T16:45:00Z'))::text,
    d.secret);
  perform public.ingest_process((v ->> 'event_id')::uuid, v ->> 'process_token');

  select id into v_ghl from public.booking where external_ref = 'appt-2';

  assert (select state from public.booking where id = v_claim) = 'confirmed',
    'reconciliation on resume auto-confirms the claim';
  assert (select matched_booking_id from public.booking where id = v_claim) = v_ghl,
    'and records which ingested event confirmed it';

  -- One appointment, one credit.
  assert (select count(*) from public.booking b
          where b.scheduled_for between '2026-08-03T00:00:00Z' and '2026-08-04T00:00:00Z'
            and public.booking_is_creditable(b.state, b.source, b.matched_booking_id)) = 1,
    'money moves once for one appointment, not twice';
end $$;

\echo '== a claim with no matching event stays pending and inert =='
do $$
declare
  v_claim uuid;
begin
  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for, source, state, customer_name, customer_email
  )
  values (
    '22222222-3333-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
    '11111111-2222-0000-0000-000000000001', '2026-08-10T11:00:00Z', 'manual', 'pending_review',
    'Nobody Atall', 'nobody@example.com'
  )
  returning id into v_claim;

  perform app.reconcile_booking_claims('22222222-3333-0000-0000-000000000001');

  assert (select state from public.booking where id = v_claim) = 'pending_review',
    'no matching event means it stays pending';
  assert (select public.booking_is_creditable(state, source, matched_booking_id) from public.booking where id = v_claim) = false,
    'visible but inert';
end $$;

\echo '== a signed payments door, and money on a confirmed invoice =='
do $$
declare
  v jsonb;
  v_key text;
  v_secret text;
  v_invoice uuid;
  v_body text;
  v_sig text;
  v_res jsonb;
begin
  v := public.register_ingest_endpoint('payments', 'Processor platform door', null, 'hmac_sha256');
  v_key := v ->> 'key';
  v_secret := v ->> 'secret';

  insert into public.invoice (id, case_file_id, number, status, charge_type, subtotal, total, issued_at)
  values ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
          'DA-1001', 'issued', 'retainer', 2500, 2500, now())
  returning id into v_invoice;

  v_body := json_build_object(
    'id', 'evt_pay_1', 'type', 'payment_intent.succeeded',
    'data', json_build_object('object', json_build_object(
      'id', 'pi_123', 'amount_received', 250000,
      'metadata', json_build_object('vistrial_invoice_id', v_invoice::text)
    ))
  )::text;

  -- Wrong signature first.
  assert (public.ingest_receive(v_key, v_body, null, 'deadbeef', '1780000000') ->> 'ok')::boolean = false,
    'a bad signature must be refused';
  assert exists (select 1 from public.ingest_auth_failure where reason = 'bad_signature');

  -- Correctly signed over "<timestamp>.<body>".
  v_sig := encode(extensions.hmac('1780000000.' || v_body, v_secret, 'sha256'), 'hex');
  v_res := public.ingest_receive(v_key, v_body, null, v_sig, '1780000000');
  perform public.ingest_process((v_res ->> 'event_id')::uuid, v_res ->> 'process_token');

  assert (select status from public.ingest_event where id = (v_res ->> 'event_id')::uuid) = 'processed',
    format('payment event should process, error was: %s',
           (select error from public.ingest_event where id = (v_res ->> 'event_id')::uuid));
  assert (select case_file_id from public.ingest_event where id = (v_res ->> 'event_id')::uuid)
    = 'cccccccc-0000-0000-0000-000000000001',
    'the tenant came from the invoice the payment referenced, not from a guess';
  assert (select status from public.invoice where id = v_invoice) = 'paid';
  assert (select count(*) from public.revenue_record where invoice_id = v_invoice) = 1;
  assert (select amount from public.revenue_record where invoice_id = v_invoice) = 2500.00,
    'minor units are converted';
end $$;

\echo '== a payment naming no invoice is refused, never applied by amount =='
do $$
declare
  v jsonb;
  v_key text;
  v_secret text;
  v_body text;
  v_res jsonb;
begin
  select e.key into v_key from public.ingest_endpoint e where e.label = 'Processor platform door';
  select decrypted_secret into v_secret from vault.decrypted_secrets s
  join public.ingest_endpoint e on e.signing_secret_id = s.id where e.key = v_key;

  v_body := json_build_object(
    'id', 'evt_pay_2', 'type', 'payment_intent.succeeded',
    'data', json_build_object('object', json_build_object('id', 'pi_999', 'amount_received', 250000,
      'metadata', json_build_object('vistrial_invoice_id', 'DA-NOPE')))
  )::text;

  v_res := public.ingest_receive(v_key, v_body, null,
    encode(extensions.hmac(v_body, v_secret, 'sha256'), 'hex'));
  perform public.ingest_process((v_res ->> 'event_id')::uuid, v_res ->> 'process_token');

  -- No invoice reference resolves, so there is no tenant and nothing is applied.
  assert (select status from public.ingest_event where id = (v_res ->> 'event_id')::uuid) = 'unattributed',
    'an unrecognised invoice reference is surfaced, not matched on amount';
end $$;

\echo '== the backlog drains if the process call never arrives =='
-- Two transactions on purpose: the delivery is acknowledged in one and swept up
-- in another, which is the shape of the real failure.
do $$
declare
  d record;
  v jsonb;
begin
  select * into d from door;
  v := public.ingest_receive(d.key,
    json_build_object('type','ContactCreate','webhookId','wh-orphaned-process','locationId','loc-northside',
      'contact', json_build_object('id','contact-dropped','dateAdded','2026-06-02T09:00:00Z'))::text,
    d.secret);

  -- The function that received it died before it could process.
  assert (select status from public.ingest_event where id = (v ->> 'event_id')::uuid) = 'received';
end $$;

do $$
declare
  v_drained integer;
begin
  -- Backdating received_at is not possible: the log is evidence. Draining with no
  -- grace period is what the admin button does.
  v_drained := app.drain_ingest_backlog(50, interval '0');

  assert v_drained >= 1, 'the sweeper should have found it';
  assert (select status from public.ingest_event where external_event_id = 'wh-orphaned-process') = 'processed',
    'acknowledging early may delay processing but must not lose it';
  assert exists (select 1 from public.lead where external_id = 'contact-dropped'),
    'and the lead lands, late rather than never';
end $$;

\echo '== replay reinterprets the same delivery, it does not create a new one =='
do $$
declare
  v_id uuid;
  v_before bigint;
begin
  select count(*) into v_before from public.ingest_event;
  select id into v_id from public.ingest_event where external_event_id = 'wh-unknown-1';

  -- The missing handler is added.
  insert into public.ingest_event_type (provider, event_type, handler, description)
  values ('gohighlevel', 'SomethingNewInGHL', 'none', 'Recognised and inert.');

  perform public.replay_ingest_event(v_id);

  assert (select status from public.ingest_event where id = v_id) = 'processed';
  assert (select count(*) from public.ingest_event) = v_before, 'replay adds no row';
  assert (select replayed_by from public.ingest_event where id = v_id) is not null, 'and is attributed';
  assert exists (select 1 from public.audit_event where action = 'ingest.replayed' and entity_id = v_id::text),
    'rule 10: the replay is in the audit log';
end $$;

\echo '== the audit log recorded the door being opened and the account mapped =='
do $$
begin
  assert exists (select 1 from public.audit_event where action = 'ingest.endpoint_registered');
  assert exists (select 1 from public.audit_event where action = 'ingest.account_mapped');
end $$;

\echo ''
\echo 'ALL INGESTION ASSERTIONS PASSED'
