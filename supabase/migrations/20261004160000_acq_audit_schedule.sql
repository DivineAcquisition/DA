-- After an acquisition application, the applicant books a 30-minute audit
-- on a tokenized page. Reminders: email at 24 hours and 2 hours, SMS at 15 minutes.

alter table public.da_leads
  add column if not exists schedule_token text,
  add column if not exists scheduled_for timestamptz,
  add column if not exists scheduled_time_zone text,
  add column if not exists ghl_appointment_id text not null default '',
  add column if not exists confirmation_email_id text not null default '',
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_2h_sent_at timestamptz,
  add column if not exists reminder_sms_sent_at timestamptz;

alter table public.da_leads
  drop constraint if exists da_leads_schedule_token_len;

alter table public.da_leads
  add constraint da_leads_schedule_token_len
  check (schedule_token is null or length(schedule_token) >= 32);

create unique index if not exists da_leads_schedule_token_uidx
  on public.da_leads (schedule_token)
  where schedule_token is not null;

create index if not exists da_leads_scheduled_for_idx
  on public.da_leads (scheduled_for)
  where scheduled_for is not null;

comment on column public.da_leads.schedule_token is
  'Public token for the post-application date and time page.';

create or replace function public.acq_resolve_schedule_token(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v public.da_leads%rowtype;
begin
  if length(v_token) < 32 then
    return null;
  end if;

  select * into v from public.da_leads where schedule_token = v_token;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'full_name', v.full_name,
    'coaching_niche', v.coaching_niche,
    'scheduled_for', v.scheduled_for,
    'time_zone', v.scheduled_time_zone,
    'meet_url', nullif(v.meet_url, '')
  );
end;
$$;

revoke all on function public.acq_resolve_schedule_token(text) from public;
grant execute on function public.acq_resolve_schedule_token(text) to anon, authenticated;

