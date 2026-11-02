import { createHmac, timingSafeEqual } from 'node:crypto';

export type HookHeaders = { id: string; timestamp: string; signature: string };

/** Verifies a Supabase Send Email hook (Standard Webhooks). */
export function verifySupabaseHook(payload: string, headers: HookHeaders, secret: string, now = Date.now()): void {
  const raw = secret.trim().replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = Buffer.from(raw, 'base64');
  if (!key.length || !headers.id || !headers.timestamp || !headers.signature) {
    throw new Error('Missing webhook signature');
  }
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 5 * 60) {
    throw new Error('Webhook timestamp is outside the allowed window');
  }
  const signed = `${headers.id}.${headers.timestamp}.${payload}`;
  const expected = createHmac('sha256', key).update(signed).digest('base64');
  const candidates = headers.signature.split(' ').map((part) => part.replace(/^v1,/, ''));
  const match = candidates.some((candidate) => {
    const left = Buffer.from(candidate);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
  if (!match) throw new Error('Invalid webhook signature');
}

export function authVerifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  const url = new URL('/auth/v1/verify', supabaseUrl.replace(/\/+$/, ''));
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', type);
  if (redirectTo) url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}
