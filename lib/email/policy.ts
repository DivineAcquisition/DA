import { createHash } from 'node:crypto';

export const EMAIL_PURPOSES = ['security', 'team', 'alerts', 'client'] as const;
export type EmailPurpose = (typeof EMAIL_PURPOSES)[number];

export const EMAIL_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'suppressed',
  'blocked',
  'delayed',
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

/** Statuses that mean this event already finished. A later call must not send again. */
export const FINISHED_STATUSES: ReadonlySet<EmailStatus> = new Set([
  'sent',
  'delivered',
  'bounced',
  'complained',
  'suppressed',
  'delayed',
]);

const STATUS_LABEL: Record<EmailStatus, string> = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  bounced: 'Bounced',
  complained: 'Complained',
  failed: 'Failed',
  suppressed: 'Suppressed',
  blocked: 'Blocked',
  delayed: 'Delayed',
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as EmailStatus] ?? status;
}

export function deliveryMode(env: Record<string, string | undefined>): 'live' | 'allowlist' {
  return env.VERCEL_ENV === 'production' ? 'live' : 'allowlist';
}

export function parseAllowlist(env: Record<string, string | undefined>): string[] {
  return (env.EMAIL_ALLOWLIST ?? env.RESEND_ALLOWLIST ?? '')
    .split(/[,\s]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function uniqueEmails(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const email = normalizeEmail(value ?? '');
    if (!email || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}

/** Recipients a non-production send must not touch. Empty allowlist blocks everyone. */
export function blockedRecipients(recipients: string[], mode: 'live' | 'allowlist', allowlist: string[]): string[] {
  if (mode === 'live') return [];
  const allowed = new Set(allowlist);
  return recipients.filter((email) => !allowed.has(email));
}

export function retryableStatus(statusCode?: number): boolean {
  if (statusCode == null) return true;
  return statusCode === 429 || statusCode === 408 || statusCode >= 500;
}

/** In-request waits: 1s, 2s, 4s, 8s, capped at 30s. */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(attempt, 0), 30_000);
}

/** Queue waits after the in-request tries are used up. */
export function cronBackoffMs(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(attempt, 0), 30 * 60_000);
}

export function idempotencyKey(parts: Array<string | number | null | undefined>): string {
  const raw = parts
    .filter((part) => part != null && String(part).length > 0)
    .map(String)
    .join('/');
  const clean = raw.replace(/[^\w./:-]+/g, '-').replace(/-+/g, '-');
  if (clean.length > 0 && clean.length <= 240) return clean;
  const digest = createHash('sha256').update(raw || 'email').digest('hex');
  return `email/${digest}`;
}

export function safeError(message: string): string {
  return message.replace(/re_[A-Za-z0-9_]+/g, 're_[redacted]').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export type BounceInfo = { type?: string | null; subType?: string | null; message?: string | null };

/** Resend hard bounces use a permanent type. Anything transient stays a delay. */
export function bounceIsHard(bounce: BounceInfo | null | undefined): boolean {
  const type = (bounce?.type ?? '').toLowerCase();
  if (!type) return true;
  return type !== 'transient' && type !== 'temporary' && type !== 'soft';
}

const RANK: Record<EmailStatus, number> = {
  queued: 0,
  blocked: 1,
  suppressed: 1,
  failed: 2,
  delayed: 3,
  sent: 4,
  delivered: 5,
  bounced: 6,
  complained: 6,
};

/** A late "sent" must not wipe a delivery, and a bounce wins over everything before it. */
export function nextStatus(current: EmailStatus, incoming: EmailStatus): EmailStatus {
  if ((current === 'bounced' || current === 'complained') && incoming !== 'bounced' && incoming !== 'complained') {
    return current;
  }
  if (current === 'delivered' && (incoming === 'sent' || incoming === 'delayed' || incoming === 'queued')) return current;
  if (RANK[incoming] < RANK[current] && incoming !== 'bounced' && incoming !== 'complained') return current;
  return incoming;
}
