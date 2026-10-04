-- Tokenized scheduling links open an in-app date and time picker.
-- Qualifying-call /c/{token} links no longer depend on da_settings.default_booking_url.
-- Assessment invites book through the same slot rules instead of an external widget.

alter table public.calls
  add column if not exists scheduled_for timestamptz,
  add column if not exists scheduled_time_zone text,
  add column if not exists meet_url text;

alter table public.hs_calls
  add column if not exists scheduled_for timestamptz,
  add column if not exists scheduled_time_zone text,
  add column if not exists meet_url text;

alter table public.calls
  drop constraint if exists calls_meet_url_https,
  add constraint calls_meet_url_https check (meet_url is null or meet_url ~* '^https://');

alter table public.hs_calls
  drop constraint if exists hs_calls_meet_url_https,
  add constraint hs_calls_meet_url_https check (meet_url is null or meet_url ~* '^https://');

alter table public.assessment_invite
  add column if not exists booking_id uuid references public.assessment_booking (id);

comment on column public.calls.scheduled_for is
  'When the applicant chose their 30-minute call from the tokenized link.';

comment on column public.assessment_invite.booking_id is
  'The assessment_booking created when the invitee picked a time.';

-- ---------------------------------------------------------------------------
-- Resolve /c/{token}. Recipient links still redirect. Call tokens schedule.
-- ---------------------------------------------------------------------------

create or replace function public.da_resolve_calendar_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_row public.da_calendar_link%rowtype;
  v_call public.calls%rowtype;
  v_hs public.hs_calls%rowtype;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v_row from public.da_calendar_link where token = v_token;
  if found then
    if v_row.revoked or (v_row.expires_at is not null and v_row.expires_at <= now()) then
      return null;
    end if;

    update public.da_calendar_link
       set click_count = click_count + 1,
           first_clicked_at = coalesce(first_clicked_at, now()),
           last_clicked_at = now()
     where id = v_row.id;

    return jsonb_build_object(
      'kind', 'redirect',
      'destination_url', v_row.destination_url
    );
  end if;

  select * into v_call from public.calls where calendar_token = v_token;
  if found then
    return jsonb_build_object(
      'kind', 'call',
      'contact_name', v_call.contact_name,
      'email', v_call.email,
      'organization', v_call.practice_name,
      'scheduled_for', v_call.scheduled_for,
      'time_zone', v_call.scheduled_time_zone,
      'meet_url', v_call.meet_url
    );
  end if;

  select * into v_hs from public.hs_calls where calendar_token = v_token;
  if found then
    return jsonb_build_object(
      'kind', 'hs_call',
      'contact_name', v_hs.contact_name,
      'email', v_hs.email,
      'organization', v_hs.company_name,
      'scheduled_for', v_hs.scheduled_for,
      'time_zone', v_hs.scheduled_time_zone,
      'meet_url', v_hs.meet_url
    );
  end if;

  return null;
end;
$$;

revoke all on function public.da_resolve_calendar_token(text) from public;
grant execute on function public.da_resolve_calendar_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Book a 30-minute weekday slot from a qualifying-call token.
-- ---------------------------------------------------------------------------

