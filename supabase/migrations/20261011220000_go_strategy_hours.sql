-- Cleaning strategy sessions are Sunday, Monday, Wednesday, and Thursday
-- at 6:00, 7:00, and 18:00 in the visitor's time zone.

create or replace function public.go_book_strategy_session(
  p_full_name text,
  p_email text,
  p_phone text,
  p_show_up boolean,
  p_sms_consent boolean,
  p_email_consent boolean,
  p_starts_at timestamptz,
  p_time_zone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_tz text := btrim(coalesce(p_time_zone, ''));
  v_local timestamp;
  v_existing public.go_strategy_bookings%rowtype;
  v_id uuid;
begin
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'name: enter your full name' using errcode = '22023';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 320 then
    raise exception 'email: enter a valid email' using errcode = '22023';
  end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 10 or length(v_phone) > 20 then
    raise exception 'phone: enter a mobile number for the text reminders' using errcode = '22023';
  end if;
  if p_show_up is not true then
    raise exception 'show_up: this call needs a private, quiet place and your full attention' using errcode = '22023';
  end if;
  if p_sms_consent is not true or p_email_consent is not true then
    raise exception 'consent: check both boxes so we can send the confirmation and reminders' using errcode = '22023';
  end if;
  if p_starts_at is null or v_tz = '' then
    raise exception 'starts_at_required: pick a date and time' using errcode = '22023';
  end if;

  begin
    perform now() at time zone v_tz;
  exception
    when invalid_parameter_value then
      raise exception 'time_zone: choose a valid time zone' using errcode = '22023';
  end;

  if p_starts_at < now() + interval '15 minutes' then
    raise exception 'starts_at_past: pick a time in the future' using errcode = '22023';
  end if;
  if p_starts_at > now() + interval '60 days' then
    raise exception 'starts_at_far: pick a time within the next 60 days' using errcode = '22023';
  end if;

  v_local := p_starts_at at time zone v_tz;
  if extract(dow from v_local) not in (0, 1, 3, 4) then
    raise exception 'weekday: pick Sunday, Monday, Wednesday, or Thursday' using errcode = '22023';
  end if;
  if extract(minute from v_local) <> 0
     or floor(extract(second from v_local)) <> 0
     or extract(hour from v_local) not in (6, 7, 18) then
    raise exception 'slot: pick one of the listed times' using errcode = '22023';
  end if;

  select * into v_existing
  from public.go_strategy_bookings
  where lower(email) = v_email
    and scheduled_for > now()
  order by scheduled_for
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_booked', true,
      'id', v_existing.id,
      'email', v_existing.email,
      'full_name', v_existing.full_name,
      'phone', v_existing.phone,
      'scheduled_for', v_existing.scheduled_for,
      'time_zone', v_existing.time_zone,
      'meet_url', nullif(v_existing.meet_url, ''),
      'ghl_contact_id', nullif(v_existing.ghl_contact_id, '')
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(481516, (extract(epoch from p_starts_at))::integer);

  if exists (
    select 1 from public.go_strategy_bookings
    where scheduled_for < p_starts_at + interval '30 minutes'
      and scheduled_for + interval '30 minutes' > p_starts_at
  ) or exists (
    select 1 from public.da_leads
    where scheduled_for is not null
      and scheduled_for < p_starts_at + interval '30 minutes'
      and scheduled_for + interval '30 minutes' > p_starts_at
  ) or exists (
    select 1 from public.assessment_booking
    where cancelled_at is null
      and starts_at < p_starts_at + interval '30 minutes'
      and ends_at > p_starts_at
  ) then
    raise exception 'slot_taken: that time was just taken. Pick another.' using errcode = '22023';
  end if;

  insert into public.go_strategy_bookings (
    full_name, email, phone, show_up_commitment, sms_consent_at, email_consent_at, scheduled_for, time_zone
  ) values (
    v_name, v_email, v_phone, true, now(), now(), p_starts_at, v_tz
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'already_booked', false,
    'id', v_id,
    'email', v_email,
    'full_name', v_name,
    'phone', v_phone,
    'scheduled_for', p_starts_at,
    'time_zone', v_tz
  );
end;
$$;
