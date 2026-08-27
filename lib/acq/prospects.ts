import {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_LEADS_TABLE_ID,
} from './config';
import { PipelineStepError } from './pipeline';
import {
  normalizeQualificationResult,
  parseReadinessScore,
  type QualificationResult,
} from './qualify';
import { isoDateInTimeZone } from '../datetime/local';

const REQUEST_MS = 20_000;

export const AIRTABLE_LEADS_URL = `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_LEADS_TABLE_ID}`;

export const CLOSED_STAGES = [
  'Closed Won',
  'Closed Lost',
  'Disqualified',
  'Recycled',
] as const;

export const STAGE_ADVANCE_TO_BOOKED = [
  'Step 1 Captured',
  'Application Abandoned',
  'Manual Review',
  'Qualified - Not Booked',
  'Audit Booked',
] as const;

export const PROSPECT_FIELD_NAMES = [
  'Lead Name',
  'Email',
  'Phone',
  'Company Name',
  'Coaching Niche',
  'Stage',
  'Qualification Result',
  'Readiness Score',
  'Monthly Ad Spend',
  'Follow-Up Owner',
  'Program Price',
  'Next Action',
  'GHL Contact ID',
  'Audit Booked Date',
  'Notes',
  'Google Meet URL',
  'Calendar Event ID',
] as const;

const MEET_WRITE_FIELDS = ['Google Meet URL', 'Calendar Event ID'] as const;

export type ProspectRecord = {
  recordId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  coachingNiche: string;
  stage: string;
  qualificationResult: QualificationResult | null;
  readinessScore: number | null;
  monthlyAdSpend: string;
  followUpOwner: string;
  programPrice: string;
  nextAction: string;
  ghlContactId: string;
  auditBookedDate: string;
  notes: string;
  meetUrl: string;
  calendarEventId: string;
  airtableUrl: string;
  briefing: string;
};

export type CallSetup = {
  recordId: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  durationMinutes: number;
  timeZone: string;
  note: string;
  summary: string;
  description: string;
};

export type ProspectSearchInput = {
  query?: string;
  includeManualReview?: boolean;
  bookedOnly?: boolean;
  limit?: number;
};

function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return cellText((value as { name?: unknown }).name);
  }
  return '';
}

export function airtableRecordUrl(recordId: string): string {
  return `${AIRTABLE_LEADS_URL}/${recordId}`;
}

export function sanitizeSearchQuery(query: string): string {
  return query.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "''");
}

function qualificationClause(includeManualReview: boolean): string {
  return includeManualReview
    ? "OR({Qualification Result}='Qualified',{Qualification Result}='Manual Review')"
    : "{Qualification Result}='Qualified'";
}

function notClosedClause(): string {
  return `NOT(OR(${CLOSED_STAGES.map((stage) => `{Stage}='${stage}'`).join(',')}))`;
}

function searchClause(query: string): string | null {
  const cleaned = sanitizeSearchQuery(query);
  if (!cleaned) return null;
  const needle = escapeFormulaValue(cleaned.toLowerCase());
  const fields = ['Lead Name', 'Email', 'Company Name', 'Phone', 'Coaching Niche'];
  return `OR(${fields
    .map((field) => `FIND('${needle}',LOWER({${field}}&''))`)
    .join(',')})`;
}

export function prospectSearchFormula(input: ProspectSearchInput = {}): string {
  const clauses: string[] = [];

  if (input.bookedOnly) {
    clauses.push("{Stage}='Audit Booked'");
  } else {
    clauses.push(qualificationClause(Boolean(input.includeManualReview)));
    clauses.push(notClosedClause());
  }

  const search = searchClause(input.query ?? '');
  if (search) clauses.push(search);

  if (clauses.length === 1) return clauses[0];
  return `AND(${clauses.join(',')})`;
}

