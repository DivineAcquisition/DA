'use server';

import { revalidatePath } from 'next/cache';
import { calendarConfigured, createGoogleMeetEvent } from '@/lib/assessment/calendar';
import { markProspectCallAirtable, recordProspectCall } from '@/lib/calls/store';
import { isoDateInTimeZone, localDateTimeToIso } from '@/lib/datetime/local';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import { workspaceClient } from '@/lib/workspace/db';
import { WORKSPACE_AGREEMENT_CC } from '@/lib/workspace/email';
import { applyBookingToLead, markLeadAirtable, upsertLeadFromQualification } from './leads';
import { airtableReady } from './pipeline';
import { sendProspectCallConfirmationEmail } from './booking-email';
import {
  airtableBookingFields,
  getProspect,
  mapLeadRow,
  mapProspectToCallSetup,
  searchProspects,
  sendProspectToAirtable,
  type ProspectRecord,
  type ProspectSearchInput,
} from './prospects';
import {
  parseQualification,
  QualificationError,
} from './qualify';
import { scoreQualification } from './score';

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

  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured. Prospect records live in the workspace.' };
  }

  try {
    const prospects = await searchProspects(input);
    return { ok: true, prospects };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Workspace search failed.',
    };
  }
}

export async function createProspectAction(
  formData: FormData,
): Promise<{ ok: true; message: string; prospect: ProspectRecord } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured. The workspace cannot store this prospect.' };
  }

  try {
    const payload = parseQualification({
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      companyName: String(formData.get('companyName') ?? ''),
      adSpend: String(formData.get('adSpend') ?? ''),
      followUp: String(formData.get('followUp') ?? ''),
      programPrice: String(formData.get('programPrice') ?? ''),
    });
    const lead = await upsertLeadFromQualification(payload, '', false);
    const prospect = mapLeadRow(lead);
    const score = scoreQualification(payload);

    let airtableNote = 'Airtable send skipped — no destination PAT.';
    if (await airtableReady()) {
      try {
        const recordId = await sendProspectToAirtable(prospect);
        await markLeadAirtable(lead.id, { recordId });
        airtableNote = 'Copy sent to Airtable.';
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Airtable send failed.';
        await markLeadAirtable(lead.id, { error: detail });
        airtableNote = `Saved in the workspace. Airtable send failed: ${detail}`;
      }
    }

    revalidatePath('/workspace/bookings');
    return {
      ok: true,
      prospect: { ...prospect, airtableRecordId: lead.airtable_record_id ?? prospect.airtableRecordId },
      message: `Saved ${payload.fullName} (${score.qualificationResult}, ${score.readinessScore}). ${airtableNote}`,
    };
  } catch (error) {
    if (error instanceof QualificationError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Could not create that prospect.' };
  }
}

export async function scheduleProspectCallAction(
  formData: FormData,
): Promise<{ ok: true; message: string; meetUrl?: string | null } | { ok: false; error: string }> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };

  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured. Bookings land in the workspace first.' };
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
    return { ok: false, error: 'That workspace lead could not be loaded.' };
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

  const nextStage = fields.Stage || prospect.stage;
  const nextNotes = fields.Notes || prospect.notes;
  const dateStamp = isoDateInTimeZone(startsAtIso, timeZone);

  let booked: ProspectRecord;
  try {
    booked = mapLeadRow(
      await applyBookingToLead({
        leadId: prospect.recordId,
        email,
        fullName,
        companyName: companyName || prospect.companyName,
        auditBookedDate: dateStamp,
        notes: nextNotes,
        stage: nextStage,
        meetUrl,
        eventId,
      }),
    );
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Meet was created, but the workspace lead did not update: ${error.message}`
          : 'Meet was created, but the workspace lead did not update.',
    };
  }

  let airtableWarning: string | null = null;
  let airtableRecordId = booked.airtableRecordId;
  let airtableSent = false;
  if (await airtableReady()) {
    try {
      airtableRecordId = await sendProspectToAirtable({ ...booked, email, fullName });
      await markLeadAirtable(booked.recordId, { recordId: airtableRecordId });
      airtableSent = Boolean(airtableRecordId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Airtable send failed.';
      await markLeadAirtable(booked.recordId, { error: detail });
      airtableWarning = `Meet is on the calendar and the workspace has the booking. Airtable did not update: ${detail}`;
    }
  } else {
    airtableWarning = 'Booking saved in the workspace. Airtable destination PAT is not set, so no copy was sent.';
  }

  try {
    const saved = await recordProspectCall({
      kind: 'booking',
      source: 'calendar',
      airtableLeadId: airtableRecordId || undefined,
      email,
      fullName,
      externalRef: eventId || undefined,
      occurredAt: startsAtIso,
      meetUrl: meetUrl || undefined,
      googleEventId: eventId || undefined,
      payload: {
        leadId: booked.recordId,
        startsAtIso,
        timeZone,
        durationMinutes,
        currentStage: prospect.stage,
        existingNotes: prospect.notes,
        existingEmail: prospect.email,
      },
    });
    const supabase = await workspaceClient();
    if (supabase) {
      await supabase.from('da_prospect_call').update({ lead_id: booked.recordId }).eq('id', saved.id);
    }
    if (airtableSent && airtableRecordId) {
      try {
        await markProspectCallAirtable({
          id: saved.id,
          airtableLeadId: airtableRecordId,
        });
      } catch {
        // Cron may retry. appendBookingNote skips a stamp already in Notes.
      }
    }
  } catch (error) {
    airtableWarning = [
      airtableWarning,
      error instanceof Error
        ? `Call log failed: ${error.message}`
        : 'Call log failed.',
    ]
      .filter(Boolean)
      .join(' ');
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

  return {
    ok: true,
    meetUrl,
    message: [
      `Booked ${fullName} for ${when}.`,
      meetUrl ? 'Google Meet is on the invite.' : 'Calendar event created (Meet link pending).',
      airtableWarning ?? `Logged in the workspace and sent to Airtable (Audit Booked, ${dateStamp}).`,
      emailWarning ?? 'Confirmation emailed (CC Malik).',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
