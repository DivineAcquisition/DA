'use server';

import { controlRpc, readable } from '@/lib/ad/rpc';
import {
  calendarConfigured,
  createGoogleMeetEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/assessment/calendar';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { isOfferedSlot } from '@/lib/calendar/slots';
import { createAcqGhlAppointment, updateGhlContactPhone } from './ghl-sms';
import { acqPublicClients } from './public-db';
import { sendAcqAuditEmail } from './schedule-email';

type BookRow = {
  ok?: boolean;
  already_booked?: boolean;
  id?: string;
  email?: string;
  full_name?: string;
  coaching_niche?: string;
  phone?: string;
  ghl_contact_id?: string;
  scheduled_for?: string;
  time_zone?: string;
  meet_url?: string | null;
  calendar_event_id?: string | null;
  previous_stage?: string;
};

export type AcqScheduleView = {
  fullName: string;
  offer: string;
  scheduledFor: string | null;
  timeZone: string | null;
  meetUrl: string | null;
};

type ResolveRow = {
  full_name?: string;
  coaching_niche?: string;
  scheduled_for?: string | null;
  time_zone?: string | null;
  meet_url?: string | null;
};

async function scheduleClients() {
  const clients = acqPublicClients();
  if (supabaseConfigured) {
    try {
      clients.push((await createClient()) as (typeof clients)[number]);
    } catch {
      // The cookie client is optional. The public project client can still book.
    }
  }
  return clients;
}

function asRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export async function loadAcqSchedule(token: string): Promise<AcqScheduleView | null> {
  if (token.trim().length < 32) return null;
  for (const supabase of await scheduleClients()) {
    const { data } = await controlRpc<ResolveRow>(supabase as never, 'acq_resolve_schedule_token', {
      p_token: token,
    });
    const row = asRow(data);
    if (!row?.full_name) continue;
    return {
      fullName: row.full_name,
      offer: row.coaching_niche || '',
      scheduledFor: row.scheduled_for ?? null,
      timeZone: row.time_zone ?? null,
      meetUrl: row.meet_url ?? null,
    };
  }
  return null;
}

export async function bookAcqAuditAction(
  token: string,
  startsAt: string,
  timeZone: string,
  phone: string,
): Promise<
  | { ok: true; startsAt: string; timeZone: string; meetUrl: string | null; alreadyBooked: boolean }
  | { ok: false; error: string }
> {
  if (!isOfferedSlot(startsAt, timeZone)) return { ok: false, error: 'Pick one of the open times.' };
  if (!calendarConfigured()) {
    return { ok: false, error: 'The calendar is not ready yet. Try again shortly.' };
  }

  const startsIso = new Date(startsAt).toISOString();
  const clients = await scheduleClients();
  const supabase = clients[0];
  if (!supabase) return { ok: false, error: 'Scheduling is temporarily unavailable.' };
  const { data, error } = await controlRpc<BookRow>(supabase, 'acq_book_schedule_slot', {
    p_token: token,
    p_starts_at: startsIso,
    p_time_zone: timeZone,
    p_phone: phone.trim(),
  });
  if (error || !data?.ok || !data.scheduled_for || !data.time_zone) {
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
  const name = data.full_name || 'Applicant';
  let eventId: string | null = null;
  let meetUrl: string | null = null;

  try {
    const event = await createGoogleMeetEvent({
      summary: `Audit with ${name}`,
      description: [
        'Divine Acquisition audit.',
        data.coaching_niche ? `What they sell: ${data.coaching_niche}` : null,
        'Booked from the application scheduling page.',
      ]
        .filter(Boolean)
        .join('\n'),
      startsAt: data.scheduled_for,
      endsAt,
      timeZone: data.time_zone,
      attendeeEmails: [data.email || '', 'malik@divineacquisition.io'],
    });
    eventId = event.eventId;
    meetUrl = event.meetUrl;
  } catch (calendarError) {
    await controlRpc(supabase, 'acq_release_schedule_slot', {
      p_token: token,
      p_starts_at: data.scheduled_for,
      p_previous_stage: data.previous_stage || 'Step 1 Captured',
    });
    return {
      ok: false,
      error:
        calendarError instanceof Error
          ? `Google Calendar could not be created. ${calendarError.message}`
          : 'Google Calendar could not be created.',
    };
  }

  let appointmentId: string | null = null;
  try {
    if (!data.ghl_contact_id) throw new Error('This application is missing a GoHighLevel contact.');
    await updateGhlContactPhone(data.ghl_contact_id, phone.trim());
    appointmentId = await createAcqGhlAppointment({
      contactId: data.ghl_contact_id,
      title: `Audit: ${name}`,
      startsAt: data.scheduled_for,
      endsAt,
      meetUrl,
    });
  } catch (ghlError) {
    if (eventId) await deleteGoogleCalendarEvent(eventId);
    await controlRpc(supabase, 'acq_release_schedule_slot', {
      p_token: token,
      p_starts_at: data.scheduled_for,
      p_previous_stage: data.previous_stage || 'Step 1 Captured',
    });
    return {
      ok: false,
      error:
        ghlError instanceof Error
          ? `GoHighLevel could not be updated. ${ghlError.message}`
          : 'GoHighLevel could not be updated.',
    };
  }

  let confirmationId: string | null = null;
  if (data.email) {
    try {
      const sent = await sendAcqAuditEmail({
        to: data.email,
        fullName: name,
        offer: data.coaching_niche,
        startsAt: data.scheduled_for,
        timeZone: data.time_zone,
        meetUrl,
        kind: 'confirmation',
      });
      confirmationId = sent.id;
    } catch (emailError) {
      console.error('[acq] confirmation email failed', emailError);
    }
  }

  await controlRpc(supabase, 'acq_attach_schedule_booking', {
    p_token: token,
    p_meet_url: meetUrl,
    p_calendar_event_id: eventId,
    p_ghl_appointment_id: appointmentId,
    p_confirmation_email_id: confirmationId,
  });

  return {
    ok: true,
    startsAt: data.scheduled_for,
    timeZone: data.time_zone,
    meetUrl,
    alreadyBooked: false,
  };
}
