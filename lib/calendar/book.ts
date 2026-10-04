'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { bookAssessmentInGhl } from '@/lib/assessment/ghl';
import { calendarConfigured, createGoogleMeetEvent } from '@/lib/assessment/calendar';
import { sendAssessmentBookingConfirmationEmail } from '@/lib/assessment/email';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { WORKSPACE_AGREEMENT_CC } from '@/lib/workspace/email';
import { isOfferedSlot } from './slots';

type SlotRow = {
  ok?: boolean;
  already_booked?: boolean;
  email?: string | null;
  full_name?: string | null;
  contact_name?: string | null;
  company_name?: string | null;
  organization?: string | null;
  scheduled_for?: string | null;
  time_zone?: string | null;
  meet_url?: string | null;
};

export type BookedSlot = {
  ok: true;
  startsAt: string;
  timeZone: string;
  meetUrl: string | null;
  alreadyBooked: boolean;
};

function asBooked(row: SlotRow): BookedSlot | null {
  if (!row.scheduled_for || !row.time_zone) return null;
  return {
    ok: true,
    startsAt: row.scheduled_for,
    timeZone: row.time_zone,
    meetUrl: row.meet_url ?? null,
    alreadyBooked: Boolean(row.already_booked),
  };
}

async function finishBooking(input: {
  token: string;
  row: SlotRow;
  summary: string;
  description: string;
  attach: 'call' | 'assessment';
}): Promise<BookedSlot | { ok: false; error: string }> {
  const booked = asBooked(input.row);
  if (!booked) return { ok: false, error: 'The booking did not save a time.' };
  if (booked.alreadyBooked || !supabaseConfigured) return booked;

  const supabase = await createClient();
  let meetUrl = booked.meetUrl;
  let calendarUrl: string | null = null;
  let eventId: string | null = null;

  if (calendarConfigured()) {
    try {
      const attendees = [input.row.email, ...WORKSPACE_AGREEMENT_CC].filter(
        (email): email is string => Boolean(email),
      );
      const endsAt = new Date(new Date(booked.startsAt).getTime() + 30 * 60_000).toISOString();
      const event = await createGoogleMeetEvent({
        summary: input.summary,
        description: input.description,
        startsAt: booked.startsAt,
        endsAt,
        timeZone: booked.timeZone,
        attendeeEmails: attendees,
      });
      eventId = event.eventId;
      meetUrl = event.meetUrl;
      calendarUrl = event.htmlLink;
      if (input.attach === 'call' && event.meetUrl) {
        await controlRpc(supabase, 'da_attach_calendar_meet', {
          p_token: input.token,
          p_meet_url: event.meetUrl,
        });
      }
    } catch (error) {
      console.error('[schedule] calendar event failed', error);
    }
  }

  let confirmationId: string | null = null;
  const email = input.row.email?.trim();
  const name = input.row.full_name || input.row.contact_name || 'there';
  if (email) {
    try {
      const sent = await sendAssessmentBookingConfirmationEmail({
        to: email,
        fullName: name,
        companyName: input.row.company_name || input.row.organization,
        startsAt: booked.startsAt,
        timeZone: booked.timeZone,
        durationMinutes: 30,
        meetUrl,
        calendarUrl,
      });
      confirmationId = sent.id;
    } catch (error) {
      console.error('[schedule] confirmation email failed', error);
    }
  }

  if (input.attach === 'assessment') {
    let ghlContactId: string | null = null;
    let ghlAppointmentId: string | null = null;
    try {
      if (email) {
        const ghl = await bookAssessmentInGhl({
          email,
          fullName: name,
          companyName: input.row.company_name,
          startsAt: booked.startsAt,
          endsAt: new Date(new Date(booked.startsAt).getTime() + 30 * 60_000).toISOString(),
          meetUrl,
        });
        ghlContactId = ghl.contactId;
        ghlAppointmentId = ghl.appointmentId;
      }
    } catch (error) {
      console.error('[schedule] ghl appointment failed', error);
    }

    await controlRpc(supabase, 'attach_assessment_invite_booking', {
      p_token: input.token,
      p_google_event_id: eventId,
      p_google_meet_url: meetUrl,
      p_google_html_link: calendarUrl,
      p_confirmation_email_id: confirmationId,
      p_ghl_contact_id: ghlContactId,
      p_ghl_appointment_id: ghlAppointmentId,
    });
  }

  return { ...booked, meetUrl };
}

export async function bookCallSlotAction(
  token: string,
  startsAt: string,
  timeZone: string,
): Promise<BookedSlot | { ok: false; error: string }> {
  if (!supabaseConfigured) return { ok: false, error: 'Scheduling is temporarily unavailable.' };
  if (!isOfferedSlot(startsAt, timeZone)) {
    return { ok: false, error: 'Pick one of the open times.' };
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<SlotRow>(supabase, 'da_book_calendar_slot', {
    p_token: token,
    p_starts_at: new Date(startsAt).toISOString(),
    p_time_zone: timeZone,
  });
  if (error || !data?.ok) return { ok: false, error: readable(error) };

  const organization = data.organization || 'your team';
  return finishBooking({
    token,
    row: data,
    summary: `Call with ${data.contact_name || 'applicant'} (${organization})`,
    description: 'Scheduled from a Divine Acquisition booking link.',
    attach: 'call',
  });
}

export async function bookAssessmentInviteAction(
  token: string,
  startsAt: string,
  timeZone: string,
): Promise<BookedSlot | { ok: false; error: string }> {
  if (!supabaseConfigured) return { ok: false, error: 'Scheduling is temporarily unavailable.' };
  if (!isOfferedSlot(startsAt, timeZone)) {
    return { ok: false, error: 'Pick one of the open times.' };
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<SlotRow>(supabase, 'book_assessment_from_invite', {
    p_token: token,
    p_starts_at: new Date(startsAt).toISOString(),
    p_time_zone: timeZone,
  });
  if (error || !data?.ok) return { ok: false, error: readable(error) };

  return finishBooking({
    token,
    row: data,
    summary: data.company_name
      ? `Assessment call — ${data.full_name} (${data.company_name})`
      : `Assessment call — ${data.full_name || 'applicant'}`,
    description: 'Scheduled from a Divine Acquisition assessment invite.',
    attach: 'assessment',
  });
}
