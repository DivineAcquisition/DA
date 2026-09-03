import { airtableBookingFields, writeBookingToAirtable } from '@/lib/acq/prospects';
import { isoDateInTimeZone } from '@/lib/datetime/local';
import { createRecord, getRecord, tables, updateRecord } from './airtable';
import { cellText } from './cells';
import { CALLS_TIME_ZONE } from './config';
import { matchInboundLead } from './lookup';
import {
  debriefWriteFields,
  mapDebriefRecord,
  mapTouchRecord,
  todayInCallsZone,
  touchWriteFields,
} from './map';
import { markProspectCallAirtable, listUnsyncedProspectCalls, recordProspectCall, type RecordProspectCallInput } from './store';
import type {
  AuditDebriefInput,
  DebriefRecord,
  PhoneTouchInput,
  ProspectCall,
  TouchRecord,
} from './types';

async function resolveLeadId(call: ProspectCall): Promise<string> {
  if (call.airtableLeadId) return call.airtableLeadId;
  const ghlId = String(call.payload.ghl_contact_id ?? call.payload.contactId ?? '').trim();
  const matched = await matchInboundLead({ email: call.email, ghlContactId: ghlId });
  if (matched) return matched;
  throw new Error('No matching Airtable lead for this call.');
}

async function leadNameFor(leadId: string, fallback: string): Promise<string> {
  if (fallback.trim()) return fallback.trim();
  try {
    const record = await getRecord(tables.leads, leadId);
    return cellText(record.fields?.['Lead Name']) || fallback;
  } catch {
    return fallback;
  }
}

export async function sendProspectCallToAirtable(
  call: ProspectCall,
  useService = false,
): Promise<ProspectCall> {
  try {
    const leadId = await resolveLeadId(call);
    const sent = await writeCallToAirtable({ ...call, airtableLeadId: leadId });
    return await markProspectCallAirtable(
      {
        id: call.id,
        airtableLeadId: leadId,
        airtableTouchId: sent.airtableTouchId || undefined,
        airtableDebriefId: sent.airtableDebriefId || undefined,
      },
      useService,
    );
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'Airtable send failed.').slice(0, 2000);
    try {
      await markProspectCallAirtable({ id: call.id, error: message }, useService);
    } catch {
      // The send error is the one the operator needs to see.
    }
    throw new Error(message);
  }
}

async function writeCallToAirtable(call: ProspectCall): Promise<{
  airtableTouchId: string;
  airtableDebriefId: string;
}> {
  const leadId = call.airtableLeadId;
  if (call.kind === 'booking') {
    await sendBooking(call, leadId);
    return { airtableTouchId: call.airtableTouchId, airtableDebriefId: call.airtableDebriefId };
  }
  if (call.kind === 'phone') {
    const touchId = await sendPhone(call, leadId);
    return { airtableTouchId: touchId, airtableDebriefId: call.airtableDebriefId };
  }
  if (call.kind === 'audit') {
    const debriefId = await sendAudit(call, leadId);
    return { airtableTouchId: call.airtableTouchId, airtableDebriefId: debriefId };
  }
  await sendArtifact(call);
  return { airtableTouchId: call.airtableTouchId, airtableDebriefId: call.airtableDebriefId };
}

async function sendBooking(call: ProspectCall, leadId: string): Promise<void> {
  const record = await getRecord(tables.leads, leadId);
  const fields = record.fields ?? {};
  const startsAtIso = String(call.payload.startsAtIso ?? call.occurredAt ?? new Date().toISOString());
  const timeZone = String(call.payload.timeZone ?? CALLS_TIME_ZONE);
  const durationMinutes = Number(call.payload.durationMinutes ?? 30) || 30;
  await writeBookingToAirtable(
    leadId,
    airtableBookingFields({
      currentStage: cellText(fields.Stage) || String(call.payload.currentStage ?? ''),
      startsAtIso,
      timeZone,
      durationMinutes,
      meetUrl: call.meetUrl || undefined,
      eventId: call.googleEventId || undefined,
      existingNotes: cellText(fields.Notes) || String(call.payload.existingNotes ?? ''),
      email: call.email || undefined,
      existingEmail: cellText(fields.Email),
    }),
  );
}

