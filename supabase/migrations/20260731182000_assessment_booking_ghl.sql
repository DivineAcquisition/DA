-- Persist the GHL appointment created through the PIT when an admin schedules a call.

alter table public.assessment_booking
  add column if not exists ghl_contact_id text,
  add column if not exists ghl_appointment_id text;

comment on column public.assessment_booking.ghl_appointment_id is
  'GoHighLevel calendars/events/appointments id created via the talent PIT.';

create or replace function public.record_assessment_booking_calendar(
  p_booking_id uuid,
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
begin
  if not app.is_admin() then
    raise exception 'admin_required: only an admin can update assessment bookings'
      using errcode = '42501';
  end if;

  update public.assessment_booking
     set google_event_id = coalesce(p_google_event_id, google_event_id),
         google_meet_url = coalesce(p_google_meet_url, google_meet_url),
         google_html_link = coalesce(p_google_html_link, google_html_link),
         confirmation_email_id = coalesce(p_confirmation_email_id, confirmation_email_id),
         ghl_contact_id = coalesce(p_ghl_contact_id, ghl_contact_id),
         ghl_appointment_id = coalesce(p_ghl_appointment_id, ghl_appointment_id)
   where id = p_booking_id
     and cancelled_at is null;
end;
$$;

revoke all on function public.record_assessment_booking_calendar(uuid, text, text, text, text, text, text) from public;
grant execute on function public.record_assessment_booking_calendar(uuid, text, text, text, text, text, text) to authenticated;
