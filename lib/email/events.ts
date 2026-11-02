import { bounceIsHard, nextStatus, normalizeEmail, type EmailStatus } from './policy';

export type InterpretedEvent = {
  type: string;
  resendId: string;
  recipients: string[];
  status: EmailStatus | null;
  suppress: { email: string; reason: 'hard_bounce' | 'complaint' }[];
  error: string | null;
};

function recipientsOf(data: Record<string, unknown>): string[] {
  const to = data.to;
  if (Array.isArray(to)) return to.map((value) => normalizeEmail(String(value))).filter(Boolean);
  if (typeof to === 'string') return [normalizeEmail(to)].filter(Boolean);
  return [];
}

function bounceOf(data: Record<string, unknown>): { type?: string; message?: string } {
  const bounce = data.bounce;
  if (!bounce || typeof bounce !== 'object') return {};
  const row = bounce as Record<string, unknown>;
  return {
    type: typeof row.type === 'string' ? row.type : undefined,
    message: typeof row.message === 'string' ? row.message : undefined,
  };
}

/** Maps a verified Resend event onto a log status and, when needed, a suppression. */
export function interpretResendEvent(event: { type?: string; data?: unknown }): InterpretedEvent | null {
  const type = event.type ?? '';
  if (!type.startsWith('email.')) return null;
  const data = event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : {};
  const resendId = typeof data.email_id === 'string' ? data.email_id : '';
  if (!resendId) return null;
  const recipients = recipientsOf(data);
  const base = { type, resendId, recipients };

  if (type === 'email.delivered') return { ...base, status: 'delivered', suppress: [], error: null };
  if (type === 'email.sent') return { ...base, status: 'sent', suppress: [], error: null };
  if (type === 'email.delivery_delayed') {
    return { ...base, status: 'delayed', suppress: [], error: 'Delivery is delayed. Resend will retry.' };
  }
  if (type === 'email.complained') {
    return {
      ...base,
      status: 'complained',
      suppress: recipients.map((email) => ({ email, reason: 'complaint' as const })),
      error: 'Recipient marked this email as spam.',
    };
  }
  if (type === 'email.bounced') {
    const bounce = bounceOf(data);
    const hard = bounceIsHard(bounce);
    return {
      ...base,
      status: hard ? 'bounced' : 'delayed',
      suppress: hard ? recipients.map((email) => ({ email, reason: 'hard_bounce' as const })) : [],
      error: bounce.message || (hard ? 'The address bounced.' : 'Delivery was delayed.'),
    };
  }
  if (type === 'email.failed') {
    return { ...base, status: 'failed', suppress: [], error: 'Resend could not send this email.' };
  }
  return { ...base, status: null, suppress: [], error: null };
}

export function applyStatus(current: EmailStatus, incoming: EmailStatus | null): EmailStatus {
  if (!incoming) return current;
  return nextStatus(current, incoming);
}
