'use server';

import {
  calendarConfigured,
  createGoogleMeetEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/assessment/calendar';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { acqPublicClients } from '@/lib/acq/public-db';
import { parseGoBooking, type GoBookingInput } from './booking';
import { upsertStrategyContact } from './contact';
import { sendGoSessionEmail } from './reminders';

type BookRow = {
  ok?: boolean;
  already_booked?: boolean;
  id?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  scheduled_for?: string;
  time_zone?: string;
  meet_url?: string | null;
  ghl_contact_id?: string | null;
};

export type GoBookResult =
  | { ok: true; startsAt: string; timeZone: string; meetUrl: string | null; alreadyBooked: boolean }
  | { ok: false; error: string };

function clients() {
  return acqPublicClients();
}

export async function bookGoStrategyAction(input: GoBookingInput): Promise<GoBookResult> {
  const parsed = parseGoBooking(input);
  if (!parsed.ok) return parsed;
  if (parsed.honeypot) {
    return { ok: true, startsAt: input.startsAt, timeZone: input.timeZone, meetUrl: null, alreadyBooked: false };
  }
  if (!calendarConfigured()) {
    return { ok: false, error: 'The calendar is not ready yet. Try again shortly.' };
  }

  const supabase = clients()[0];
  if (!supabase) return { ok: false, error: 'Scheduling is temporarily unavailable.' };

  const value = parsed.value;
  const { data, error } = await controlRpc<BookRow>(supabase as never, 'go_book_strategy_session', {
    p_full_name: value.fullName,
    p_email: value.email,
    p_phone: value.phone,
    p_show_up: true,
    p_sms_consent: true,
    p_email_consent: true,
    p_starts_at: value.startsAt,
    p_time_zone: value.timeZone,
  });
  if (error || !data?.ok || !data.id || !data.scheduled_for || !data.time_zone) {
    return { ok: false, error: readable(error) };
  }
  if (data.already_booked) {
    return {
      ok: true,
      startsAt: data.scheduled_for,
      timeZone: data.time_zone,
      meetUrl: data.meet_url ?? null,
      alreadyBooked: true,
    };
  }

  const endsAt = new Date(new Date(data.scheduled_for).getTime() + 30 * 60_000).toISOString();
  let eventId: string | null = null;
  let meetUrl: string | null = null;
  try {
    const event = await createGoogleMeetEvent({
      summary: `Strategy session with ${value.fullName}`,
      description: [
        'Divine Acquisition strategy session for a cleaning company.',
        'They agreed to take the call from a private, quiet room with their full attention.',
        `Phone: ${value.phone}`,
      ].join('\n'),
      startsAt: data.scheduled_for,
      endsAt,
      timeZone: data.time_zone,
      attendeeEmails: [value.email, 'malik@divineacquisition.io'],
    });
    eventId = event.eventId;
    meetUrl = event.meetUrl;
  } catch (calendarError) {
    await controlRpc(supabase as never, 'go_release_strategy_booking', { p_id: data.id });
    return {
      ok: false,
      error:
        calendarError instanceof Error
          ? `Google Calendar could not be created. ${calendarError.message}`
          : 'Google Calendar could not be created.',
    };
  }

  const attached = await controlRpc(supabase as never, 'go_attach_strategy_booking', {
    p_id: data.id,
    p_meet_url: meetUrl,
    p_calendar_event_id: eventId,
  });
  if (attached.error) {
    if (eventId) await deleteGoogleCalendarEvent(eventId);
    await controlRpc(supabase as never, 'go_release_strategy_booking', { p_id: data.id });
    return { ok: false, error: 'The booking could not be saved. Try another time.' };
  }

  let contactId: string | null = null;
  try {
    contactId = await upsertStrategyContact({
      fullName: value.fullName,
      email: value.email,
      phone: value.phone,
    });
    await controlRpc(supabase as never, 'go_attach_strategy_booking', {
      p_id: data.id,
      p_ghl_contact_id: contactId,
    });
  } catch (contactError) {
    console.error('[go] strategy contact failed', contactError);
  }

  let confirmationId: string | null = null;
  try {
    const sent = await sendGoSessionEmail({
      to: value.email,
      fullName: value.fullName,
      startsAt: data.scheduled_for,
      timeZone: data.time_zone,
      meetUrl,
      kind: 'confirmation',
      bookingId: data.id,
    });
    confirmationId = sent.id;
    await controlRpc(supabase as never, 'go_attach_strategy_booking', {
      p_id: data.id,
      p_confirmation_email_id: confirmationId,
    });
  } catch (emailError) {
    console.error('[go] confirmation email failed', emailError);
  }

  return {
    ok: true,
    startsAt: data.scheduled_for,
    timeZone: data.time_zone,
    meetUrl,
    alreadyBooked: false,
  };
}