create or replace function public.acq_book_schedule_slot(
  p_token text,
  p_starts_at timestamptz,
  p_time_zone text,
  p_phone text
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
  v_phone text := btrim(coalesce(p_phone, ''));
  v_local timestamp;
  v public.da_leads%rowtype;
  v_prev text;
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if length(regexp_replace(v_phone, '\D', '', 'g')) < 7 or length(v_phone) > 40 then
    raise exception 'phone_required: enter a mobile number for the text reminder' using errcode = '22023';
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

  select * into v from public.da_leads where schedule_token = v_token for update;
  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;

  if v.scheduled_for is not null then
    return jsonb_build_object(
      'ok', true,
      'already_booked', true,
      'id', v.id,
      'email', v.email,
      'full_name', v.full_name,
      'coaching_niche', v.coaching_niche,
      'phone', v.phone,
      'ghl_contact_id', v.ghl_contact_id,
      'scheduled_for', v.scheduled_for,
      'time_zone', v.scheduled_time_zone,
      'meet_url', nullif(v.meet_url, ''),
      'calendar_event_id', nullif(v.calendar_event_id, '')
    );
  end if;

  if exists (
    select 1 from public.da_leads
    where scheduled_for is not null
      and id <> v.id
      and scheduled_for < p_starts_at + interval '30 minutes'
      and scheduled_for + interval '30 minutes' > p_starts_at
  ) then
    raise exception 'slot_taken: that time was just taken. Pick another.' using errcode = '22023';
  end if;

  v_prev := v.stage;
  update public.da_leads
     set phone = v_phone,
         scheduled_for = p_starts_at,
         scheduled_time_zone = v_tz,
         stage = 'Audit Booked',
         audit_booked_date = to_char(p_starts_at at time zone v_tz, 'YYYY-MM-DD')
   where id = v.id;

  return jsonb_build_object(
    'ok', true,
    'already_booked', false,
    'id', v.id,
    'email', v.email,
    'full_name', v.full_name,
    'coaching_niche', v.coaching_niche,
    'phone', v_phone,
    'ghl_contact_id', v.ghl_contact_id,
    'scheduled_for', p_starts_at,
    'time_zone', v_tz,
    'previous_stage', v_prev
  );
end;
$$;

revoke all on function public.acq_book_schedule_slot(text, timestamptz, text, text) from public;
grant execute on function public.acq_book_schedule_slot(text, timestamptz, text, text) to anon, authenticated;

create or replace function public.acq_attach_schedule_booking(
  p_token text,
  p_meet_url text default null,
  p_calendar_event_id text default null,
  p_ghl_appointment_id text default null,
  p_confirmation_email_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_meet text := nullif(btrim(coalesce(p_meet_url, '')), '');
begin
  if length(v_token) < 32 then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;
  if v_meet is not null and v_meet !~* '^https://' then
    raise exception 'meet_url: meeting link must be https' using errcode = '22023';
  end if;

  update public.da_leads
     set meet_url = coalesce(v_meet, meet_url),
         calendar_event_id = coalesce(nullif(btrim(coalesce(p_calendar_event_id, '')), ''), calendar_event_id),
         ghl_appointment_id = coalesce(nullif(btrim(coalesce(p_ghl_appointment_id, '')), ''), ghl_appointment_id),
         confirmation_email_id = coalesce(nullif(btrim(coalesce(p_confirmation_email_id, '')), ''), confirmation_email_id)
   where schedule_token = v_token;

  if not found then
    raise exception 'invalid_link: this booking link is not valid' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.acq_attach_schedule_booking(text, text, text, text, text) from public;
grant execute on function public.acq_attach_schedule_booking(text, text, text, text, text) to anon, authenticated;

create or replace function public.acq_release_schedule_slot(
  p_token text,
  p_starts_at timestamptz,
  p_previous_stage text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_stage text := nullif(btrim(coalesce(p_previous_stage, '')), '');
begin
  update public.da_leads
     set scheduled_for = null,
         scheduled_time_zone = null,
         audit_booked_date = '',
         stage = coalesce(v_stage, 'Step 1 Captured'),
         meet_url = '',
         calendar_event_id = '',
         ghl_appointment_id = ''
   where schedule_token = v_token
     and scheduled_for = p_starts_at;
end;
$$;

revoke all on function public.acq_release_schedule_slot(text, timestamptz, text) from public;
grant execute on function public.acq_release_schedule_slot(text, timestamptz, text) to anon, authenticated;

create or replace function public.claim_due_acq_reminders(p_limit integer default 20)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_row public.da_leads%rowtype;
  v_kind text;
  v_out jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.da_leads
    where scheduled_for is not null
      and scheduled_for > now()
      and scheduled_for <= now() + interval '24 hours'
    order by scheduled_for
    for update skip locked
  loop
    v_kind := null;
    if v_row.reminder_sms_sent_at is null
       and v_row.scheduled_for <= now() + interval '16 minutes'
       and v_row.scheduled_for > now() + interval '9 minutes' then
      v_kind := 'sms';
      update public.da_leads set reminder_sms_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_2h_sent_at is null
       and v_row.scheduled_for <= now() + interval '2 hours'
       and v_row.scheduled_for > now() + interval '90 minutes' then
      v_kind := 'email_2h';
      update public.da_leads set reminder_2h_sent_at = now() where id = v_row.id;
    elsif v_row.reminder_24h_sent_at is null
       and v_row.scheduled_for <= now() + interval '24 hours'
       and v_row.scheduled_for > now() + interval '22 hours' then
      v_kind := 'email_24h';
      update public.da_leads set reminder_24h_sent_at = now() where id = v_row.id;
    end if;

    if v_kind is not null then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'id', v_row.id,
        'kind', v_kind,
        'email', v_row.email,
        'phone', v_row.phone,
        'full_name', v_row.full_name,
        'coaching_niche', v_row.coaching_niche,
        'scheduled_for', v_row.scheduled_for,
        'time_zone', v_row.scheduled_time_zone,
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

revoke all on function public.claim_due_acq_reminders(integer) from public;
grant execute on function public.claim_due_acq_reminders(integer) to service_role;

create or replace function public.release_acq_reminder(p_id uuid, p_kind text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_kind = 'sms' then
    update public.da_leads set reminder_sms_sent_at = null where id = p_id;
  elsif p_kind = 'email_2h' then
    update public.da_leads set reminder_2h_sent_at = null where id = p_id;
  elsif p_kind = 'email_24h' then
    update public.da_leads set reminder_24h_sent_at = null where id = p_id;
  end if;
end;
$$;

revoke all on function public.release_acq_reminder(uuid, text) from public;
grant execute on function public.release_acq_reminder(uuid, text) to service_role;
