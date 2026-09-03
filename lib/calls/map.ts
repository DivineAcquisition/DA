import { AIRTABLE_LEADS_URL } from '@/lib/acq/prospects';
import { isoDateInTimeZone } from '@/lib/datetime/local';
import { cellIds, cellNumber, cellText } from './cells';
import {
  AIRTABLE_BASE_ID,
  AIRTABLE_DEBRIEFS_TABLE_ID,
  AIRTABLE_TOUCHES_TABLE_ID,
  CALLS_TIME_ZONE,
} from './config';
import type {
  AuditDebriefInput,
  DebriefRecord,
  HistoryLine,
  LeadRecord,
  PhoneTouchInput,
  ScoreInput,
  TouchRecord,
} from './types';

export function airtableLeadUrl(recordId: string): string {
  return `${AIRTABLE_LEADS_URL}/${recordId}`;
}

export function airtableTouchUrl(recordId: string): string {
  return `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_TOUCHES_TABLE_ID}/${recordId}`;
}

export function airtableDebriefUrl(recordId: string): string {
  return `https://airtable.com/${AIRTABLE_BASE_ID}/${AIRTABLE_DEBRIEFS_TABLE_ID}/${recordId}`;
}

export function todayInCallsZone(now = new Date()): string {
  return isoDateInTimeZone(now.toISOString(), CALLS_TIME_ZONE);
}

