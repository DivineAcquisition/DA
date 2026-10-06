-- Cleaning-funnel strategy sessions booked on go.divineacquisition.io.
-- Confirmation email, email + SMS at 24 hours and 2 hours, SMS at 15 minutes
-- with the Google Meet link. Direct table access is closed. Booking goes
-- through the security definer functions below, matching the audit scheduler.

create table if not exists public.go_strategy_bookings (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  show_up_commitment boolean not null,
  sms_consent_at timestamptz not null,
  email_consent_at timestamptz not null,
  scheduled_for timestamptz not null,
  time_zone text not null,
  meet_url text not null default '',
  calendar_event_id text not null default '',
  ghl_contact_id text not null default '',
  confirmation_email_id text not null default '',
  reminder_24h_email_sent_at timestamptz,
  reminder_24h_sms_sent_at timestamptz,
  reminder_2h_email_sent_at timestamptz,
  reminder_2h_sms_sent_at timestamptz,
  reminder_15m_sms_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint go_strategy_bookings_name_len check (length(btrim(full_name)) between 2 and 80),
  constraint go_strategy_bookings_email_len check (position('@' in email) > 1 and length(email) <= 320),
  constraint go_strategy_bookings_phone_len check (length(phone) between 8 and 20),
  constraint go_strategy_bookings_show_up check (show_up_commitment),
  constraint go_strategy_bookings_meet_https check (meet_url = '' or meet_url ~* '^https://')
);

comment on table public.go_strategy_bookings is
  'Strategy sessions booked from the cleaning funnel. Reminders are email and SMS at 24 hours and 2 hours, and SMS at 15 minutes.';

create index if not exists go_strategy_bookings_scheduled_idx
  on public.go_strategy_bookings (scheduled_for);

create index if not exists go_strategy_bookings_email_idx
  on public.go_strategy_bookings (lower(email));

alter table public.go_strategy_bookings enable row level security;

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
  if extract(dow from v_local) in (0, 6) then
    raise exception 'weekday: pick a weekday' using errcode = '22023';
  end if;
  if extract(minute from v_local) not in (0, 30)
     or floor(extract(second from v_local)) <> 0
     or extract(hour from v_local) < 9
     or extract(hour from v_local) > 16
     or (extract(hour from v_local) = 16 and extract(minute from v_local) > 30) then
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

revoke all on function public.go_book_strategy_session(text, text, text, boolean, boolean, boolean, timestamptz, text) from public;
grant execute on function public.go_book_strategy_session(text, text, text, boolean, boolean, boolean, timestamptz, text) to anon, authenticated;

create or replace function public.go_attach_strategy_booking(
  p_id uuid,
  p_meet_url text default null,
  p_calendar_event_id text default null,
  p_ghl_contact_id text default null,
  p_confirmation_email_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meet text := nullif(btrim(coalesce(p_meet_url, '')), '');
begin
  if v_meet is not null and v_meet !~* '^https://' then
    raise exception 'meet_url: meeting link must be https' using errcode = '22023';
  end if;

  update public.go_strategy_bookings
     set meet_url = coalesce(v_meet, meet_url),
         calendar_event_id = coalesce(nullif(btrim(coalesce(p_calendar_event_id, '')), ''), calendar_event_id),
         ghl_contact_id = coalesce(nullif(btrim(coalesce(p_ghl_contact_id, '')), ''), ghl_contact_id),
         confirmation_email_id = coalesce(nullif(btrim(coalesce(p_confirmation_email_id, '')), ''), confirmation_email_id)
   where id = p_id;

  if not found then
    raise exception 'booking: this session could not be saved' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.go_attach_strategy_booking(uuid, text, text, text, text) from public;
grant execute on function public.go_attach_strategy_booking(uuid, text, text, text, text) to anon, authenticated, service_role;

create or replace function public.go_release_strategy_booking(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.go_strategy_bookings
   where id = p_id
     and meet_url = '';
end;
$$;

revoke all on function public.go_release_strategy_booking(uuid) from public;
grant execute on function public.go_release_strategy_booking(uuid) to anon, authenticated;

create or replace function public.claim_due_go_reminders(p_limit integer default 20)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_row public.go_strategy_bookings%rowtype;
  v_kind text;
  v_out jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.go_strategy_bookings
    where scheduled_for > now()
      and scheduled_for <= now() + interval '24 hours'
    order by scheduled_for
    for update skip locked
  loop
    v_kind := null;
    if v_row.reminder_15m_sms_sent_at is null
       and v_row.scheduled_for <= now() + interval '16 minutes'
       and v_row.scheduled_for > now() + interval '9 minutes' then
      v_kind := 'sms_15m';
      update public.go_strategy_bookings set reminder_15m_sms_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_2h_email_sent_at is null
       and v_row.scheduled_for <= now() + interval '2 hours'
       and v_row.scheduled_for > now() + interval '90 minutes' then
      v_kind := 'email_2h';
      update public.go_strategy_bookings set reminder_2h_email_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_2h_sms_sent_at is null
       and v_row.scheduled_for <= now() + interval '2 hours'
       and v_row.scheduled_for > now() + interval '90 minutes' then
      v_kind := 'sms_2h';
      update public.go_strategy_bookings set reminder_2h_sms_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_24h_email_sent_at is null
       and v_row.scheduled_for <= now() + interval '24 hours'
       and v_row.scheduled_for > now() + interval '22 hours' then
      v_kind := 'email_24h';
      update public.go_strategy_bookings set reminder_24h_email_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_24h_sms_sent_at is null
       and v_row.scheduled_for <= now() + interval '24 hours'
       and v_row.scheduled_for > now() + interval '22 hours' then
      v_kind := 'sms_24h';
      update public.go_strategy_bookings set reminder_24h_sms_sent_at = now() where id = v_row.id;
    end if;

    if v_kind is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_row.id,
        'kind', v_kind,
        'email', v_row.email,
        'phone', v_row.phone,
        'full_name', v_row.full_name,
        'scheduled_for', v_row.scheduled_for,
        'time_zone', v_row.time_zone,
        'meet_url', nullif(v_row.meet_url, ''),
        'ghl_contact_id', nullif(v_row.ghl_contact_id, '')
      ));
      v_count := v_count + 1;
      exit when v_count >= v_limit;
    end if;
  end loop;

  return v_out;
end;
$$;

revoke all on function public.claim_due_go_reminders(integer) from public;
grant execute on function public.claim_due_go_reminders(integer) to service_role;

create or replace function public.release_go_reminder(p_id uuid, p_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_kind = 'sms_15m' then
    update public.go_strategy_bookings set reminder_15m_sms_sent_at = null where id = p_id;
  elsif p_kind = 'email_2h' then
    update public.go_strategy_bookings set reminder_2h_email_sent_at = null where id = p_id;
  elsif p_kind = 'sms_2h' then
    update public.go_strategy_bookings set reminder_2h_sms_sent_at = null where id = p_id;
  elsif p_kind = 'email_24h' then
    update public.go_strategy_bookings set reminder_24h_email_sent_at = null where id = p_id;
  elsif p_kind = 'sms_24h' then
    update public.go_strategy_bookings set reminder_24h_sms_sent_at = null where id = p_id;
  end if;
end;
$$;

revoke all on function public.release_go_reminder(uuid, text) from public;
grant execute on function public.release_go_reminder(uuid, text) to service_role;
