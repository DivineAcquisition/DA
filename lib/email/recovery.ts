import { createHash } from 'node:crypto';
import { buildAuthEmail } from './auth-mail';
import { idempotencyKey } from './policy';
import { sendAppEmail, type SendAppEmailInput, type SendAppEmailResult } from './service';

const SEND_ERROR = 'We could not send the email. Try again in a minute.';

/**
 * Puts the one-time recovery token on the callback this app already owns.
 * Supabase's verify redirect is not used: that redirect returns the session
 * in the URL hash, which a server callback cannot read.
 */
export function recoveryUrl(redirectTo: string, tokenHash: string): string | null {
  const token = tokenHash.trim();
  if (!token) return null;
  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    return null;
  }
  if (url.username || url.password || url.hash) return null;
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    return null;
  }
  url.searchParams.set('token_hash', token);
  url.searchParams.set('type', 'recovery');
  return url.toString();
}

export type RecoveryLinkResult = { hashedToken: string } | 'missing' | { error: string };

export type RecoveryDeps = {
  createLink?: (email: string) => Promise<RecoveryLinkResult>;
  send?: (input: SendAppEmailInput) => Promise<SendAppEmailResult>;
};

function missingAccount(message: string, status?: number): boolean {
  if (status === 404 || status === 422) {
    return /not found|does not exist|no user/i.test(message);
  }
  return /user.*not found|email address not found|does not exist/i.test(message);
}

async function defaultCreateLink(email: string): Promise<RecoveryLinkResult> {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  if (!client) return { error: 'Email is not configured' };
  const { data, error } = await client.auth.admin.generateLink({ type: 'recovery', email });
  if (error) {
    const message = error.message || 'Could not create a recovery link';
    if (missingAccount(message, error.status)) return 'missing';
    return { error: message };
  }
  const hashedToken = data.properties?.hashed_token?.trim() ?? '';
  if (!hashedToken) return { error: 'Could not create a recovery link' };
  return { hashedToken };
}

/**
 * Sends the branded reset email through Resend. An address with no account
 * gets the same success as a sent email, so the form cannot be used to probe
 * for accounts. A failure to send is reported.
 */
export async function sendRecoveryEmail(
  input: { email: string; redirectTo: string },
  deps: RecoveryDeps = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const createLink = deps.createLink ?? defaultCreateLink;
  const send = deps.send ?? ((message: SendAppEmailInput) => sendAppEmail(message));
  let link: RecoveryLinkResult;
  try {
    link = await createLink(email);
  } catch {
    return { ok: false, error: SEND_ERROR };
  }
  if (link === 'missing') return { ok: true };
  if ('error' in link) return { ok: false, error: SEND_ERROR };
  const url = recoveryUrl(input.redirectTo, link.hashedToken);
  if (!url) return { ok: false, error: SEND_ERROR };
  const mail = buildAuthEmail({ kind: 'recovery', email, url });
  const digest = createHash('sha256').update(link.hashedToken).digest('hex').slice(0, 24);
  try {
    const result = await send({
      purpose: 'security',
      to: email,
      replyTo: null,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      template: mail.template,
      idempotencyKey: idempotencyKey(['auth', 'recovery', digest]),
      event: 'auth.recovery',
      payload: { kind: 'recovery' },
    });
    if (!result.ok) return { ok: false, error: SEND_ERROR };
    return { ok: true };
  } catch {
    return { ok: false, error: SEND_ERROR };
  }
}