export function formatShortDate(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function formatDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return isoDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function adSpendPoints(value: string): number {
  if (value === '$5k+') return 35;
  if (value === '$2-5k') return 25;
  if (value === 'Under $2k') return 10;
  return 0;
}

export function followUpPoints(value: string): number {
  if (value === 'Dedicated setter') return 30;
  if (value === 'Founder') return 20;
  if (value === 'Not sure') return 15;
  if (value === 'Nobody') return 12;
  return 0;
}

export function programPricePoints(value: string): number {
  if (value === '$5k+') return 20;
  if (value === '$2-5k') return 12;
  return 0;
}

export function painPoints(value: string): number {
  if (value === 'Urgent') return 15;
  if (value === 'Moderate') return 8;
  return 0;
}

export function scoreInputsFromLead(fields: {
  monthlyAdSpend: string;
  followUpOwner: string;
  programPrice: string;
}): ScoreInput[] {
  return [
    {
      label: 'Ad spend',
      value: fields.monthlyAdSpend,
      points: adSpendPoints(fields.monthlyAdSpend),
    },
    {
      label: 'Follow-up owner',
      value: fields.followUpOwner,
      points: followUpPoints(fields.followUpOwner),
    },
    {
      label: 'Program price',
      value: fields.programPrice,
      points: programPricePoints(fields.programPrice),
    },
  ];
}

export function entryHow(lead: Pick<LeadRecord, 'leadSource' | 'entryPoint'>): string {
  const parts = [lead.entryPoint, lead.leadSource].filter(Boolean);
  return parts.join(' · ');
}

export function isDebriefComplete(input: {
  outcome?: string | null;
  agreedNextStep?: string | null;
  dealRisk?: string | null;
}): boolean {
  return Boolean(input.outcome?.trim() && input.agreedNextStep?.trim() && input.dealRisk?.trim());
}

export function touchId(leadName: string, isoDate: string, channel: string): string {
  const name = leadName.trim() || 'Lead';
  return `${name} - ${formatShortDate(isoDate)} - ${channel}`;
}

export function debriefTitle(leadName: string, isoDate: string): string {
  const name = leadName.trim() || 'Lead';
  return `${name} - ${formatShortDate(isoDate)}`;
}

export function nextActionRank(nextAction: string): number {
  const text = nextAction.toUpperCase();
  if (text.includes('CALL NOW')) return 0;
  if (text.includes('DEBRIEF MISSING')) return 1;
  if (text.includes('CLOSE -')) return 2;
  if (text.includes('REBOOK')) return 3;
  if (text.includes('REVIEW')) return 4;
  if (text.includes('CHASE')) return 5;
  if (text.includes('DECIDE')) return 6;
  if (text.includes('CALL UPCOMING')) return 7;
  if (text.includes('CLOSED')) return 90;
  return 50;
}

export function compareLeads(a: LeadRecord, b: LeadRecord): number {
  const rank = nextActionRank(a.nextAction) - nextActionRank(b.nextAction);
  if (rank !== 0) return rank;
  const days = (b.daysSinceTouch ?? -1) - (a.daysSinceTouch ?? -1);
  if (days !== 0) return days;
  return a.fullName.localeCompare(b.fullName);
}

export function compareDatedDesc(
  a: { date: string; recordId?: string; id?: string },
  b: { date: string; recordId?: string; id?: string },
): number {
  if (a.date !== b.date) {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date < b.date ? 1 : -1;
  }
  const aid = a.recordId ?? a.id ?? '';
  const bid = b.recordId ?? b.id ?? '';
  return aid < bid ? 1 : -1;
}

export function mapLeadRecord(record: {
  id: string;
  fields?: Record<string, unknown>;
}): LeadRecord {
  const fields = record.fields ?? {};
  const monthlyAdSpend = cellText(fields['Monthly Ad Spend']);
  const followUpOwner = cellText(fields['Follow-Up Owner']);
  const programPrice = cellText(fields['Program Price']);
  const fullName = cellText(fields['Lead Name']);
  const companyName = cellText(fields['Company Name']) || cellText(fields['Coaching Niche']);

  return {
    recordId: record.id,
    fullName,
    email: cellText(fields.Email).toLowerCase(),
    phone: cellText(fields.Phone),
    companyName,
    coachingNiche: cellText(fields['Coaching Niche']),
    stage: cellText(fields.Stage),
    qualificationResult: cellText(fields['Qualification Result']),
    readinessScore: cellNumber(fields['Readiness Score']),
    monthlyAdSpend,
    followUpOwner,
    programPrice,
    painSeverity: cellText(fields['Pain Severity']),
    statedPain: cellText(fields['Stated Pain']),
    whyNow: cellText(fields['Why Now']),
    leadSource: cellText(fields['Lead Source']),
    entryPoint: cellText(fields['Entry Point']),
    sourceTrustTier: cellText(fields['Source Trust Tier']),
    touchStatus: cellText(fields['Touch Status']),
    daysSinceTouch: cellNumber(fields['Days Since Touch']),
    nextAction: cellText(fields['Next Action']),
    auditOutcome: cellText(fields['Audit Outcome']),
    objection: cellText(fields.Objection),
    dealValue: cellNumber(fields['Deal Value']),
    googleMeetUrl: cellText(fields['Google Meet URL']),
    notes: cellText(fields.Notes),
    callBriefNote: cellText(fields['Call Brief Note']),
    touchIds: cellIds(fields.Touches),
    debriefIds: cellIds(fields['Call Debriefs']),
    scoreInputs: scoreInputsFromLead({ monthlyAdSpend, followUpOwner, programPrice }),
    airtableUrl: airtableLeadUrl(record.id),
  };
}

export function mapTouchRecord(record: {
  id: string;
  fields?: Record<string, unknown>;
}): TouchRecord {
  const fields = record.fields ?? {};
  return {
    recordId: record.id,
    touchId: cellText(fields['Touch ID']),
    date: cellText(fields.Date),
    direction: cellText(fields.Direction),
    touchClass: cellText(fields['Touch Class']),
    channel: cellText(fields.Channel),
    outcome: cellText(fields.Outcome),
    sentiment: cellText(fields.Sentiment),
    summary: cellText(fields.Summary),
    recordingLink: cellText(fields['Recording Link']),
    transcript: cellText(fields.Transcript),
    leadIds: cellIds(fields.Lead),
  };
}

export function mapDebriefRecord(record: {
  id: string;
  fields?: Record<string, unknown>;
}): DebriefRecord {
  const fields = record.fields ?? {};
  const outcome = cellText(fields.Outcome);
  const agreedNextStep = cellText(fields['Agreed Next Step']);
  const dealRisk = cellText(fields['Deal Risk']);
  return {
    recordId: record.id,
    title: cellText(fields.Debrief),
    callDate: cellText(fields['Call Date']),
    callType: cellText(fields['Call Type']),
    owner: cellText(fields.Owner),
    statedGoal: cellText(fields['Stated Goal']),
    currentSituation: cellText(fields['Current Situation']),
    whatTheyTried: cellText(fields["What They've Tried"]),
    whyNow: cellText(fields['Why Now']),
    outcome,
    objection: cellText(fields.Objection),
    amountQuoted: cellNumber(fields['Amount Quoted']),
    decisionMakers: cellText(fields['Decision Makers']),
    theirTimeline: cellText(fields['Their Timeline']),
    agreedNextStep,
    nextStepDate: cellText(fields['Next Step Date']),
    closeConfidence: cellNumber(fields['Close Confidence']),
    dealRisk,
    recordingLink: cellText(fields['Recording Link']),
    transcript: cellText(fields.Transcript),
    leadIds: cellIds(fields.Lead),
    complete: isDebriefComplete({ outcome, agreedNextStep, dealRisk }),
  };
}

export function historyFrom(
  touches: TouchRecord[],
  debriefs: DebriefRecord[],
): HistoryLine[] {
  const lines: HistoryLine[] = [
    ...touches.map((touch) => ({
      id: touch.recordId,
      kind: 'touch' as const,
      date: touch.date,
      type: touch.channel || 'Touch',
      outcome: touch.outcome,
      summary: touch.summary,
    })),
    ...debriefs.map((debrief) => ({
      id: debrief.recordId,
      kind: 'debrief' as const,
      date: debrief.callDate,
      type: debrief.callType ? `Audit · ${debrief.callType}` : 'Audit',
      outcome: debrief.complete ? debrief.outcome : 'Draft',
      summary: debrief.agreedNextStep || debrief.statedGoal || debrief.dealRisk,
    })),
  ];
  lines.sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    }
    if (a.kind !== b.kind) return a.kind === 'debrief' ? -1 : 1;
    return a.id < b.id ? 1 : -1;
  });
  return lines;
}

