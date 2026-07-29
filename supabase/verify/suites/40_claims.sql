-- Operator submissions. The claim path was closed by RLS before claim_booking()
-- existed, and the state a claim lands in is decided by one matcher.
\set ON_ERROR_STOP on
set search_path = public;

\echo '== the operator on the placement can claim, and RLS no longer refuses =='
set role authenticated;
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false); end $$;

do $$
declare
  v_claim public.booking;
begin
  -- Before claim_booking() this insert was refused: booking has an admin policy
  -- and an operator read policy, and no operator insert policy at all.
  begin
    insert into public.booking (
      placement_id, case_file_id, operator_id, scheduled_for, source, state, customer_name
    ) values (
      '22222222-3333-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
      '11111111-2222-0000-0000-000000000001', now(), 'manual', 'pending_review', 'Direct Insert'
    );
    raise exception 'an operator should not be able to write the booking table directly';
  exception when sqlstate '42501' then null;
  end;

  -- Matching on email alone, which is the arm that was unreachable while the
  -- booking table carried no email column.
  v_claim := public.claim_booking(
    '22222222-3333-0000-0000-000000000001',
    'Ruth Ellis',
    '2026-07-30T15:00:00Z',
    null,
    'RUTH@example.com',
    'Confirmed the slot on the phone'
  );

  assert v_claim.source = 'manual', 'the caller does not choose the source';
  assert v_claim.customer_email = 'ruth@example.com', 'the email is normalised';
  assert v_claim.state = 'confirmed', 'it matched the ingested appointment on email';
  assert v_claim.matched_booking_id = (select id from public.booking where external_ref = 'appt-1'),
    'and points at the ingested booking that evidenced it';

  -- One appointment, one credit, whichever way it was recorded.
  assert (select count(*) from public.booking b
          where (b.external_ref = 'appt-1' or b.id = v_claim.id)
            and public.booking_is_creditable(b.state, b.source, b.matched_booking_id)) = 1,
    'the pair exists as two rows, but only one of them is creditable';
end $$;

\echo '== a claim nothing evidences stays pending and inert =='
do $$
declare
  v_claim public.booking;
begin
  v_claim := public.claim_booking(
    '22222222-3333-0000-0000-000000000001',
    'Never Happened',
    '2026-09-01T10:00:00Z',
    '+1 415 555 9999',
    null,
    'Taken on the phone'
  );

  assert v_claim.state = 'pending_review', 'no matching event means pending';
  assert public.booking_is_creditable(v_claim.state, v_claim.source, v_claim.matched_booking_id) = false,
    'visible, and counted toward nothing';
end $$;

\echo '== an operator cannot claim against somebody else''s placement =='
do $$ begin perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000003', false); end $$;
do $$
begin
  begin
    perform public.claim_booking('22222222-3333-0000-0000-000000000001', 'Not Mine', now());
    raise exception 'an operator with no claim on this placement should be refused';
  exception when sqlstate '42501' then null;
  end;
end $$;

\echo '== an admin can claim on any placement, and every claim is audited =='
reset role;
do $$ begin perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false); end $$;
do $$
begin
  perform public.claim_booking('22222222-3333-0000-0000-000000000001', 'Admin Entered', '2026-09-02T10:00:00Z');

  assert (select count(*) from public.audit_event where action = 'booking.claimed') = 3,
    'rule 10: every claim writes one audit entry';
end $$;

\echo ''
\echo 'ALL CLAIM ASSERTIONS PASSED'
