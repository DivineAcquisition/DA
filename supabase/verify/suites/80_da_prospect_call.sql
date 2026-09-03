-- DA prospect call door: events land here, then the app sends them to Airtable.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== fixtures: admin session and a pipeline-call door secret =='
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

update public.da_settings
   set pipeline_call_webhook_secret = 'pipeline-door-secret'
 where id = 1;

\echo '== an admin-logged phone touch is a row, not an Airtable write =='
do $$
declare
  r jsonb;
begin
  r := public.da_record_prospect_call(jsonb_build_object(
    'airtable_lead_id', 'recbhuwRMsnk618TH',
    'email', 'Won@Example.COM',
    'full_name', 'TEST - Closed Won (DM)',
    'kind', 'phone',
    'source', 'operator',
    'occurred_at', '2026-09-03T15:00:00Z',
    'payload', jsonb_build_object('channel', 'Call', 'summary', 'Left voicemail')
  ));

  assert r->>'kind' = 'phone';
  assert r->>'email' = 'won@example.com',
    'email is stored lowercased so GHL matching cannot miss on case';
  assert r->>'airtable_lead_id' = 'recbhuwRMsnk618TH';
  assert r->>'airtable_synced_at' is null,
    'ingress does not pretend the Airtable send already happened';
  assert (r->'payload'->>'summary') = 'Left voicemail';
end $$;

\echo '== a GHL appointment create+update is one row =='
do $$
declare
  first jsonb;
  second jsonb;
begin
  first := public.da_record_prospect_call(jsonb_build_object(
    'kind', 'booking',
    'source', 'ghl',
    'external_ref', 'apt-1001',
    'email', 'booked@example.com',
    'full_name', 'Booked Prospect',
    'meet_url', 'https://meet.google.com/aaa-bbbb-ccc',
    'occurred_at', '2026-09-04T18:00:00Z'
  ));

  second := public.da_record_prospect_call(jsonb_build_object(
    'kind', 'booking',
    'source', 'ghl',
    'external_ref', 'apt-1001',
    'meet_url', 'https://meet.google.com/aaa-bbbb-ccc',
    'recording_url', 'https://drive.google.com/file/d/rec1',
    'occurred_at', '2026-09-04T18:30:00Z'
  ));

  assert first->>'id' = second->>'id',
    'the same GHL appointment is not a second call';
  assert (select count(*) from public.da_prospect_call where external_ref = 'apt-1001') = 1;
  assert second->>'recording_url' = 'https://drive.google.com/file/d/rec1',
    'an update fills fields the create did not have';
end $$;

\echo '== sending to Airtable stamps the downstream ids and can record a failure =='
do $$
declare
  v_id uuid;
  ok jsonb;
  failed jsonb;
begin
  select id into v_id from public.da_prospect_call where external_ref = 'apt-1001';

  ok := public.da_mark_prospect_call_airtable(
    v_id, 'recbhuwRMsnk618TH', null, null, null
  );
  assert ok->>'airtable_lead_id' = 'recbhuwRMsnk618TH';
  assert ok->>'airtable_synced_at' is not null;
  assert ok->>'airtable_sync_error' is null;

  failed := public.da_mark_prospect_call_airtable(
    v_id, null, null, null, 'Airtable 422: UNKNOWN_FIELD_NAME'
  );
  assert failed->>'airtable_sync_error' = 'Airtable 422: UNKNOWN_FIELD_NAME',
    'a failed send is stored so cron can retry';
  assert failed->>'airtable_synced_at' is not null,
    'a later error does not erase that a send was attempted';
end $$;

\echo '== the machine door authenticates before it writes =='
set role anon;
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;

do $$
begin
  begin
    perform public.da_receive_prospect_call(
      'wrong-secret',
      '{"kind":"booking","source":"ghl","external_ref":"apt-denied"}'::jsonb
    );
    raise exception 'a wrong secret must not create a call';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    perform count(*) from public.da_prospect_call;
    raise exception 'anon should have no grant on prospect calls';
  exception when sqlstate '42501' then null;
  end;
end $$;

do $$
declare
  r jsonb;
begin
  r := public.da_receive_prospect_call(
    'pipeline-door-secret',
    '{"kind":"booking","source":"ghl","external_ref":"apt-inbound","email":"in@example.com","meet_url":"https://meet.google.com/in-bound-url"}'::jsonb
  );
  assert r->>'external_ref' = 'apt-inbound';
  assert r->>'email' = 'in@example.com';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

do $$
begin
  assert exists (select 1 from public.da_prospect_call where external_ref = 'apt-inbound'),
    'a authorised GHL delivery is the row the app will send to Airtable';
  assert not exists (select 1 from public.da_prospect_call where external_ref = 'apt-denied');
end $$;

\echo '== an operator cannot log DA sales calls =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  begin
    perform public.da_record_prospect_call(
      '{"kind":"phone","source":"operator"}'::jsonb
    );
    raise exception 'an operator must not write DA prospect calls';
  exception when insufficient_privilege then null;
  end;

  assert (select count(*) from public.da_prospect_call) = 0,
    'RLS hides every DA sales call from an operator';
end $$;

reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== listing is by Airtable lead id, and junk ids return nothing rather than erroring =='
do $$
begin
  assert (
    select count(*) from public.da_list_prospect_calls('recbhuwRMsnk618TH')
  ) >= 1;
  assert not exists (select 1 from public.da_list_prospect_calls('not-a-record'));
  assert exists (select 1 from public.da_list_unsynced_prospect_calls(10));
end $$;

\echo ''
\echo 'ALL DA PROSPECT CALL ASSERTIONS PASSED'