async function sendPhone(call: ProspectCall, leadId: string): Promise<string> {
  if (call.airtableTouchId) {
    const written = await updateRecord(
      tables.touches,
      call.airtableTouchId,
      touchFieldsFromCall(call, leadId),
    );
    return written.id;
  }
  const written = await createRecord(tables.touches, touchFieldsFromCall(call, leadId));
  return written.id;
}

function touchFieldsFromCall(call: ProspectCall, leadId: string): Record<string, unknown> {
  const date =
    String(call.payload.date ?? '').slice(0, 10) ||
    (call.occurredAt ? isoDateInTimeZone(call.occurredAt, CALLS_TIME_ZONE) : todayInCallsZone());
  const input: PhoneTouchInput = {
    leadId,
    channel: (String(call.payload.channel ?? 'Call') as PhoneTouchInput['channel']) || 'Call',
    outcome: (String(call.payload.outcome ?? 'Replied') as PhoneTouchInput['outcome']) || 'Replied',
    sentiment: (String(call.payload.sentiment ?? 'Neutral') as PhoneTouchInput['sentiment']) || 'Neutral',
    summary: String(call.payload.summary ?? ''),
    recordingLink: call.recordingUrl || undefined,
    transcript: call.transcript || undefined,
  };
  const leadName = String(call.payload.leadName ?? call.fullName ?? '');
  return touchWriteFields({ ...input, leadName, date });
}

async function sendAudit(call: ProspectCall, leadId: string): Promise<string> {
  const leadName = String(call.payload.leadName ?? call.fullName ?? '');
  const input = debriefInputFromCall(call, leadId);
  const existingDebrief = call.airtableDebriefId || String(call.payload.debriefId ?? '');
  const fields = debriefWriteFields({ ...input, leadName });
  if (existingDebrief) {
    const written = await updateRecord(tables.debriefs, existingDebrief, fields);
    return written.id;
  }
  const written = await createRecord(tables.debriefs, fields);
  return written.id;
}

function debriefInputFromCall(call: ProspectCall, leadId: string): AuditDebriefInput {
  const payload = call.payload;
  const amount = Number(payload.amountQuoted);
  const confidence = Number(payload.closeConfidence);
  return {
    leadId,
    debriefId: call.airtableDebriefId || undefined,
    callDate: String(payload.callDate ?? '').slice(0, 10) || todayInCallsZone(),
    callType: (payload.callType as AuditDebriefInput['callType']) ?? '',
    owner: (payload.owner as AuditDebriefInput['owner']) ?? '',
    statedGoal: String(payload.statedGoal ?? ''),
    currentSituation: String(payload.currentSituation ?? ''),
    whatTheyTried: String(payload.whatTheyTried ?? ''),
    whyNow: String(payload.whyNow ?? ''),
    outcome: (payload.outcome as AuditDebriefInput['outcome']) ?? '',
    objection: (payload.objection as AuditDebriefInput['objection']) ?? '',
    amountQuoted: Number.isFinite(amount) ? amount : null,
    decisionMakers: String(payload.decisionMakers ?? ''),
    theirTimeline: (payload.theirTimeline as AuditDebriefInput['theirTimeline']) ?? '',
    agreedNextStep: String(payload.agreedNextStep ?? ''),
    nextStepDate: String(payload.nextStepDate ?? ''),
    closeConfidence: Number.isFinite(confidence) ? confidence : null,
    dealRisk: String(payload.dealRisk ?? ''),
    recordingLink: call.recordingUrl || undefined,
    transcript: call.transcript || undefined,
    complete: payload.complete === true,
  };
}

