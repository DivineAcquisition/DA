import { airtableKeyConfiguredSync, resolveAirtableApiKey } from '@/lib/acq/airtable-key';
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
export const AIRTABLE_ONBOARDING_TABLE_ID =
  process.env.AIRTABLE_ONBOARDING_TABLE_ID?.trim() || 'tblJP76hY3SwFfvuF';

export const STELLAR_MASTER_BASE_ID = 'app0I1Krtkcg6SEfd';
export const STELLAR_MASTER_URL = `https://airtable.com/${STELLAR_MASTER_BASE_ID}`;

export const CLOSED_WON_OUTCOME = 'Closed Won';
export const PAYMENT_PAID = 'Paid';

export const CALLS_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_CALLS_HOST?.replace(/\/$/, '') ?? 'https://calls.divineacquisition.io';
export const ONBOARD_PUBLIC_ORIGIN =
  process.env.NEXT_PUBLIC_ONBOARD_HOST?.replace(/\/$/, '') ?? 'https://onboard.divineacquisition.io';

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

export function callsTablesConfigured(): boolean {
  return Boolean(
    AIRTABLE_BASE_ID &&
      AIRTABLE_LEADS_TABLE_ID &&
      AIRTABLE_TOUCHES_TABLE_ID &&
      AIRTABLE_DEBRIEFS_TABLE_ID &&
      AIRTABLE_ONBOARDING_TABLE_ID,
  );
}

/** Sync gate: true once a token is in env or already loaded from da_settings. */
export function callsConfigured(): boolean {
  return callsTablesConfigured() && airtableKeyConfiguredSync();
}

/** Production gate: loads the Airtable token from da_settings when env is empty. */
export async function callsReady(): Promise<boolean> {
  if (!callsTablesConfigured()) return false;
  return Boolean(await resolveAirtableApiKey());
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

export function leadOnboardPath(leadId: string, host?: string | null): string {
  return callsPublicPath(`/${leadId}/onboard`, host);
}

export function isOnboardHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  if (!hostname) return false;
  const onboardHost = new URL(ONBOARD_PUBLIC_ORIGIN).hostname;
  return (
    hostname === onboardHost ||
    (hostname.startsWith('onboard.') && hostname.endsWith('.divineacquisition.io'))
  );
}

export function onboardPublicPath(pathname: string, host?: string | null): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (isOnboardHost(host)) return path;
  return `/onboard${path === '/' ? '' : path}`;
}

export function onboardFormPath(token: string, host?: string | null): string {
  return onboardPublicPath(`/${token}`, host);
}

export function onboardAbsoluteUrl(token: string, host?: string | null): string {
  if (isOnboardHost(host) || isLocalPreviewHost(host)) {
    return onboardFormPath(token, host);
  }
  return `${ONBOARD_PUBLIC_ORIGIN}/${token}`;
}

function isLocalPreviewHost(host?: string | null): boolean {
  const hostname = (host ?? '').toLowerCase().split(':')[0];
  return (
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.vercel.app')
  );
}
