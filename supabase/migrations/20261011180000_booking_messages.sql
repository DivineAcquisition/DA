-- Audit booking messages. The application queues them and a minute cron
-- sends them through GoHighLevel. Workflows do not send these.

alter table public.da_leads
  add column if not exists sms_consent boolean,
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_wording_version text,
  add column if not exists sms_consent_page_url text;

comment on column public.da_leads.sms_consent is
  'True only when the lead ticked the SMS box. Texts require this, the wording version, and the page URL.';
comment on column public.da_leads.sms_consent_wording_version is
  'Version of the consent sentence they agreed to. See ACQ_SMS_CONSENT_VERSION.';
comment on column public.da_leads.sms_consent_page_url is
  'Page URL where the consent box was shown.';

create table if not exists public.booking_message_people (
  id text primary key,
  email text not null default '',
  phone text not null default '',
  first_name text not null default '',
  full_name text not null default '',
  time_zone text not null default 'America/New_York',
  time_zone_source text not null default 'eastern' check (time_zone_source in ('given', 'area_code', 'eastern')),
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  sms_consent_wording_version text,
  sms_consent_page_url text,
  ghl_contact_id text not null default '',
  airtable_record_id text not null default '',
  da_lead_id uuid references public.da_leads (id) on delete set null,
  do_not_contact boolean not null default false,
  unmatched boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_message_people_email_idx
  on public.booking_message_people (lower(email))
  where email <> '';

create index if not exists booking_message_people_phone_idx
  on public.booking_message_people (phone)
  where phone <> '';

create table if not exists public.booking_message_bookings (
  id text primary key,
  external_id text not null unique,
  person_id text not null references public.booking_message_people (id) on delete cascade,
  status text not null check (status in ('booked', 'rescheduled', 'cancelled', 'held', 'no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'America/New_York',
  meeting_link text not null default '',
  reschedule_link text not null default '',
  booking_link text not null default '',
  unmatched boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_message_bookings_person_idx
  on public.booking_message_bookings (person_id, starts_at);

create table if not exists public.booking_message_messages (
  id text primary key,
  person_id text not null references public.booking_message_people (id) on delete cascade,
  booking_id text references public.booking_message_bookings (id) on delete cascade,
  message_type text not null,
  channel text not null check (channel in ('email', 'sms')),
  scheduled_for timestamptz not null,
  status text not null check (status in ('pending', 'sent', 'skipped', 'failed', 'cancelled')),
  reason text not null default '',
  final boolean not null default false,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  ghl_message_id text,
  dry_run boolean not null default false,
  flagged boolean not null default false,
  sent_at timestamptz,
  touch_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_message_due_idx
  on public.booking_message_messages (scheduled_for)
  where status = 'pending';

create index if not exists booking_message_problems_idx
  on public.booking_message_messages (created_at desc)
  where status in ('failed', 'skipped') or touch_error <> '';

create table if not exists public.booking_message_events (
  dedupe_key text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create table if not exists public.booking_message_rejections (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  received_at timestamptz not null default now()
);

alter table public.booking_message_people enable row level security;
alter table public.booking_message_bookings enable row level security;
alter table public.booking_message_messages enable row level security;
alter table public.booking_message_events enable row level security;
alter table public.booking_message_rejections enable row level security;

create policy booking_message_people_admin on public.booking_message_people
  for select to authenticated using (app.is_admin());
create policy booking_message_bookings_admin on public.booking_message_bookings
  for select to authenticated using (app.is_admin());
create policy booking_message_messages_admin on public.booking_message_messages
  for select to authenticated using (app.is_admin());
create policy booking_message_events_admin on public.booking_message_events
  for select to authenticated using (app.is_admin());
create policy booking_message_rejections_admin on public.booking_message_rejections
  for select to authenticated using (app.is_admin());

grant select on public.booking_message_people to authenticated;
grant select on public.booking_message_bookings to authenticated;
grant select on public.booking_message_messages to authenticated;
grant select on public.booking_message_events to authenticated;
grant select on public.booking_message_rejections to authenticated;

comment on table public.booking_message_messages is
  'Queued audit messages. Pending rows are sent by /api/cron/booking-messages. Failed and skipped rows are the problem view.';

-- Store the consent proof on the public capture path without changing scoring.
create or replace function public.acq_capture_application(p_lead jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_lead->>'email', '')));
  v_name text := btrim(coalesce(p_lead->>'fullName', ''));
  v_phone text := btrim(coalesce(p_lead->>'phone', ''));
  v_company text := btrim(coalesce(p_lead->>'companyName', ''));
  v_niche text := btrim(coalesce(p_lead->>'coachingNiche', ''));
  v_spend text := btrim(coalesce(p_lead->>'monthlyAdSpend', ''));
  v_follow text := btrim(coalesce(p_lead->>'followUpOwner', ''));
  v_price text := btrim(coalesce(p_lead->>'programPrice', ''));
  v_stage text := btrim(coalesce(p_lead->>'stage', 'Step 1 Captured'));
  v_result text := nullif(btrim(coalesce(p_lead->>'qualificationResult', '')), '');
  v_score int := nullif(p_lead->>'readinessScore', '')::int;
  v_ghl text := btrim(coalesce(p_lead->>'ghlContactId', ''));
  v_notes text := '';
  v_token text := nullif(btrim(coalesce(p_lead->>'scheduleToken', '')), '');
  v_sms boolean := case when p_lead ? 'smsConsent' then coalesce((p_lead->>'smsConsent')::boolean, false) else false end;
  v_sms_at timestamptz := case
    when coalesce(p_lead->>'smsConsentAt', '') <> '' then (p_lead->>'smsConsentAt')::timestamptz
    else null
  end;
  v_sms_version text := nullif(btrim(coalesce(p_lead->>'smsConsentWordingVersion', '')), '');
  v_sms_url text := nullif(btrim(coalesce(p_lead->>'smsConsentPageUrl', '')), '');
  v public.da_leads%rowtype;
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 320 then
    raise exception 'email: enter a valid email' using errcode = '22023';
  end if;
  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'full_name: enter your full name' using errcode = '22023';
  end if;
  if length(v_phone) > 40 or length(v_company) > 200 or length(v_niche) > 200
     or length(v_spend) > 40 or length(v_follow) > 80 or length(v_price) > 40
     or length(v_stage) < 1 or length(v_stage) > 80 or length(v_ghl) > 80 then
    raise exception 'lead: check the form and try again' using errcode = '22023';
  end if;
  if v_result is not null and v_result not in ('Qualified', 'Manual Review', 'Disqualified') then
    v_result := null;
  end if;
  if v_score is not null and (v_score < 0 or v_score > 100) then
    v_score := null;
  end if;

  select * into v
  from public.da_leads
  where lower(email) = v_email
  limit 1;

  if v.id is not null and coalesce(length(v.schedule_token), 0) >= 32 then
    v_token := v.schedule_token;
  end if;
  if v_token is null or length(v_token) < 32 or length(v_token) > 200 then
    raise exception 'schedule_token: missing token' using errcode = '22023';
  end if;

  if coalesce(v.notes, '') <> '' then
    v_notes := v.notes;
  elsif coalesce(p_lead->>'nicheNote', '') <> '' then
    v_notes := left(p_lead->>'nicheNote', 4000);
  elsif coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$' then
    v_notes := 'Inquiries per month: ' || (p_lead->>'inquiriesPerMonth');
  end if;

  if v.id is null then
    insert into public.da_leads (
      full_name, email, phone, company_name, coaching_niche, stage,
      qualification_result, readiness_score, monthly_ad_spend, follow_up_owner,
      program_price, notes, ghl_contact_id, schedule_token, payload,
      sms_consent, sms_consent_at, sms_consent_wording_version, sms_consent_page_url
    )
    values (
      v_name, v_email, v_phone, v_company, v_niche, v_stage,
      v_result, v_score, v_spend, v_follow,
      v_price, v_notes, v_ghl, v_token,
      jsonb_strip_nulls(jsonb_build_object(
        'scheduleToken', v_token,
        'offer', nullif(v_niche, ''),
        'inquiriesPerMonth', case
          when coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$'
            then (p_lead->>'inquiriesPerMonth')::int
          else null
        end,
        'source', nullif(p_lead->>'source', ''),
        'tracking', coalesce(p_lead->'tracking', '{}'::jsonb),
        'tags', coalesce(p_lead->'tags', '[]'::jsonb),
        'niche', nullif(p_lead->>'niche', ''),
        'spendBand', nullif(p_lead->>'spendBand', ''),
        'qualified', nullif(p_lead->>'qualified', ''),
        'headlineVariant', nullif(p_lead->>'headlineVariant', ''),
        'smsConsent', v_sms,
        'smsConsentAt', v_sms_at,
        'smsConsentWordingVersion', v_sms_version,
        'smsConsentPageUrl', v_sms_url
      )),
      v_sms, v_sms_at, v_sms_version, v_sms_url
    )
    returning * into v;
  else
    update public.da_leads
       set full_name = v_name,
           phone = case when v_phone <> '' then v_phone else phone end,
           company_name = case when v_company <> '' then v_company else company_name end,
           coaching_niche = case when v_niche <> '' then v_niche else coaching_niche end,
           qualification_result = coalesce(v_result, qualification_result),
           readiness_score = coalesce(v_score, readiness_score),
           monthly_ad_spend = case when v_spend <> '' then v_spend else monthly_ad_spend end,
           follow_up_owner = case when v_follow <> '' then v_follow else follow_up_owner end,
           program_price = case when v_price <> '' then v_price else program_price end,
           notes = v_notes,
           ghl_contact_id = case when v_ghl <> '' then v_ghl else ghl_contact_id end,
           schedule_token = v_token,
           sms_consent = case when p_lead ? 'smsConsent' then v_sms else sms_consent end,
           sms_consent_at = coalesce(v_sms_at, sms_consent_at),
           sms_consent_wording_version = coalesce(v_sms_version, sms_consent_wording_version),
           sms_consent_page_url = coalesce(v_sms_url, sms_consent_page_url),
           payload = coalesce(payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
             'scheduleToken', v_token,
             'offer', nullif(v_niche, ''),
             'inquiriesPerMonth', case
          when coalesce(p_lead->>'inquiriesPerMonth', '') ~ '^\d+$'
            then (p_lead->>'inquiriesPerMonth')::int
          else null
        end,
             'source', nullif(p_lead->>'source', ''),
             'tracking', coalesce(p_lead->'tracking', '{}'::jsonb),
             'tags', coalesce(p_lead->'tags', '[]'::jsonb),
             'niche', nullif(p_lead->>'niche', ''),
             'spendBand', nullif(p_lead->>'spendBand', ''),
             'qualified', nullif(p_lead->>'qualified', ''),
             'headlineVariant', nullif(p_lead->>'headlineVariant', ''),
             'smsConsent', case when p_lead ? 'smsConsent' then v_sms else null end,
             'smsConsentAt', v_sms_at,
             'smsConsentWordingVersion', v_sms_version,
             'smsConsentPageUrl', v_sms_url
           ))
     where id = v.id
     returning * into v;
  end if;

  return jsonb_build_object(
    'id', v.id,
    'schedule_token', v.schedule_token
  );
end;
$$;

revoke all on function public.acq_capture_application(jsonb) from public;
grant execute on function public.acq_capture_application(jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