async function sendArtifact(call: ProspectCall): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (call.recordingUrl) fields['Recording Link'] = call.recordingUrl;
  if (call.transcript) fields.Transcript = call.transcript;
  const debriefId = call.airtableDebriefId || String(call.payload.debriefId ?? '');
  const touchId = call.airtableTouchId || String(call.payload.touchId ?? '');
  if (debriefId) {
    await updateRecord(tables.debriefs, debriefId, fields);
    return;
  }
  if (touchId) {
    await updateRecord(tables.touches, touchId, fields);
    return;
  }
  throw new Error('Artifact has no Airtable debrief or touch to attach to.');
}

async function persistAndSend(input: RecordProspectCallInput): Promise<ProspectCall> {
  const saved = await recordProspectCall(input);
  return sendProspectCallToAirtable(saved);
}

export async function recordAndSendPhone(
  input: PhoneTouchInput,
  leadName: string,
  date = todayInCallsZone(),
): Promise<TouchRecord> {
  const sent = await persistAndSend({
    kind: 'phone',
    source: 'operator',
    airtableLeadId: input.leadId,
    fullName: leadName,
    occurredAt: new Date().toISOString(),
    recordingUrl: input.recordingLink,
    transcript: input.transcript,
    payload: { ...input, leadName, date },
  });
  if (!sent.airtableTouchId) {
    throw new Error(sent.airtableSyncError || 'Airtable did not return a Touches record.');
  }
  return mapTouchRecord(await getRecord(tables.touches, sent.airtableTouchId));
}

export async function recordAndSendDebrief(
  input: AuditDebriefInput,
  leadName: string,
  existingCallId?: string,
): Promise<DebriefRecord> {
  const sent = await persistAndSend({
    id: existingCallId,
    kind: 'audit',
    source: 'operator',
    airtableLeadId: input.leadId,
    fullName: leadName,
    occurredAt: input.callDate ? `${input.callDate}T12:00:00.000Z` : undefined,
    recordingUrl: input.recordingLink,
    transcript: input.transcript,
    airtableDebriefId: input.debriefId,
    payload: { ...input, leadName, complete: input.complete },
  });
  if (!sent.airtableDebriefId) {
    throw new Error(sent.airtableSyncError || 'Airtable did not return a Call Debriefs record.');
  }
  return mapDebriefRecord(await getRecord(tables.debriefs, sent.airtableDebriefId));
}

export async function recordAndSendArtifact(input: {
  leadId: string;
  debriefId?: string;
  touchId?: string;
  existingCallId?: string;
  recordingUrl?: string;
  transcript?: string;
}): Promise<ProspectCall> {
  return persistAndSend({
    id: input.existingCallId,
    kind: 'artifact',
    source: 'operator',
    airtableLeadId: input.leadId,
    recordingUrl: input.recordingUrl,
    transcript: input.transcript,
    airtableDebriefId: input.debriefId,
    airtableTouchId: input.touchId,
    payload: { debriefId: input.debriefId, touchId: input.touchId },
  });
}

export async function recordAndSendBooking(input: {
  leadId: string;
  email: string;
  fullName: string;
  startsAtIso: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  eventId?: string | null;
  currentStage: string;
  existingNotes: string;
  existingEmail: string;
}): Promise<ProspectCall> {
  return persistAndSend({
    kind: 'booking',
    source: 'calendar',
    airtableLeadId: input.leadId,
    email: input.email,
    fullName: input.fullName,
    externalRef: input.eventId || undefined,
    occurredAt: input.startsAtIso,
    meetUrl: input.meetUrl || undefined,
    googleEventId: input.eventId || undefined,
    payload: {
      startsAtIso: input.startsAtIso,
      timeZone: input.timeZone,
      durationMinutes: input.durationMinutes,
      currentStage: input.currentStage,
      existingNotes: input.existingNotes,
      existingEmail: input.existingEmail,
    },
  });
}

export async function drainUnsyncedProspectCalls(limit = 40): Promise<{ sent: number; failed: number }> {
  const rows = await listUnsyncedProspectCalls(limit);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await sendProspectCallToAirtable(row, true);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

export async function leadNameFromRecord(leadId: string): Promise<string> {
  return leadNameFor(leadId, '');
}