create or replace function public.da_book_calendar_slot(
  p_token text,
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
  v_token text := btrim(coalesce(p_token, ''));
  v_tz text := btrim(coalesce(p_time_zone, ''));
  v_local timestamp;
  v_call public.calls%rowtype;
  v_hs public.hs_calls%rowtype;
  v_kind text;
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
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

  if exists (
    select 1 from public.calls
    where scheduled_for is not null
      and calendar_token is distinct from v_token
      and scheduled_for < p_starts_at + interval '30 minutes'
      and scheduled_for + interval '30 minutes' > p_starts_at
  ) or exists (
    select 1 from public.hs_calls
    where scheduled_for is not null
      and calendar_token is distinct from v_token
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

  select * into v_call from public.calls where calendar_token = v_token for update;
  if found then
    v_kind := 'call';
    if v_call.scheduled_for is not null then
      return jsonb_build_object(
        'ok', true,
        'already_booked', true,
        'kind', v_kind,
        'contact_name', v_call.contact_name,
        'email', v_call.email,
        'organization', v_call.practice_name,
        'scheduled_for', v_call.scheduled_for,
        'time_zone', v_call.scheduled_time_zone,
        'meet_url', v_call.meet_url
      );
    end if;

    update public.calls
       set scheduled_for = p_starts_at,
           scheduled_time_zone = v_tz,
           status = 'booked',
           audit_booked_at = coalesce(audit_booked_at, now())
     where id = v_call.id;

    return jsonb_build_object(
      'ok', true,
      'already_booked', false,
      'kind', v_kind,
      'id', v_call.id,
      'contact_name', v_call.contact_name,
      'email', v_call.email,
      'organization', v_call.practice_name,
      'scheduled_for', p_starts_at,
      'time_zone', v_tz,
      'meet_url', null
    );
  end if;

  select * into v_hs from public.hs_calls where calendar_token = v_token for update;
  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if v_hs.scheduled_for is not null then
    return jsonb_build_object(
      'ok', true,
      'already_booked', true,
      'kind', 'hs_call',
      'contact_name', v_hs.contact_name,
      'email', v_hs.email,
      'organization', v_hs.company_name,
      'scheduled_for', v_hs.scheduled_for,
      'time_zone', v_hs.scheduled_time_zone,
      'meet_url', v_hs.meet_url
    );
  end if;

  update public.hs_calls
     set scheduled_for = p_starts_at,
         scheduled_time_zone = v_tz,
         status = 'booked',
         audit_booked_at = coalesce(audit_booked_at, now())
   where id = v_hs.id;

  return jsonb_build_object(
    'ok', true,
    'already_booked', false,
    'kind', 'hs_call',
    'id', v_hs.id,
    'contact_name', v_hs.contact_name,
    'email', v_hs.email,
    'organization', v_hs.company_name,
    'scheduled_for', p_starts_at,
    'time_zone', v_tz,
    'meet_url', null
  );
end;
$$;

revoke all on function public.da_book_calendar_slot(text, timestamptz, text) from public;
grant execute on function public.da_book_calendar_slot(text, timestamptz, text) to anon, authenticated;

create or replace function public.da_attach_calendar_meet(
  p_token text,
  p_meet_url text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_url text := nullif(btrim(coalesce(p_meet_url, '')), '');
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;
  if v_url is null or v_url !~* '^https://' then
    raise exception 'meet_url: meeting link must be https' using errcode = '22023';
  end if;

  update public.calls set meet_url = v_url where calendar_token = v_token;
  if found then
    return;
  end if;

  update public.hs_calls set meet_url = v_url where calendar_token = v_token;
  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.da_attach_calendar_meet(text, text) from public;
grant execute on function public.da_attach_calendar_meet(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Assessment invitees pick a time on their tokenized link.
-- ---------------------------------------------------------------------------

create or replace function public.validate_assessment_invite(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v public.assessment_invite%rowtype;
  b public.assessment_booking%rowtype;
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  select * into v
  from public.assessment_invite
  where token_hash = app.hash_token(v_token);

  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if v.revoked_at is not null then
    raise exception 'link_revoked: this booking link has been revoked' using errcode = '22023';
  end if;

  if v.expires_at <= now() and v.booking_id is null then
    raise exception 'link_expired: this booking link expired after 24 hours' using errcode = '22023';
  end if;

  if v.opened_at is null and v.expires_at > now() then
    update public.assessment_invite
       set opened_at = now()
     where id = v.id;
  end if;

  if v.booking_id is not null then
    select * into b from public.assessment_booking where id = v.booking_id;
  end if;

  return jsonb_build_object(
    'id', v.id,
    'full_name', v.full_name,
    'email', v.email,
    'company_name', v.company_name,
    'expires_at', v.expires_at,
    'used_at', v.used_at,
    'scheduled_for', b.starts_at,
    'time_zone', b.time_zone,
    'meet_url', b.google_meet_url
  );
end;
$$;

revoke all on function public.validate_assessment_invite(text) from public;
grant execute on function public.validate_assessment_invite(text) to anon, authenticated;

create or replace function public.book_assessment_from_invite(
  p_token text,
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
  v_token text := btrim(coalesce(p_token, ''));
  v_tz text := btrim(coalesce(p_time_zone, ''));
  v_local timestamp;
  v public.assessment_invite%rowtype;
  b public.assessment_booking%rowtype;
  v_id uuid;
  v_ends timestamptz;
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  select * into v
  from public.assessment_invite
  where token_hash = app.hash_token(v_token)
  for update;

  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if v.revoked_at is not null then
    raise exception 'link_revoked: this booking link has been revoked' using errcode = '22023';
  end if;

  if v.booking_id is not null then
    select * into b from public.assessment_booking where id = v.booking_id;
    return jsonb_build_object(
      'ok', true,
      'already_booked', true,
      'id', b.id,
      'email', v.email,
      'full_name', v.full_name,
      'company_name', v.company_name,
      'scheduled_for', b.starts_at,
      'time_zone', b.time_zone,
      'meet_url', b.google_meet_url
    );
  end if;

  if v.expires_at <= now() then
    raise exception 'link_expired: this booking link expired after 24 hours' using errcode = '22023';
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

  if exists (
    select 1 from public.calls
    where scheduled_for is not null
      and scheduled_for < p_starts_at + interval '30 minutes'
      and scheduled_for + interval '30 minutes' > p_starts_at
  ) or exists (
    select 1 from public.hs_calls
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

  v_ends := p_starts_at + interval '30 minutes';
  insert into public.assessment_booking (
    email, full_name, company_name, note, starts_at, ends_at, time_zone, duration_minutes
  ) values (
    v.email, v.full_name, v.company_name, v.note, p_starts_at, v_ends, v_tz, 30
  ) returning id into v_id;

  update public.assessment_invite
     set booking_id = v_id,
         used_at = coalesce(used_at, now())
   where id = v.id;

  return jsonb_build_object(
    'ok', true,
    'already_booked', false,
    'id', v_id,
    'email', v.email,
    'full_name', v.full_name,
    'company_name', v.company_name,
    'scheduled_for', p_starts_at,
    'time_zone', v_tz,
    'meet_url', null
  );
end;
$$;

revoke all on function public.book_assessment_from_invite(text, timestamptz, text) from public;
grant execute on function public.book_assessment_from_invite(text, timestamptz, text) to anon, authenticated;

create or replace function public.attach_assessment_invite_booking(
  p_token text,
  p_google_event_id text default null,
  p_google_meet_url text default null,
  p_google_html_link text default null,
  p_confirmation_email_id text default null,
  p_ghl_contact_id text default null,
  p_ghl_appointment_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_booking uuid;
  v_meet text := nullif(btrim(coalesce(p_google_meet_url, '')), '');
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if v_meet is not null and v_meet !~* '^https://' then
    raise exception 'meet_url: meeting link must be https' using errcode = '22023';
  end if;

  select booking_id into v_booking
  from public.assessment_invite
  where token_hash = app.hash_token(v_token);

  if v_booking is null then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  update public.assessment_booking
     set google_event_id = coalesce(nullif(btrim(coalesce(p_google_event_id, '')), ''), google_event_id),
         google_meet_url = coalesce(v_meet, google_meet_url),
         google_html_link = coalesce(nullif(btrim(coalesce(p_google_html_link, '')), ''), google_html_link),
         confirmation_email_id = coalesce(nullif(btrim(coalesce(p_confirmation_email_id, '')), ''), confirmation_email_id),
         ghl_contact_id = coalesce(nullif(btrim(coalesce(p_ghl_contact_id, '')), ''), ghl_contact_id),
         ghl_appointment_id = coalesce(nullif(btrim(coalesce(p_ghl_appointment_id, '')), ''), ghl_appointment_id)
   where id = v_booking
     and cancelled_at is null;
end;
$$;

revoke all on function public.attach_assessment_invite_booking(text, text, text, text, text, text, text) from public;
grant execute on function public.attach_assessment_invite_booking(text, text, text, text, text, text, text) to anon, authenticated;
