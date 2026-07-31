-- ---------------------------------------------------------------------------
-- Admin-scheduled assessment calls (Google Calendar / Meet).
-- Separate from tokenized self-serve invites: the admin picks the slot.
-- ---------------------------------------------------------------------------

create table public.assessment_booking (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1 and length(email) <= 320),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  company_name text check (company_name is null or length(btrim(company_name)) between 1 and 200),
  note text check (note is null or length(note) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  time_zone text not null default 'America/New_York',
  duration_minutes integer not null default 30 check (duration_minutes between 15 and 120),
  google_event_id text,
  google_meet_url text,
  google_html_link text,
  confirmation_email_id text,
  reminder_email_id text,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references public.profile (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessment_booking_ends_after_start check (ends_at > starts_at)
);

comment on table public.assessment_booking is
  'Assessment calls scheduled by an admin, with Google Calendar/Meet and reminder tracking.';

create index assessment_booking_starts_idx
  on public.assessment_booking (starts_at)
  where cancelled_at is null;

create index assessment_booking_reminder_due_idx
  on public.assessment_booking (starts_at)
  where cancelled_at is null and reminder_sent_at is null;

create trigger assessment_booking_touch before update on public.assessment_booking
  for each row execute function app.touch_updated_at();

alter table public.assessment_booking enable row level security;

create policy assessment_booking_admin_all on public.assessment_booking
  for all to authenticated
  using (app.is_admin())
  with check (app.is_admin());

revoke all on public.assessment_booking from anon;
revoke all on public.assessment_booking from authenticated;
grant select, insert, update on public.assessment_booking to authenticated;

-- ---------------------------------------------------------------------------
-- Create booking row (calendar/email happen in the app after this returns).
-- ---------------------------------------------------------------------------

create or replace function public.create_assessment_booking(
  p_email text,
  p_full_name text,
  p_starts_at timestamptz,
  p_time_zone text default 'America/New_York',
  p_duration_minutes integer default 30,
  p_company_name text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_company text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_tz text := coalesce(nullif(btrim(coalesce(p_time_zone, '')), ''), 'America/New_York');
  v_duration integer := coalesce(p_duration_minutes, 30);
  v_id uuid;
  v_ends timestamptz;
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can schedule assessment bookings'
      using errcode = '42501';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'email_required: an assessment booking needs a valid email'
      using errcode = '23514';
  end if;

  if v_name = '' then
    raise exception 'name_required: an assessment booking needs a name'
      using errcode = '23514';
  end if;

  if p_starts_at is null then
    raise exception 'starts_at_required: pick a date and time for the call'
      using errcode = '23514';
  end if;

  if p_starts_at < now() - interval '5 minutes' then
    raise exception 'starts_at_past: the call time must be in the future'
      using errcode = '23514';
  end if;

  if v_duration < 15 or v_duration > 120 then
    raise exception 'duration_invalid: duration must be between 15 and 120 minutes'
      using errcode = '23514';
  end if;

  v_ends := p_starts_at + make_interval(mins => v_duration);

  insert into public.assessment_booking (
    email, full_name, company_name, note, starts_at, ends_at, time_zone,
    duration_minutes, created_by
  ) values (
    v_email, v_name, v_company, v_note, p_starts_at, v_ends, v_tz,
    v_duration, auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'email', v_email,
    'full_name', v_name,
    'company_name', v_company,
    'starts_at', p_starts_at,
    'ends_at', v_ends,
    'time_zone', v_tz,
    'duration_minutes', v_duration
  );
end;
$$;

revoke all on function public.create_assessment_booking(text, text, timestamptz, text, integer, text, text) from public;
grant execute on function public.create_assessment_booking(text, text, timestamptz, text, integer, text, text) to authenticated;

create or replace function public.record_assessment_booking_calendar(
  p_booking_id uuid,
  p_google_event_id text default null,
  p_google_meet_url text default null,
  p_google_html_link text default null,
  p_confirmation_email_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can update assessment bookings'
      using errcode = '42501';
  end if;

  update public.assessment_booking
     set google_event_id = coalesce(p_google_event_id, google_event_id),
         google_meet_url = coalesce(p_google_meet_url, google_meet_url),
         google_html_link = coalesce(p_google_html_link, google_html_link),
         confirmation_email_id = coalesce(p_confirmation_email_id, confirmation_email_id)
   where id = p_booking_id
     and cancelled_at is null;
end;
$$;

revoke all on function public.record_assessment_booking_calendar(uuid, text, text, text, text) from public;
grant execute on function public.record_assessment_booking_calendar(uuid, text, text, text, text) to authenticated;

create or replace function public.list_assessment_bookings(p_limit integer default 40)
returns setof public.assessment_booking
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can list assessment bookings'
      using errcode = '42501';
  end if;

  return query
    select *
    from public.assessment_booking
    order by starts_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 100));
end;
$$;

revoke all on function public.list_assessment_bookings(integer) from public;
grant execute on function public.list_assessment_bookings(integer) to authenticated;

-- Reminder worker: service role / secret-gated app caller uses this.
-- Granted to authenticated for admin dry-runs; the cron uses the service path
-- via a security definer that does not require admin (secret is at the HTTP edge).

create or replace function public.claim_due_assessment_reminders(p_limit integer default 20)
returns setof public.assessment_booking
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return query
    with due as (
      select b.id
      from public.assessment_booking b
      where b.cancelled_at is null
        and b.reminder_sent_at is null
        and b.starts_at > now()
        and b.starts_at <= now() + interval '30 minutes'
      order by b.starts_at asc
      limit greatest(1, least(coalesce(p_limit, 20), 50))
      for update skip locked
    )
    update public.assessment_booking b
       set reminder_sent_at = now()
      from due
     where b.id = due.id
    returning b.*;
end;
$$;

revoke all on function public.claim_due_assessment_reminders(integer) from public;
grant execute on function public.claim_due_assessment_reminders(integer) to service_role;

create or replace function public.record_assessment_booking_reminder(
  p_booking_id uuid,
  p_reminder_email_id text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.assessment_booking
     set reminder_email_id = p_reminder_email_id,
         reminder_sent_at = coalesce(reminder_sent_at, now())
   where id = p_booking_id;
end;
$$;

revoke all on function public.record_assessment_booking_reminder(uuid, text) from public;
grant execute on function public.record_assessment_booking_reminder(uuid, text) to service_role;
