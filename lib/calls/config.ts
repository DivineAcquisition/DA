import {
  AIRTABLE_API_KEY,
  AIRTABLE_BASE_ID,
  AIRTABLE_LEADS_TABLE_ID,
} from '@/lib/acq/config';

export { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_LEADS_TABLE_ID };

export const AIRTABLE_TOUCHES_TABLE_ID =
  process.env.AIRTABLE_TOUCHES_TABLE_ID?.trim() || 'tblLP6ejA1YKpRylk';
export const AIRTABLE_DEBRIEFS_TABLE_ID =
  process.env.AIRTABLE_DEBRIEFS_TABLE_ID?.trim() || 'tbl4LW7Y6V8M8cPxX';

export const CALLS_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_CALLS_HOST?.replace(/\/$/, '') ?? 'https://calls.divineacquisition.io';

export const CALLS_TIME_ZONE = 'America/New_York';

export const TOUCH_CHANNELS = ['Call', 'SMS', 'DM', 'Voice Note', 'Voicemail', 'Email'] as const;
export const TOUCH_OUTCOMES = ['No Answer', 'Replied', 'Booked', 'Declined', 'Not Reached'] as const;
export const TOUCH_SENTIMENTS = ['Positive', 'Neutral', 'Negative'] as const;

export const DEBRIEF_CALL_TYPES = ['Triage', 'Discovery', 'Closing', 'Follow-Up'] as const;
export const DEBRIEF_OWNERS = ['Malik', 'Other'] as const;
export const DEBRIEF_OUTCOMES = [
  'Closed Won',
  'Proposal Out',
  'Decision Pending',
  'Needs Another Call',
  'Not a Fit',
] as const;
export const DEBRIEF_OBJECTIONS = ['Price', 'Timing', 'DIY', 'Trust', 'Fit', 'Thinking', 'None'] as const;
export const DEBRIEF_TIMELINES = ['This week', '2 weeks', '30 days', '90 days', 'Unclear'] as const;

export type TouchChannel = (typeof TOUCH_CHANNELS)[number];
export type TouchOutcome = (typeof TOUCH_OUTCOMES)[number];
export type TouchSentiment = (typeof TOUCH_SENTIMENTS)[number];
export type DebriefCallType = (typeof DEBRIEF_CALL_TYPES)[number];
export type DebriefOwner = (typeof DEBRIEF_OWNERS)[number];
export type DebriefOutcome = (typeof DEBRIEF_OUTCOMES)[number];
export type DebriefObjection = (typeof DEBRIEF_OBJECTIONS)[number];
export type DebriefTimeline = (typeof DEBRIEF_TIMELINES)[number];

export function callsConfigured(): boolean {
  return Boolean(
    AIRTABLE_API_KEY &&
      AIRTABLE_BASE_ID &&
      AIRTABLE_LEADS_TABLE_ID &&
      AIRTABLE_TOUCHES_TABLE_ID &&
      AIRTABLE_DEBRIEFS_TABLE_ID,
  );
}

export function isCallsHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  if (!hostname) return false;
  const callsHost = new URL(CALLS_PUBLIC_ORIGIN).hostname;
  return (
    hostname === callsHost ||
    (hostname.startsWith('calls.') && hostname.endsWith('.divineacquisition.io'))
  );
}

export function callsPublicPath(pathname: string, host?: string | null): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return isCallsHost(host) ? path : `/calls${path === '/' ? '' : path}`;
}

export function leadProfilePath(leadId: string, host?: string | null): string {
  return callsPublicPath(`/${leadId}`, host);
}

export function leadBriefPath(leadId: string, host?: string | null): string {
  return callsPublicPath(`/${leadId}/brief`, host);
}

export function leadPhonePath(leadId: string, host?: string | null): string {
  return callsPublicPath(`/${leadId}/phone`, host);
}

export function leadAuditPath(leadId: string, debriefId?: string, host?: string | null): string {
  const suffix = debriefId ? `/${leadId}/audit/${debriefId}` : `/${leadId}/audit`;
  return callsPublicPath(suffix, host);
}
