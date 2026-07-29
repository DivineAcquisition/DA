-- Rule 7: scope and role filter at the data layer, never in the interface.
-- Everything below runs as the `authenticated` role, which is what PostgREST
-- uses, so the policies are actually in force rather than being bypassed by
-- table ownership.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== a second client, and accounts for both =='
do $$
declare
  v_other uuid;
begin
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

  insert into public.client_case_file (id, name, slug, status)
  values ('cccccccc-0000-0000-0000-000000000002', 'Southbank Physio', 'southbank-physio', 'active')
  returning id into v_other;

  -- A lead for the other client, so cross-tenant reads have something to leak.
  insert into public.lead (case_file_id, external_id, name, email, lead_in_at)
  values (v_other, 'other-contact-1', 'Someone Else', 'someone@southbank.test', '2026-07-29T10:00:00Z');

  -- Client user bound to Northside.
  insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-000000000001', 'client@northside.test');
  update public.profile set role = 'client', state = 'active' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  insert into public.client_account (profile_id, case_file_id, full_name, state, is_primary)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'Dr Northside', 'active', true);

  -- The operator on the Northside placement.
  insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-000000000002', 'joy@example.com');
  update public.profile set role = 'operator', state = 'active' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  update public.operator set profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'
   where id = '11111111-2222-0000-0000-000000000001';

  -- An operator with no placement here at all.
  insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-000000000003', 'other-op@example.com');
  update public.profile set role = 'operator', state = 'active' where id = 'bbbbbbbb-0000-0000-0000-000000000003';
  insert into public.operator (id, profile_id, name, email, status)
  values ('11111111-2222-0000-0000-000000000009', 'bbbbbbbb-0000-0000-0000-000000000003', 'Idle Operator', 'idle@example.com', 'on_bench');
end $$;

\echo '== a client reads their own leads and no others =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', false); end $$;

do $$
begin
  assert (select count(*) from public.lead) >= 1, 'the client can read their own leads';
  assert (select count(*) from public.lead where case_file_id <> 'cccccccc-0000-0000-0000-000000000001') = 0,
    'and cannot see another client''s leads, because the query cannot return them';
  assert (select count(*) from public.lead_stage_event
          where case_file_id <> 'cccccccc-0000-0000-0000-000000000001') = 0;
end $$;

\echo '== a client cannot see the ingestion machinery at all =='
do $$
begin
  assert (select count(*) from public.ingest_event) = 0,
    'the delivery log is not a client surface';
  assert (select count(*) from public.ingest_endpoint) = 0,
    'and neither are the door credentials';
  assert (select count(*) from public.rollup_cache) = 0,
    'nor the cross-client rollup';
end $$;

\echo '== a client cannot write a first-touch stamp =='
do $$
begin
  begin
    update public.lead set first_touch_at = now() where case_file_id = 'cccccccc-0000-0000-0000-000000000001';
    -- RLS gives a client select only, so the update matches no rows rather than
    -- raising. Either way nothing moved.
    assert (select first_touch_at from public.lead where external_id = 'contact-1') = '2026-07-29T09:04:30Z',
      'a client write must not reach the lead';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== the placed operator reads their own leads, not the other client''s =='
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
begin
  assert (select count(*) from public.lead) >= 1, 'the operator sees the leads on their placement';
  assert (select count(*) from public.lead where case_file_id <> 'cccccccc-0000-0000-0000-000000000001') = 0,
    'and nothing about a client they are not placed with';
  assert (select count(*) from public.lead_touch) >= 2, 'including the touches they are measured on';
  assert (select count(*) from public.ingest_endpoint) = 0, 'and no credentials';
end $$;

\echo '== an operator with no placement here sees nothing =='
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000003', false); end $$;

do $$
begin
  assert (select count(*) from public.lead) = 0,
    'no placement, no leads. Scope is enforced by the policy, not by what a page chooses to render';
  assert (select count(*) from public.lead_touch) = 0;
end $$;

\echo '== anon reaches none of it =='
reset role;
set role anon;
do $$ begin perform set_config('request.jwt.claim.sub', '', false); end $$;

do $$
begin
  begin
    perform count(*) from public.ingest_event;
    raise exception 'anon should have no grant on the delivery log';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform count(*) from public.lead;
    raise exception 'anon should have no grant on leads';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.rollup('cross_client');
    raise exception 'anon should not be able to read a rollup';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== but anon can still knock on a door, which is the whole point =='
do $$
declare
  v jsonb;
begin
  -- Unauthenticated by design: a webhook arrives with no session, and the door's
  -- secret is what authorises it. A wrong secret gets nothing.
  v := public.ingest_receive('0000000000000000000000000000000000000000', '{}', 'wrong');
  assert (v ->> 'ok')::boolean = false;
end $$;

reset role;

\echo ''
\echo 'ALL RLS ASSERTIONS PASSED'
