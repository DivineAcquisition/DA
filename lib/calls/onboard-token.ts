import { createHmac, timingSafeEqual } from 'crypto';
import { cachedAirtableApiKey, resolveAirtableApiKey } from '@/lib/acq/airtable-key';
import { isRecordId } from './cells';

export function onboardTokenSecret(): string {
  return process.env.ONBOARD_TOKEN_SECRET?.trim() || cachedAirtableApiKey();
}

export async function resolveOnboardTokenSecret(): Promise<string> {
  const dedicated = process.env.ONBOARD_TOKEN_SECRET?.trim();
  if (dedicated) return dedicated;
  return resolveAirtableApiKey();
}

export function isTestLeadName(name: string): boolean {
  return /^\s*TEST\b/i.test(name);
}

export function signOnboardToken(leadId: string, secret = onboardTokenSecret()): string {
  if (!isRecordId(leadId) || !secret) return '';
  const sig = createHmac('sha256', secret).update(leadId).digest('base64url');
  return `${leadId}.${sig}`;
}

/**
 * Signed tokens (`rec….sig`) are the client links.
 * A bare Airtable record id is accepted only as a TEST-lead sandbox link; the
 * onboard page still refuses it unless the lead name starts with TEST.
 */
export function readOnboardToken(token: string, secret = onboardTokenSecret()): string | null {
  const trimmed = token.trim();
  if (isRecordId(trimmed)) return trimmed;

  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot < 0 || !secret) return null;
  const leadId = trimmed.slice(0, lastDot);
  const sig = trimmed.slice(lastDot + 1);
  if (!isRecordId(leadId) || !sig) return null;
  const expected = createHmac('sha256', secret).update(leadId).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!timingSafeEqual(left, right)) return null;
  return leadId;
}

export function isSignedOnboardToken(token: string): boolean {
  return token.trim().includes('.');
}
