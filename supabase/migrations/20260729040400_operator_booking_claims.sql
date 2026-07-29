-- ---------------------------------------------------------------------------
-- Operator submissions: the manual booking claim.
--
-- Two problems, and they are the same problem.
--
-- First, an operator could not log a booking at all. `booking` has an admin
-- policy and an operator *read* policy, and nothing else, so every claim an
-- operator submitted was refused by RLS. The door the specification describes —
-- GoHighLevel goes down, operators keep working and log manually, claims queue as
-- pending — was closed.
--
-- Second, the hub decided for itself whether a claim was confirmed, in TypeScript,
-- matching on phone or name. The ingestion handler decides the same thing in SQL,
-- on email as well, and settles both sides of the pair. Two implementations of the
-- rule that decides whether an operator gets paid is precisely the drift this
-- platform exists to prevent.
--
-- One function fixes both. It is the only way a claim can be created, so the rules
-- that make a claim safe cannot be bypassed: the source is always manual, the
-- state is always pending, the placement must be the caller's own, and the match
-- is run by app.reconcile_booking_claims() — the same matcher ingestion uses.
-- ---------------------------------------------------------------------------

create or replace function public.claim_booking(
  p_placement_id uuid,
  p_customer_name text,
  p_scheduled_for timestamptz,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_operator_note text default null
)
returns public.booking
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_placement public.placement;
  v_allowed boolean;
  v_claim public.booking;
begin
  select * into v_placement from public.placement where id = p_placement_id;

  if v_placement.id is null then
    raise exception 'placement_not_found: that placement no longer exists' using errcode = 'P0002';
  end if;

  select app.is_admin()
      or exists (
        select 1 from public.operator o
        where o.id = v_placement.operator_id and o.profile_id = auth.uid()
      )
    into v_allowed;

  if not coalesce(v_allowed, false) then
    raise exception 'not_your_placement: a booking can only be claimed by the operator on the placement, or by an admin'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_customer_name, '')) = '' then
    raise exception 'customer_name_required: a claim with no customer cannot be matched against anything'
      using errcode = '23514';
  end if;

  if p_scheduled_for is null then
    raise exception 'appointment_time_required' using errcode = '23514';
  end if;

  -- The operator does not choose either of these. A claim is a claim: it is
  -- visible, it counts toward nothing, and only the matcher below or an admin
  -- review can make it count.
  insert into public.booking (
    placement_id, case_file_id, operator_id, scheduled_for,
    source, state, customer_name, customer_phone, customer_email, operator_note
  )
  values (
    v_placement.id, v_placement.case_file_id, v_placement.operator_id, p_scheduled_for,
    'manual', 'pending_review',
    btrim(p_customer_name),
    nullif(btrim(coalesce(p_customer_phone, '')), ''),
    lower(nullif(btrim(coalesce(p_customer_email, '')), '')),
    nullif(btrim(coalesce(p_operator_note, '')), '')
  )
  returning * into v_claim;

  perform app.reconcile_booking_claims(v_placement.id);

  select * into v_claim from public.booking where id = v_claim.id;

  perform app.audit('booking.claimed', 'booking', v_claim.id::text,
    format('Claimed a booking for %s at %s, %s',
           v_claim.customer_name, v_claim.scheduled_for,
           case when v_claim.state = 'confirmed'
                then 'confirmed against an ingested event'
                else 'pending review' end),
    null,
    jsonb_build_object('state', v_claim.state, 'matched_booking_id', v_claim.matched_booking_id),
    v_placement.case_file_id);

  return v_claim;
end;
$$;

comment on function public.claim_booking is
  'The only way a manual booking claim is created. Source and state are not the caller''s to choose, and the match runs through app.reconcile_booking_claims() so the hub and ingestion cannot disagree about who gets paid.';

revoke all on function public.claim_booking(uuid, text, timestamptz, text, text, text) from anon;
