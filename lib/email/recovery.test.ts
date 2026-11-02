import { describe, expect, it } from 'vitest';
import type { SendAppEmailInput, SendAppEmailResult } from './service';
import { recoveryUrl, sendRecoveryEmail } from './recovery';

const redirectTo = 'https://team.divineacquisition.io/workspace/auth/callback?next=%2Fworkspace%2Freset-password';

describe('recoveryUrl', () => {
  it('keeps the callback and adds the recovery token', () => {
    const url = new URL(recoveryUrl(redirectTo, 'hashed-token') ?? '');
    expect(url.origin + url.pathname).toBe('https://team.divineacquisition.io/workspace/auth/callback');
    expect(url.searchParams.get('next')).toBe('/workspace/reset-password');
    expect(url.searchParams.get('token_hash')).toBe('hashed-token');
    expect(url.searchParams.get('type')).toBe('recovery');
  });

  it('refuses a redirect that is not an app URL', () => {
    expect(recoveryUrl('/workspace/auth/callback', 'hashed-token')).toBeNull();
    expect(recoveryUrl('javascript:alert(1)', 'hashed-token')).toBeNull();
    expect(recoveryUrl('https://user:pass@team.divineacquisition.io/workspace/auth/callback', 'hashed-token')).toBeNull();
    expect(recoveryUrl(redirectTo, '  ')).toBeNull();
  });
});

describe('sendRecoveryEmail', () => {
  it('does not send when the address has no account', async () => {
    let sent = 0;
    const result = await sendRecoveryEmail(
      { email: 'missing@example.com', redirectTo },
      {
        createLink: async () => 'missing',
        send: async () => {
          sent += 1;
          return { ok: true, status: 'sent', id: 'em', logId: 'log' };
        },
      },
    );
    expect(result).toEqual({ ok: true });
    expect(sent).toBe(0);
  });

  it('sends the branded recovery email and keeps the token out of the payload', async () => {
    const messages: SendAppEmailInput[] = [];
    const result = await sendRecoveryEmail(
      { email: 'Ada@Example.com', redirectTo },
      {
        createLink: async (email) => {
          expect(email).toBe('ada@example.com');
          return { hashedToken: 'one-time-hash' };
        },
        send: async (input) => {
          messages.push(input);
          return { ok: true, status: 'sent', id: 'em_1', logId: 'log-1' } satisfies SendAppEmailResult;
        },
      },
    );
    expect(result).toEqual({ ok: true });
    expect(messages).toHaveLength(1);
    const message = messages[0];
    expect(message.purpose).toBe('security');
    expect(message.to).toBe('ada@example.com');
    expect(message.template).toBe('auth-recovery');
    expect(message.event).toBe('auth.recovery');
    expect(message.subject).toBe('Reset your Divine Acquisition password');
    expect(message.html).toContain('token_hash=one-time-hash');
    expect(message.html).toContain('type=recovery');
    expect(JSON.stringify(message.payload)).not.toContain('one-time-hash');
    expect(message.idempotencyKey.startsWith('auth/recovery/')).toBe(true);
  });

  it('reports a send failure without saying whether the account exists', async () => {
    const result = await sendRecoveryEmail(
      { email: 'ada@example.com', redirectTo },
      {
        createLink: async () => ({ hashedToken: 'one-time-hash' }),
        send: async () => ({ ok: false, status: 'failed', id: null, logId: 'log', error: 'RESEND_API_KEY is not configured' }),
      },
    );
    expect(result).toEqual({ ok: false, error: 'We could not send the email. Try again in a minute.' });
  });
});