export function mapAirtableRecord(record: {
  id: string;
  fields?: Record<string, unknown>;
}): ProspectRecord {
  const fields = record.fields ?? {};
  const fullName = cellText(fields['Lead Name']);
  const companyName = cellText(fields['Company Name']) || cellText(fields['Coaching Niche']);

  const mapped: ProspectRecord = {
    recordId: record.id,
    fullName,
    email: cellText(fields.Email).toLowerCase(),
    phone: cellText(fields.Phone),
    companyName,
    coachingNiche: cellText(fields['Coaching Niche']),
    stage: cellText(fields.Stage),
    qualificationResult: normalizeQualificationResult(cellText(fields['Qualification Result'])),
    readinessScore: parseReadinessScore(fields['Readiness Score']),
    monthlyAdSpend: cellText(fields['Monthly Ad Spend']),
    followUpOwner: cellText(fields['Follow-Up Owner']),
    programPrice: cellText(fields['Program Price']),
    nextAction: cellText(fields['Next Action']),
    ghlContactId: cellText(fields['GHL Contact ID']),
    auditBookedDate: cellText(fields['Audit Booked Date']),
    notes: cellText(fields.Notes),
    meetUrl: cellText(fields['Google Meet URL']),
    calendarEventId: cellText(fields['Calendar Event ID']),
    airtableUrl: airtableRecordUrl(record.id),
    briefing: '',
  };
  mapped.briefing = callSetupNote(mapped);
  return mapped;
}

