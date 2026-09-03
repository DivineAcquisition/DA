import { escapeFormulaValue, isRecordId, sanitizeSearchQuery } from './cells';
import { createRecord, getRecord, listRecords, tables, updateRecord } from './airtable';
import {
  clientBaseWriteFields,
  mapOnboardingRecord,
  ONBOARDING_FIELDS,
  onboardingWriteFields,
  paymentPaidWriteFields,
} from './conversion';
import {
  compareDatedDesc,
  compareLeads,
  DEBRIEF_FIELDS,
  historyFrom,
  isDebriefComplete,
  LEAD_LIST_FIELDS,
  mapDebriefRecord,
  mapLeadRecord,
  mapTouchRecord,
  todayInCallsZone,
  TOUCH_FIELDS,
} from './map';
import { overlayCallsOnProfile } from './overlay';
import { listProspectCalls } from './store';
import {
  recordAndSendArtifact,
  recordAndSendDebrief,
  recordAndSendPhone,
} from './sync';
import type {
  AuditDebriefInput,
  DebriefRecord,
  LeadProfile,
  LeadRecord,
  OnboardSubmitInput,
  OnboardingRecord,
  PhoneTouchInput,
  ProspectCall,
  TouchRecord,
} from './types';

export function linkedToLeadFormula(leadId: string): string {
  return `FIND('${escapeFormulaValue(leadId)}',ARRAYJOIN({Lead}))`;
}

export function leadSearchFormula(query?: string): string | null {
  const cleaned = sanitizeSearchQuery(query ?? '');
  if (!cleaned) return null;
  const needle = escapeFormulaValue(cleaned.toLowerCase());
  const fields = ['Lead Name', 'Email', 'Company Name', 'Phone', 'Coaching Niche'];
  return `OR(${fields.map((field) => `FIND('${needle}',LOWER({${field}}&''))`).join(',')})`;
}

export async function listLeads(query?: string): Promise<LeadRecord[]> {
  const records = await listRecords(tables.leads, {
    formula: leadSearchFormula(query),
    fields: LEAD_LIST_FIELDS,
    sortField: 'Created',
    sortDirection: 'desc',
    maxRecords: 200,
  });
  return records.map(mapLeadRecord).sort(compareLeads);
}

export async function getLead(recordId: string): Promise<LeadRecord | null> {
  if (!isRecordId(recordId)) return null;
  try {
    const record = await getRecord(tables.leads, recordId);
    return mapLeadRecord(record);
  } catch {
    return null;
  }
}

export async function getLeadProfile(recordId: string): Promise<LeadProfile | null> {
  const lead = await getLead(recordId);
  if (!lead) return null;

  const [touchRows, debriefRows, onboardRows] = await Promise.all([
    listRecords(tables.touches, {
      formula: linkedToLeadFormula(lead.recordId),
      fields: TOUCH_FIELDS,
    }),
    listRecords(tables.debriefs, {
      formula: linkedToLeadFormula(lead.recordId),
      fields: DEBRIEF_FIELDS,
    }),
    listRecords(tables.onboarding, {
      formula: linkedToLeadFormula(lead.recordId),
      fields: ONBOARDING_FIELDS,
      maxRecords: 5,
    }),
  ]);

  const touches = touchRows.map(mapTouchRecord).sort(compareDatedDesc);
  const debriefs = debriefRows
    .map(mapDebriefRecord)
    .sort((a, b) => compareDatedDesc({ date: a.callDate, recordId: a.recordId }, { date: b.callDate, recordId: b.recordId }));

  const onboarding = onboardRows
    .map(mapOnboardingRecord)
    .sort((a, b) =>
      compareDatedDesc(
        { date: a.submitted, recordId: a.recordId },
        { date: b.submitted, recordId: b.recordId },
      ),
    )[0] ?? null;

  const profile: LeadProfile = {
    lead,
    touches,
    debriefs,
    history: historyFrom(touches, debriefs),
    onboarding,
    incomingCall: null,
    pendingAirtableSend: false,
  };

  try {
    const calls = await listProspectCalls(lead.recordId);
    return overlayCallsOnProfile(profile, calls);
  } catch (error) {
    console.error('listProspectCalls', error);
    return profile;
  }
}

export async function findProspectCallByDebrief(
  leadId: string,
  debriefId: string,
): Promise<ProspectCall | null> {
  const rows = await listProspectCalls(leadId);
  return rows.find((row) => row.airtableDebriefId === debriefId) ?? null;
}

export async function getDebrief(recordId: string) {
  if (!isRecordId(recordId)) return null;
  try {
    return mapDebriefRecord(await getRecord(tables.debriefs, recordId));
  } catch {
    return null;
  }
}

export async function saveCallBriefNote(leadId: string, note: string): Promise<void> {
  await updateRecord(tables.leads, leadId, { 'Call Brief Note': note });
}

export async function createTouch(
  input: PhoneTouchInput,
  leadName: string,
  date = todayInCallsZone(),
): Promise<TouchRecord> {
  return recordAndSendPhone(input, leadName, date);
}

export async function saveDebrief(input: AuditDebriefInput, leadName: string): Promise<DebriefRecord> {
  const existing = input.debriefId
    ? await findProspectCallByDebrief(input.leadId, input.debriefId)
    : null;
  return recordAndSendDebrief(input, leadName, existing?.id);
}

export async function attachDebriefArtifacts(
  leadId: string,
  debriefId: string,
  input: { transcript?: string; recordingLink?: string },
): Promise<DebriefRecord> {
  const existing = await findProspectCallByDebrief(leadId, debriefId);
  await recordAndSendArtifact({
    leadId,
    debriefId,
    existingCallId: existing?.id,
    recordingUrl: input.recordingLink,
    transcript: input.transcript,
  });
  const debrief = await getDebrief(debriefId);
  if (!debrief) throw new Error('Debrief could not be reloaded after attach.');
  return debrief;
}

export async function confirmPaymentReceived(leadId: string) {
  const written = await updateRecord(tables.leads, leadId, paymentPaidWriteFields());
  return mapLeadRecord(written);
}

export async function recordClientBase(
  leadId: string,
  input: { baseId: string; name: string; created?: string },
) {
  const written = await updateRecord(tables.leads, leadId, clientBaseWriteFields(input));
  return mapLeadRecord(written);
}

export async function saveClientOnboarding(
  input: OnboardSubmitInput,
  leadName: string,
): Promise<OnboardingRecord> {
  const existing = await listRecords(tables.onboarding, {
    formula: linkedToLeadFormula(input.leadId),
    fields: ONBOARDING_FIELDS,
    maxRecords: 1,
  });
  const fields = onboardingWriteFields({ ...input, leadName });
  const written = existing[0]
    ? await updateRecord(tables.onboarding, existing[0].id, fields)
    : await createRecord(tables.onboarding, fields);
  return mapOnboardingRecord(written);
}

export { isDebriefComplete };