export function oneLineHistory(line: HistoryLine): string {
  const date = line.date ? formatShortDate(line.date) : 'undated';
  const outcome = line.outcome ? ` · ${line.outcome}` : '';
  const summary = line.summary ? ` — ${line.summary}` : '';
  return `${date} · ${line.type}${outcome}${summary}`;
}

function omitEmpty(fields: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    next[key] = typeof value === 'string' ? value.trim() : value;
  }
  return next;
}

export function httpUrlOrEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function touchWriteFields(
  input: PhoneTouchInput & { leadName: string; date: string },
): Record<string, unknown> {
  return omitEmpty({
    'Touch ID': touchId(input.leadName, input.date, input.channel),
    Date: input.date,
    Direction: 'Outbound',
    'Touch Class': 'Human',
    Channel: input.channel,
    Outcome: input.outcome,
    Sentiment: input.sentiment,
    Summary: input.summary,
    Lead: [input.leadId],
    'Recording Link': input.recordingLink ? httpUrlOrEmpty(input.recordingLink) : '',
    Transcript: input.transcript ?? '',
  });
}

export function debriefWriteFields(
  input: AuditDebriefInput & { leadName: string },
): Record<string, unknown> {
  const amount =
    input.amountQuoted != null && Number.isFinite(input.amountQuoted) ? input.amountQuoted : null;
  const confidence =
    input.closeConfidence != null && Number.isFinite(input.closeConfidence)
      ? Math.min(5, Math.max(1, Math.round(input.closeConfidence)))
      : null;

  return omitEmpty({
    Debrief: debriefTitle(input.leadName, input.callDate),
    'Call Date': input.callDate,
    'Call Type': input.callType ?? '',
    Owner: input.owner ?? '',
    'Stated Goal': input.statedGoal ?? '',
    'Current Situation': input.currentSituation ?? '',
    "What They've Tried": input.whatTheyTried ?? '',
    'Why Now': input.whyNow ?? '',
    Outcome: input.outcome ?? '',
    Objection: input.objection ?? '',
    'Amount Quoted': amount,
    'Decision Makers': input.decisionMakers ?? '',
    'Their Timeline': input.theirTimeline ?? '',
    'Agreed Next Step': input.agreedNextStep ?? '',
    'Next Step Date': input.nextStepDate ?? '',
    'Close Confidence': confidence,
    'Deal Risk': input.dealRisk ?? '',
    'Recording Link': input.recordingLink ? httpUrlOrEmpty(input.recordingLink) : '',
    Transcript: input.transcript ?? '',
    Lead: [input.leadId],
  });
}

export function openerLine(lead: Pick<LeadRecord, 'statedPain' | 'whyNow' | 'coachingNiche'>): string {
  return lead.statedPain || lead.whyNow || lead.coachingNiche;
}

export const LEAD_LIST_FIELDS = [
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
  'Pain Severity',
  'Stated Pain',
  'Why Now',
  'Lead Source',
  'Entry Point',
  'Source Trust Tier',
  'Touch Status',
  'Days Since Touch',
  'Next Action',
  'Audit Outcome',
  'Objection',
  'Deal Value',
  'Google Meet URL',
  'Notes',
  'Call Brief Note',
  'Touches',
  'Call Debriefs',
] as const;

export const TOUCH_FIELDS = [
  'Touch ID',
  'Date',
  'Direction',
  'Touch Class',
  'Channel',
  'Outcome',
  'Sentiment',
  'Summary',
  'Recording Link',
  'Transcript',
  'Lead',
] as const;

export const DEBRIEF_FIELDS = [
  'Debrief',
  'Call Date',
  'Call Type',
  'Owner',
  'Stated Goal',
  'Current Situation',
  "What They've Tried",
  'Why Now',
  'Outcome',
  'Objection',
  'Amount Quoted',
  'Decision Makers',
  'Their Timeline',
  'Agreed Next Step',
  'Next Step Date',
  'Close Confidence',
  'Deal Risk',
  'Recording Link',
  'Transcript',
  'Lead',
] as const;
