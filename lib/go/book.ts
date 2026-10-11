'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { FREE_SALES_OPS_AUDIT_CALENDAR_NAME } from '@/lib/acq/config';
import { acqPublicClients } from '@/lib/acq/public-db';
import { createGoogleMeetEvent, deleteGoogleCalendarEvent } from '@/lib/assessment/calendar';
import { bookingMessagesOwnDelivery } from '@/lib/booking-messages/config';
import { GO_SMS_CONSENT_VERSION } from '@/lib/booking-messages/copy';
import { recordBookingEvent } from '@/lib/booking-messages/transport';
import { parseGoBooking, type GoBookingInput } from './booking';
import { GO_PUBLIC_ORIGIN } from './config';
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
      summary: `${FREE_SALES_OPS_AUDIT_CALENDAR_NAME} — ${value.fullName}`,
      description: [
        'Booked from the cleaning landing page.',
        'They agreed to take the call from a private, quiet room with their full attention.',
        `Phone: ${value.phone}`,
      ].join('\n'),
      startsAt: data.scheduled_for,
      endsAt,
      timeZone: data.time_zone,
      attendeeEmails: [value.email, 'malik@divineacquisition.io'],
      notifyAttendees: !bookingMessagesOwnDelivery(),
    });
    eventId = event.eventId;
    meetUrl = event.meetUrl;
  } catch (calendarError) {
    const message = calendarError instanceof Error ? calendarError.message : '';
    if (!message.includes('calendar_not_configured')) {
      console.error('[go] calendar event failed', message || calendarError);
      await controlRpc(supabase as never, 'go_release_strategy_booking', { p_id: data.id });
      return { ok: false, error: 'The booking could not be placed on the calendar. Try another time.' };
    }
    console.error('[go] calendar client unavailable; saved the time without a Meet link');
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
  if (!bookingMessagesOwnDelivery()) {
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
  }

  const recorded = await recordBookingEvent({
    type: 'booked',
    email: value.email,
    phone: value.phone,
    fullName: value.fullName,
    timeZone: data.time_zone,
    startsAt: data.scheduled_for,
    endsAt,
    bookingId: data.id,
    meetingLink: meetUrl ?? undefined,
    bookingLink: GO_PUBLIC_ORIGIN,
    rescheduleLink: GO_PUBLIC_ORIGIN,
    smsConsent: true,
    smsConsentAt: new Date().toISOString(),
    smsConsentWordingVersion: GO_SMS_CONSENT_VERSION,
    smsConsentPageUrl: GO_PUBLIC_ORIGIN,
    ghlContactId: contactId ?? undefined,
  });
  if (!recorded.ok) console.error('[booking-messages]', recorded.error);

  return {
    ok: true,
    startsAt: data.scheduled_for,
    timeZone: data.time_zone,
    meetUrl,
    alreadyBooked: false,
  };
}
