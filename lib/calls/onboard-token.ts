import { createHmac, timingSafeEqual } from 'crypto';
import { isRecordId } from './cells';

export function onboardTokenSecret(): string {
  return (
    process.env.ONBOARD_TOKEN_SECRET?.trim() || process.env.AIRTABLE_API_KEY?.trim() || ''
  );
}

export function signOnboardToken(leadId: string, secret = onboardTokenSecret()): string {
  if (!isRecordId(leadId) || !secret) return '';
  const sig = createHmac('sha256', secret).update(leadId).digest('base64url');
  return `${leadId}.${sig}`;
}

export function readOnboardToken(token: string, secret = onboardTokenSecret()): string | null {
  const trimmed = token.trim();
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
