import { escapeFormulaValue, isRecordId, sanitizeSearchQuery } from './cells';
import { createRecord, getRecord, listRecords, tables, updateRecord } from './airtable';
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
import type { AuditDebriefInput, LeadProfile, LeadRecord, PhoneTouchInput } from './types';

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

  const [touchRows, debriefRows] = await Promise.all([
    listRecords(tables.touches, {
      formula: linkedToLeadFormula(lead.recordId),
      fields: TOUCH_FIELDS,
    }),
    listRecords(tables.debriefs, {
      formula: linkedToLeadFormula(lead.recordId),
      fields: DEBRIEF_FIELDS,
    }),
  ]);

  const touches = touchRows.map(mapTouchRecord).sort(compareDatedDesc);
  const debriefs = debriefRows
    .map(mapDebriefRecord)
    .sort((a, b) => compareDatedDesc({ date: a.callDate, recordId: a.recordId }, { date: b.callDate, recordId: b.recordId }));

  return {
    lead,
    touches,
    debriefs,
    history: historyFrom(touches, debriefs),
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

export { isDebriefComplete };
