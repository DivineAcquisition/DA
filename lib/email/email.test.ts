import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { purposeForAudience } from '@/lib/academy/comms/send';
import { applyStatus, interpretResendEvent } from './events';
import { verifySupabaseHook } from './hook';
import { EMAIL_IDENTITY_DEFAULTS } from './identity';
import { blockedRecipients, bounceIsHard, deliveryMode, idempotencyKey, nextStatus, parseAllowlist } from './policy';
import { sendAppEmail, type EmailTransport, type SendAppEmailInput } from './service';

function memoryStore(suppressed: string[] = []) {
  const rows = new Map<string, Record<string, unknown>>();
  let n = 0;
  return {
    rows,
    async findByKey(key: string) {
      const row = [...rows.values()].find((item) => item.idempotency_key === key);
      return row ? map(row) : null;
    },
    async insert(row: Record<string, unknown>) {
      if ([...rows.values()].some((item) => item.idempotency_key === row.idempotency_key)) return 'duplicate' as const;
      const id = `log-${++n}`;
      const stored = { ...row, id, resend_id: null, error: null, attempt_count: 0, report_id: row.report_id ?? null, payload: row.payload ?? {} };
      rows.set(id, stored);
      return map(stored);
    },
    async update(id: string, patch: Record<string, unknown>) {
      rows.set(id, { ...rows.get(id), ...patch });
    },
    async saveOutbox() {},
    async clearOutbox() {},
    async suppressed(emails: string[]) {
      return new Set(emails.filter((email) => suppressed.includes(email)));
    },
    async loadIdentities() {
      return Object.values(EMAIL_IDENTITY_DEFAULTS);
    },
  };
}

function map(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    purpose: row.purpose as 'team',
    status: row.status as 'queued',
    sender: String(row.sender ?? ''),
    replyTo: (row.reply_to as string | null) ?? null,
    recipients: (row.recipients as string[]) ?? [],
    cc: (row.cc as string[]) ?? [],
    subject: String(row.subject ?? ''),
    template: String(row.template ?? ''),
    event: String(row.event ?? ''),
    idempotencyKey: String(row.idempotency_key ?? ''),
    resendId: (row.resend_id as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    attemptCount: Number(row.attempt_count ?? 0),
    reportId: (row.report_id as string | null) ?? null,
    payload: (row.payload as Record<string, unknown>) ?? {},
  };
}

const base: SendAppEmailInput = {
  purpose: 'team',
  to: 'ana@example.com',
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
  template: 'note',
  idempotencyKey: 'note/ana',
  event: 'note.sent',
};

