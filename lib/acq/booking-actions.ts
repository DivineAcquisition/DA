'use server';

import { revalidatePath } from 'next/cache';
import { calendarConfigured, createGoogleMeetEvent } from '@/lib/assessment/calendar';
import { isoDateInTimeZone, localDateTimeToIso } from '@/lib/datetime/local';
import { getSessionContext } from '@/lib/supabase/server';
import { WORKSPACE_AGREEMENT_CC } from '@/lib/workspace/email';
import { airtableConfigured } from './pipeline';
import { sendProspectCallConfirmationEmail } from './booking-email';
import {
  airtableBookingFields,
  getProspect,
  mapProspectToCallSetup,
  searchProspects,
  writeBookingToAirtable,
  type ProspectRecord,
  type ProspectSearchInput,
} from './prospects';

export type ProspectSearchResult =
  | { ok: true; prospects: ProspectRecord[] }
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ email: string } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.isAdmin) {
    return { error: 'Admin access required.' };
  }
  return { email: session.email };
}

export async function searchProspectsAction(
  input: ProspectSearchInput = {},
): Promise<ProspectSearchResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };

  if (!airtableConfigured()) {
    return {
      ok: false,
      error: 'Airtable is not configured. Set AIRTABLE_API_KEY (base and Leads table already default to DA Pipeline).',
    };
  }

  try {
    const prospects = await searchProspects(input);
    return { ok: true, prospects };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Airtable search failed.',
    };
  }
}

export async function scheduleProspectCallAction(
  formData: FormData,
): Promise<{ ok: true; message: string; meetUrl?: string | null } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };

  if (!airtableConfigured()) {
    return { ok: false, error: 'Airtable is not configured.' };
  }
  if (!calendarConfigured()) {
    return {
      ok: false,
      error:
        'Google Calendar is not configured. Set GOOGLE_CALENDAR_SUBJECT_EMAIL (and the service-account key) so Meet links can be created.',
    };
  }

  const recordId = String(formData.get('recordId') ?? '').trim();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const companyName = String(formData.get('companyName') ?? '').trim();
  const extraNote = String(formData.get('note') ?? '').trim();
  const timeZone = String(formData.get('timeZone') ?? 'America/New_York').trim() || 'America/New_York';
  const durationMinutes = Number(formData.get('durationMinutes') ?? 30) || 30;
  const localDateTime = String(formData.get('startsAtLocal') ?? '').trim();

  if (!recordId || !fullName || !email || !localDateTime) {
    return { ok: false, error: 'Prospect, name, email, and date/time are required.' };
  }
  if (durationMinutes < 15 || durationMinutes > 120) {
    return { ok: false, error: 'Duration must be between 15 and 120 minutes.' };
  }

  const startsAtIso = localDateTimeToIso(localDateTime, timeZone);
  if (!startsAtIso) {
    return { ok: false, error: 'Could not parse that date/time.' };
  }
  if (new Date(startsAtIso).getTime() < Date.now() - 5 * 60_000) {
    return { ok: false, error: 'Pick a time in the future.' };
  }

  const prospect = await getProspect(recordId);
  if (!prospect) {
    return { ok: false, error: 'That Airtable lead could not be loaded.' };
  }

  const setup = mapProspectToCallSetup(
    {
      ...prospect,
      fullName,
      email,
      companyName: companyName || prospect.companyName,
    },
    { timeZone, durationMinutes },
  );

  const endsAtIso = new Date(new Date(startsAtIso).getTime() + durationMinutes * 60_000).toISOString();
  const attendees = [email, admin.email, ...WORKSPACE_AGREEMENT_CC];
  const description = [setup.description, extraNote ? `Admin note: ${extraNote}` : null]
    .filter(Boolean)
    .join('\n');

  let meetUrl: string | null = null;
  let calendarUrl: string | null = null;
  let eventId: string | null = null;

  try {
    const event = await createGoogleMeetEvent({
      summary: setup.summary,
      description,
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      timeZone,
      attendeeEmails: attendees,
    });
    eventId = event.eventId;
    meetUrl = event.meetUrl;
    calendarUrl = event.htmlLink;
  } catch (calendarError) {
    return {
      ok: false,
      error:
        calendarError instanceof Error
          ? `Google Meet could not be created: ${calendarError.message}`
          : 'Google Meet could not be created.',
    };
  }

  const fields = airtableBookingFields({
    currentStage: prospect.stage,
    startsAtIso,
    timeZone,
    durationMinutes,
    meetUrl,
    eventId,
    existingNotes: prospect.notes,
    email,
    existingEmail: prospect.email,
  });

  let airtableWarning: string | null = null;
  try {
    await writeBookingToAirtable(recordId, fields);
  } catch (writeError) {
    airtableWarning =
      writeError instanceof Error
        ? `Meet was created, but Airtable did not update: ${writeError.message}`
        : 'Meet was created, but Airtable did not update.';
  }

  let emailWarning: string | null = null;
  try {
    await sendProspectCallConfirmationEmail({
      to: email,
      fullName,
      companyName: companyName || prospect.companyName,
      startsAt: startsAtIso,
      timeZone,
      durationMinutes,
      meetUrl,
      calendarUrl,
    });
  } catch (sendError) {
    emailWarning =
      sendError instanceof Error
        ? `Calendar invite went out; confirmation email failed: ${sendError.message}`
        : 'Calendar invite went out; confirmation email failed.';
  }

  revalidatePath('/workspace/bookings');

  const when = new Date(startsAtIso).toLocaleString('en-US', { timeZone });
  const dateStamp = isoDateInTimeZone(startsAtIso, timeZone);

  return {
    ok: true,
    meetUrl,
    message: [
      `Booked ${fullName} for ${when}.`,
      meetUrl ? `Google Meet is on the invite.` : 'Calendar event created (Meet link pending).',
      airtableWarning ?? `Airtable moved to Audit Booked (${dateStamp}).`,
      emailWarning ?? 'Confirmation emailed (CC Malik).',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