export function callSetupNote(prospect: ProspectRecord): string {
  const lines = [
    prospect.readinessScore != null
      ? `Readiness ${prospect.readinessScore}${prospect.qualificationResult ? ` · ${prospect.qualificationResult}` : ''}`
      : prospect.qualificationResult,
    [
      prospect.monthlyAdSpend ? `Ad spend ${prospect.monthlyAdSpend}` : null,
      prospect.followUpOwner ? `Follow-up ${prospect.followUpOwner}` : null,
      prospect.programPrice ? `Program ${prospect.programPrice}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    prospect.nextAction ? `Next: ${prospect.nextAction}` : null,
    prospect.stage ? `Stage: ${prospect.stage}` : null,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return lines.join('\n');
}

export function mapProspectToCallSetup(
  prospect: ProspectRecord,
  extras: { timeZone?: string; durationMinutes?: number } = {},
): CallSetup {
  const timeZone = extras.timeZone ?? 'America/New_York';
  const durationMinutes = extras.durationMinutes ?? 30;
  const company = prospect.companyName;
  const summary = company
    ? `Lead Leak Audit — ${prospect.fullName} (${company})`
    : `Lead Leak Audit — ${prospect.fullName || 'Prospect'}`;

  const description = [
    'Lead Leak Audit — internal booking from DA Pipeline.',
    prospect.fullName ? `Name: ${prospect.fullName}` : null,
    company ? `Company: ${company}` : null,
    prospect.email ? `Email: ${prospect.email}` : null,
    prospect.phone ? `Phone: ${prospect.phone}` : null,
    callSetupNote(prospect),
    `Airtable: ${prospect.airtableUrl}`,
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .join('\n');

  return {
    recordId: prospect.recordId,
    fullName: prospect.fullName,
    email: prospect.email,
    phone: prospect.phone,
    companyName: company,
    durationMinutes,
    timeZone,
    note: callSetupNote(prospect),
    summary,
    description,
  };
}

export function appendBookingNote(existing: string, stamp: string): string {
  const prior = existing.trim();
  return prior ? `${prior}\n\n${stamp}` : stamp;
}

export function bookingNoteStamp(input: {
  startsAtIso: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
}): string {
  const when = new Date(input.startsAtIso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: input.timeZone,
    timeZoneName: 'short',
  });
  const lines = [
    `[Internal booking ${isoDateInTimeZone(input.startsAtIso, input.timeZone)}]`,
    `Call: ${when} (${input.durationMinutes}m)`,
  ];
  if (input.meetUrl) lines.push(`Meet: ${input.meetUrl}`);
  return lines.join('\n');
}

export function shouldAdvanceStage(currentStage: string): boolean {
  if (!currentStage) return true;
  return (STAGE_ADVANCE_TO_BOOKED as readonly string[]).includes(currentStage);
}

export function airtableBookingFields(input: {
  currentStage: string;
  startsAtIso: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  eventId?: string | null;
  existingNotes: string;
  email?: string;
  existingEmail?: string;
}): Record<string, string> {
  const fields: Record<string, string> = {
    'Audit Booked Date': isoDateInTimeZone(input.startsAtIso, input.timeZone),
    Notes: appendBookingNote(
      input.existingNotes,
      bookingNoteStamp({
        startsAtIso: input.startsAtIso,
        timeZone: input.timeZone,
        durationMinutes: input.durationMinutes,
        meetUrl: input.meetUrl,
      }),
    ),
  };

  if (shouldAdvanceStage(input.currentStage)) {
    fields.Stage = 'Audit Booked';
  }
  if (input.meetUrl) fields['Google Meet URL'] = input.meetUrl;
  if (input.eventId) fields['Calendar Event ID'] = input.eventId;

  const email = input.email?.trim().toLowerCase() ?? '';
  const existing = input.existingEmail?.trim().toLowerCase() ?? '';
  if (email && email !== existing) {
    fields.Email = email;
  }

  return fields;
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function airtableHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch<T>(path: string, init: RequestInit): Promise<T> {
  if (!AIRTABLE_API_KEY) {
    throw new PipelineStepError('airtable-prospects', 'Airtable API key is not configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_LEADS_TABLE_ID}${path}`;

  try {
    const response = await fetch(url, {
      ...init,
      headers: { ...airtableHeaders(), ...init.headers },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await readBody(response);
    if (!response.ok) {
      throw new PipelineStepError(
        'airtable-prospects',
        `Airtable ${init.method ?? 'GET'} failed (${response.status}): ${text}`,
      );
    }
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof PipelineStepError) throw error;
    throw new PipelineStepError('airtable-prospects', 'Airtable request threw', { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

function listPath(
  input: ProspectSearchInput,
  fieldNames: readonly string[] = PROSPECT_FIELD_NAMES,
): string {
  const params = new URLSearchParams();
  params.set('filterByFormula', prospectSearchFormula(input));
  params.set('maxRecords', String(Math.max(1, Math.min(input.limit ?? 40, 50))));
  const sortField = input.bookedOnly ? 'Audit Booked Date' : 'Readiness Score';
  params.set('sort[0][field]', sortField);
  params.set('sort[0][direction]', 'desc');
  for (const field of fieldNames) {
    params.append('fields[]', field);
  }
  return `?${params.toString()}`;
}

async function listMapped(
  input: ProspectSearchInput,
  fieldNames: readonly string[],
): Promise<ProspectRecord[]> {
  const payload = await airtableFetch<{ records?: Array<{ id: string; fields?: Record<string, unknown> }> }>(
    listPath(input, fieldNames),
    { method: 'GET' },
  );
  return (payload.records ?? []).map(mapAirtableRecord);
}

export async function searchProspects(input: ProspectSearchInput = {}): Promise<ProspectRecord[]> {
  try {
    return await listMapped(input, PROSPECT_FIELD_NAMES);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes('UNKNOWN_FIELD_NAME')) throw error;
    return listMapped(
      input,
      PROSPECT_FIELD_NAMES.filter((field) => !(MEET_WRITE_FIELDS as readonly string[]).includes(field)),
    );
  }
}

export async function getProspect(recordId: string): Promise<ProspectRecord | null> {
  if (!/^rec[A-Za-z0-9]{14}$/.test(recordId)) return null;
  try {
    const record = await airtableFetch<{ id: string; fields?: Record<string, unknown> }>(
      `/${recordId}`,
      { method: 'GET' },
    );
    return mapAirtableRecord(record);
  } catch {
    return null;
  }
}

export async function writeBookingToAirtable(
  recordId: string,
  fields: Record<string, string>,
): Promise<void> {
  const body = JSON.stringify({ fields, typecast: true });
  try {
    await airtableFetch(`/${recordId}`, { method: 'PATCH', body });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes('UNKNOWN_FIELD_NAME')) throw error;
    const stripped: Record<string, string> = { ...fields };
    for (const field of MEET_WRITE_FIELDS) {
      delete stripped[field];
    }
    await airtableFetch(`/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields: stripped, typecast: true }),
    });
  }
}