describe('email policy', () => {
  it('sends live only in production and blocks everyone else unless they are allowlisted', () => {
    expect(deliveryMode({ VERCEL_ENV: 'production' })).toBe('live');
    expect(deliveryMode({ VERCEL_ENV: 'preview' })).toBe('allowlist');
    expect(deliveryMode({})).toBe('allowlist');
    expect(parseAllowlist({ EMAIL_ALLOWLIST: 'A@Example.com, b@example.com' })).toEqual(['a@example.com', 'b@example.com']);
    expect(blockedRecipients(['a@example.com', 'c@example.com'], 'allowlist', ['a@example.com'])).toEqual(['c@example.com']);
    expect(blockedRecipients(['c@example.com'], 'live', [])).toEqual([]);
  });

  it('treats a permanent bounce as hard and keeps keys stable', () => {
    expect(bounceIsHard({ type: 'Permanent' })).toBe(true);
    expect(bounceIsHard({ type: 'Transient' })).toBe(false);
    expect(bounceIsHard(undefined)).toBe(true);
    expect(idempotencyKey(['sales-report', 'abc', 2])).toBe('sales-report/abc/2');
    expect(idempotencyKey(['x', 'a'.repeat(300)])).toMatch(/^email\//);
    expect(nextStatus('delivered', 'sent')).toBe('delivered');
    expect(nextStatus('sent', 'bounced')).toBe('bounced');
  });
});

describe('resend events', () => {
  it('suppresses a hard bounce and a complaint, and records a delay', () => {
    const bounced = interpretResendEvent({
      type: 'email.bounced',
      data: { email_id: 'em_1', to: ['A@Example.com'], bounce: { type: 'Permanent', message: 'no such user' } },
    });
    expect(bounced?.status).toBe('bounced');
    expect(bounced?.suppress).toEqual([{ email: 'a@example.com', reason: 'hard_bounce' }]);
    const delayed = interpretResendEvent({
      type: 'email.bounced',
      data: { email_id: 'em_2', to: ['a@example.com'], bounce: { type: 'Transient' } },
    });
    expect(delayed?.status).toBe('delayed');
    expect(delayed?.suppress).toEqual([]);
    const complained = interpretResendEvent({ type: 'email.complained', data: { email_id: 'em_3', to: ['a@example.com'] } });
    expect(complained?.suppress[0]?.reason).toBe('complaint');
    expect(applyStatus('sent', 'delivered')).toBe('delivered');
    expect(applyStatus('delivered', 'sent')).toBe('delivered');
  });
});

describe('sendAppEmail', () => {
  const env = { VERCEL_ENV: 'production', RESEND_API_KEY: 're_test' };

  it('sends once for an event and does not send the second call', async () => {
    const store = memoryStore();
    const calls: string[] = [];
    const transport: EmailTransport = async (message) => {
      calls.push(message.idempotencyKey);
      return { id: 'em_1' };
    };
    const first = await sendAppEmail(base, { env, store, transport, pace: false, sleep: async () => {} });
    const second = await sendAppEmail(base, { env, store, transport, pace: false, sleep: async () => {} });
    expect(first).toMatchObject({ ok: true, status: 'sent', id: 'em_1' });
    expect(second).toMatchObject({ ok: true, status: 'sent', id: 'em_1' });
    expect(calls).toEqual(['note/ana']);
    expect(first && store.rows.get(first.logId ?? '')?.sender).toBe('DA Operations <ops@updates.divineacquisition.io>');
    expect(store.rows.get(first.logId ?? '')?.cc).toEqual(['malik@divineacquisition.io']);
  });

  it('retries a rate limit and stops on a rejected address', async () => {
    const store = memoryStore();
    let n = 0;
    const transport: EmailTransport = async () => {
      n += 1;
      return n === 1 ? { error: 'slow down', statusCode: 429 } : { id: 'em_2' };
    };
    const sent = await sendAppEmail({ ...base, idempotencyKey: 'note/retry' }, { env, store, transport, pace: false, sleep: async () => {} });
    expect(sent.id).toBe('em_2');
    expect(n).toBe(2);

    const rejected = memoryStore();
    let attempts = 0;
    const bad: EmailTransport = async () => {
      attempts += 1;
      return { error: 'invalid', statusCode: 422 };
    };
    const failed = await sendAppEmail({ ...base, idempotencyKey: 'note/bad' }, { env, store: rejected, transport: bad, pace: false, sleep: async () => {} });
    expect(failed.status).toBe('failed');
    expect(attempts).toBe(1);
  });

  it('blocks preview recipients who are not allowlisted, and skips a suppressed address', async () => {
    const store = memoryStore();
    const transport: EmailTransport = async () => {
      throw new Error('should not send');
    };
    const blocked = await sendAppEmail(base, {
      env: { VERCEL_ENV: 'preview', EMAIL_ALLOWLIST: 'me@example.com' },
      store,
      transport,
      pace: false,
    });
    expect(blocked.status).toBe('blocked');

    const live = await sendAppEmail(base, { env, store, transport: async () => ({ id: 'em_live' }), pace: false });
    expect(live.status).toBe('sent');

    const held = memoryStore(['ana@example.com']);
    let alerted = '';
    const skipped = await sendAppEmail(
      { ...base, idempotencyKey: 'note/held' },
      {
        env,
        store: held,
        transport,
        pace: false,
        alertSuppressed: async (info) => {
          alerted = info.email;
        },
      },
    );
    expect(skipped.status).toBe('suppressed');
    expect(alerted).toBe('ana@example.com');
  });
});

describe('supabase auth hook signature', () => {
  it('accepts a current signature and rejects a bad one', () => {
    const secret = Buffer.from('hook-secret').toString('base64');
    const payload = '{"user":{}}';
    const id = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', Buffer.from('hook-secret')).update(`${id}.${timestamp}.${payload}`).digest('base64');
    expect(() => verifySupabaseHook(payload, { id, timestamp, signature: `v1,${signature}` }, `v1,whsec_${secret}`)).not.toThrow();
    expect(() => verifySupabaseHook(payload, { id, timestamp, signature: 'v1,nope' }, `v1,whsec_${secret}`)).toThrow(/Invalid/);
  });
});

describe('academy senders', () => {
  it('maps each audience onto one of the four purposes', () => {
    expect(purposeForAudience('security')).toBe('security');
    expect(purposeForAudience('operator')).toBe('team');
    expect(purposeForAudience('trainee')).toBe('team');
    expect(purposeForAudience('candidate')).toBe('team');
    expect(purposeForAudience('internal')).toBe('alerts');
    expect(purposeForAudience('client')).toBe('client');
  });
});
