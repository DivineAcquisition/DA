-- Brings three functions in line with the hosted database, where they were
-- corrected in place:
--   acq_book_schedule_slot  keeps the schedule token on the booked lead.
--   open_work_for           drops the documents count; public.document does not exist.
--   submit_role_application falls back to the role slug, since role_title is not null.

CREATE OR REPLACE FUNCTION public.acq_book_schedule_slot(p_token text, p_starts_at timestamp with time zone, p_time_zone text, p_phone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  select * into v
  from public.da_leads
  where schedule_token = v_token
     or payload->>'scheduleToken' = v_token
  for update;
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
         audit_booked_date = to_char(p_starts_at at time zone v_tz, 'YYYY-MM-DD'),
         schedule_token = coalesce(schedule_token, v_token)
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
$function$;

CREATE OR REPLACE FUNCTION public.open_work_for(p_profile_id uuid)
 RETURNS TABLE(kind text, label text, count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select 'placements', 'Active placements', count(*)::integer
  from public.placement pl
  join public.operator o on o.id = pl.operator_id
  where o.profile_id = p_profile_id and pl.status = 'active'
  union all
  select 'escalations', 'Open escalations raised', count(*)::integer
  from public.escalation e
  join public.operator o on o.id = e.operator_id
  where o.profile_id = p_profile_id and e.status = 'open'
  union all
  select 'booking_claims', 'Booking claims awaiting review', count(*)::integer
  from public.booking b
  join public.operator o on o.id = b.operator_id
  where o.profile_id = p_profile_id and b.state = 'pending_review'
  union all
  -- public.document is not present in this migration set; omit documents open-work.
  select 'assigned_clients', 'Clients assigned in scope', count(*)::integer
  from public.account_scope_client c where c.profile_id = p_profile_id
  union all
  select 'contractor_tasks', 'Build tasks not finished', count(*)::integer
  from public.contractor_task t where t.profile_id = p_profile_id and t.completed_at is null;
$function$;

CREATE OR REPLACE FUNCTION public.submit_role_application(p_role_slug text, p_role_title text, p_full_name text, p_email text, p_phone text DEFAULT NULL::text, p_linkedin_url text DEFAULT NULL::text, p_portfolio_url text DEFAULT NULL::text, p_loom_url text DEFAULT NULL::text, p_experience text DEFAULT NULL::text, p_why_you text DEFAULT NULL::text, p_availability text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_slug text := btrim(coalesce(p_role_slug, ''));
  v_recent integer;
  v_id uuid;
  v_updated boolean;
begin
  if v_slug = '' then
    raise exception 'role_required: an application has to name the role it is for' using errcode = '23514';
  end if;

  if v_name = '' then
    raise exception 'name_required: tell us who you are' using errcode = '23514';
  end if;

  if position('@' in v_email) < 2 or position('.' in split_part(v_email, '@', 2)) < 2 then
    raise exception 'email_invalid: we need an address we can reply to' using errcode = '23514';
  end if;

  select count(*) into v_recent
  from public.role_application
  where email = v_email and received_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'too_many_applications: you have applied to several roles just now. Give it an hour, or reply to the confirmation instead.'
      using errcode = '53400';
  end if;

  insert into public.role_application (
    role_slug, role_title, full_name, email, phone,
    linkedin_url, portfolio_url, loom_url, experience, why_you, availability,
    ip, user_agent
  )
  values (
    v_slug,
    coalesce(nullif(btrim(coalesce(p_role_title, '')), ''), v_slug),
    v_name, v_email,
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_linkedin_url, '')), ''),
    nullif(btrim(coalesce(p_portfolio_url, '')), ''),
    nullif(btrim(coalesce(p_loom_url, '')), ''),
    nullif(btrim(coalesce(p_experience, '')), ''),
    nullif(btrim(coalesce(p_why_you, '')), ''),
    nullif(btrim(coalesce(p_availability, '')), ''),
    app.ingest_inet(p_ip),
    left(nullif(btrim(coalesce(p_user_agent, '')), ''), 500)
  )
  on conflict (role_slug, email) do update
    set full_name = excluded.full_name,
        phone = coalesce(excluded.phone, public.role_application.phone),
        linkedin_url = coalesce(excluded.linkedin_url, public.role_application.linkedin_url),
        portfolio_url = coalesce(excluded.portfolio_url, public.role_application.portfolio_url),
        loom_url = coalesce(excluded.loom_url, public.role_application.loom_url),
        experience = coalesce(excluded.experience, public.role_application.experience),
        why_you = coalesce(excluded.why_you, public.role_application.why_you),
        availability = coalesce(excluded.availability, public.role_application.availability)
  returning id, (xmax <> 0) into v_id, v_updated;

  perform app.raise_owner_alert(
    'careers.application',
    format('%s applied for %s (%s)', v_name, coalesce(nullif(btrim(coalesce(p_role_title, '')), ''), v_slug), v_email),
    null, null, 'informational');

  return jsonb_build_object('id', v_id, 'updated', coalesce(v_updated, false));
end;
$function$;
