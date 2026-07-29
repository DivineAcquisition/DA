\set ON_ERROR_STOP on
set search_path = public;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;

\echo '== a rollup that was never computed reads as stale, not as zero =='
do $$
declare
  v jsonb;
begin
  v := public.rollup('cross_client');
  assert (v ->> 'never_computed')::boolean = true;
  assert (v ->> 'stale')::boolean = true, 'a missing cache is not a fresh zero';
  assert v -> 'payload' = 'null'::jsonb, 'and there is no payload to render';
  assert v ->> 'computed_at' is null;
end $$;

\echo '== once computed it is fresh, and carries when =='
do $$
declare
  v jsonb;
  c jsonb;
begin
  v := app.refresh_rollup('cross_client');

  assert (v ->> 'stale')::boolean = false;
  assert (v ->> 'never_computed')::boolean = false;
  assert v ->> 'computed_at' is not null, 'freshness is part of the read, not optional';
  assert (v ->> 'age_seconds')::integer >= 0;
  assert (v ->> 'fresh_for_seconds')::integer = 900;

  c := (v -> 'payload' -> 'clients' -> 0);
  assert c ->> 'name' = 'Northside Dental', format('expected the seeded client, got %s', c ->> 'name');
  assert (c ->> 'leads')::integer >= 1, 'leads are read from the lead table';
  assert (c ->> 'bookings_credited')::integer = 2,
    format('two appointments credited once each, got %s', c ->> 'bookings_credited');
  assert (c ->> 'claims_pending')::integer = 1, 'the unmatched claim is counted as pending';
  assert (c ->> 'revenue_collected')::numeric = 2500.00, 'collected revenue comes from revenue_record';
  assert c ->> 'last_ingest_at' is not null, 'and the rollup says when data last arrived';
end $$;

\echo '== a pending claim contributes to nothing but the pending count =='
do $$
declare
  v jsonb;
  c jsonb;
  v_before integer;
begin
  v := public.rollup('cross_client');
  v_before := ((v -> 'payload' -> 'clients' -> 0) ->> 'bookings_credited')::integer;

  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for, source, state, customer_name, customer_email
  ) values (
    '22222222-3333-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
    '11111111-2222-0000-0000-000000000001', now(), 'manual', 'pending_review', 'Claim Only', 'claim@example.com'
  );

  v := app.refresh_rollup('cross_client');
  c := v -> 'payload' -> 'clients' -> 0;

  assert (c ->> 'bookings_credited')::integer = v_before,
    'money moves only on confirmed bookings, so a claim changes no credited figure';
  assert (c ->> 'claims_pending')::integer = 2, 'but it is visible';
end $$;

\echo '== staleness is reported once the window passes =='
do $$
declare
  v jsonb;
begin
  update public.rollup_cache set fresh_for = interval '0 seconds' where key = 'cross_client';
  perform pg_sleep(0.01);

  v := public.rollup('cross_client');
  assert (v ->> 'stale')::boolean = true, 'past its window the interface is told, not left guessing';
  assert v -> 'payload' <> 'null'::jsonb, 'the previous value is still served, labelled stale';
end $$;

\echo '== an unknown rollup key is refused rather than cached empty =='
do $$
begin
  begin
    perform app.refresh_rollup('made_up');
    raise exception 'an unknown key should have been refused';
  exception when sqlstate '22023' then null;
  end;
end $$;

\echo '== ingestion health is live and names what needs attention =='
do $$
declare
  r record;
  v_attention integer;
begin
  select coalesce(sum(unattributed + unknown_type + failed), 0) into v_attention from public.v_ingest_health;
  assert v_attention >= 1, 'the failed parse and the unresolved payment should show';

  -- Health is broken down per door and per client, so an admin can see which
  -- client stopped sending rather than only that the total dropped.
  select sum(events) as events, count(*) as rows_out into r
  from public.v_ingest_health where provider = 'payments';
  assert r.events = 2, format('two payment deliveries, got %s', r.events);
  assert r.rows_out = 2, 'the attributed and the unattributed one are reported apart';

  assert (select unattributed from public.v_ingest_health
          where provider = 'payments' and case_file_id is null) = 1,
    'and the unresolved payment is named as unattributed';
end $$;

\echo ''
\echo 'ALL ROLLUP ASSERTIONS PASSED'
