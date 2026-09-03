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
  debriefWriteFields,
  historyFrom,
  isDebriefComplete,
  LEAD_LIST_FIELDS,
  mapDebriefRecord,
  mapLeadRecord,
  mapTouchRecord,
  todayInCallsZone,
  TOUCH_FIELDS,
  touchWriteFields,
} from './map';
import type {
  AuditDebriefInput,
  LeadProfile,
  LeadRecord,
  OnboardSubmitInput,
  OnboardingRecord,
  PhoneTouchInput,
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

  return {
    lead,
    touches,
    debriefs,
    history: historyFrom(touches, debriefs),
    onboarding,
  };
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
) {
  const written = await createRecord(tables.touches, touchWriteFields({ ...input, leadName, date }));
  return mapTouchRecord(written);
}

export async function saveDebrief(input: AuditDebriefInput, leadName: string) {
  const fields = debriefWriteFields({ ...input, leadName });
  const written = input.debriefId
    ? await updateRecord(tables.debriefs, input.debriefId, fields)
    : await createRecord(tables.debriefs, fields);
  return mapDebriefRecord(written);
}

export async function attachDebriefTranscript(debriefId: string, transcript: string) {
  const written = await updateRecord(tables.debriefs, debriefId, { Transcript: transcript });
  return mapDebriefRecord(written);
}

export async function attachDebriefRecording(debriefId: string, recordingLink: string) {
  const written = await updateRecord(tables.debriefs, debriefId, { 'Recording Link': recordingLink });
  return mapDebriefRecord(written);
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
