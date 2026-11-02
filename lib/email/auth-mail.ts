import { createHash } from 'node:crypto';
import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from './layout';
import { idempotencyKey } from './policy';
import { requireSent, sendAppEmail } from './service';

export type AuthKind = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'reauthentication';

const COPY: Record<Exclude<AuthKind, 'reauthentication'>, { subject: string; title: string; body: string; button: string; note: string }> = {
  signup: {
    subject: 'Confirm your Divine Acquisition email',
    title: 'Confirm your email',
    body: 'Confirm this address to finish setting up your Divine Acquisition account. The link expires soon.',
    button: 'Confirm email',
    note: 'If you did not create an account, you can ignore this email.',
  },
  invite: {
    subject: 'You are invited to Divine Acquisition',
    title: 'You are invited',
    body: 'You have been invited to create a Divine Acquisition account. Use the button to set your password. The link expires soon.',
    button: 'Accept invitation',
    note: 'If you were not expecting this, you can ignore this email.',
  },
  magiclink: {
    subject: 'Your Divine Acquisition sign-in link',
    title: 'Sign in to Divine Acquisition',
    body: 'Use the button to sign in. This link expires in one hour and works once.',
    button: 'Sign in',
    note: 'If you did not ask to sign in, you can ignore this email.',
  },
  recovery: {
    subject: 'Reset your Divine Acquisition password',
    title: 'Reset your password',
    body: 'We received a request to reset the password for your Divine Acquisition account. Use the button to choose a new one. The link expires in one hour.',
    button: 'Choose a new password',
    note: 'If you did not ask for this, you can ignore this email. Your password stays the same.',
  },
  email_change: {
    subject: 'Confirm your new Divine Acquisition email',
    title: 'Confirm your new email',
    body: 'Confirm that this address should be used for your Divine Acquisition account. The link expires soon.',
    button: 'Confirm email',
    note: 'If you did not ask to change your email, you can ignore this email.',
  },
};

export function buildAuthEmail(input: { kind: AuthKind; email: string; url?: string | null; code?: string | null }): {
  subject: string;
  html: string;
  text: string;
  template: string;
} {
  const footer = { reason: `You received this because of a security email for ${input.email}.` };
  if (input.kind === 'reauthentication') {
    const code = input.code?.trim() || '------';
    const subject = 'Your Divine Acquisition verification code';
    const body = 'Enter this code to continue. It expires soon.';
    return {
      subject,
      template: 'auth-code',
      text: [`Your verification code is ${code}.`, '', body, '', ...textFooter(footer)].join('\n'),
      html: renderEmailHtml({
        subject,
        preheader: 'Your verification code.',
        eyebrow: 'Account security',
        title: 'Your verification code',
        paragraphs: [body],
        details: [{ label: 'Code', value: code }],
        note: 'If you did not ask for a code, you can ignore this email.',
        footer,
      }),
    };
  }
  const copy = COPY[input.kind];
  const url = input.url?.trim() || '';
  return {
    subject: copy.subject,
    template: `auth-${input.kind}`,
    text: [copy.body, '', url ? `${copy.button}: ${url}` : '', '', copy.note, '', ...textFooter(footer)].filter(Boolean).join('\n'),
    html: renderEmailHtml({
      subject: copy.subject,
      preheader: copy.body,
      eyebrow: 'Account security',
      title: copy.title,
      paragraphs: [copy.body],
      cta: url ? { href: url, label: copy.button } : null,
      showFallbackLink: Boolean(url),
      note: copy.note,
      footer,
    }),
  };
}

export async function accountInviteUrl(role: string, token: string): Promise<string> {
  const { loadOperatorWorkspaceDomain } = await import('@/lib/operator-workspace/domain');
  if (role === 'operator') {
    const origin = (await loadOperatorWorkspaceDomain()).origin || appUrl('team');
    return `${origin}/workspace/auth/invite?token=${encodeURIComponent(token)}`;
  }
  return `${appUrl('admin')}/ad/invite?token=${encodeURIComponent(token)}`;
}

const ROLE_LABEL: Record<string, string> = {
  operator: 'Sales Operator',
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  contractor: 'Contractor',
  client: 'Client',
};

export async function sendAccountInviteEmail(input: {
  to: string;
  fullName?: string | null;
  role: string;
  token: string;
}): Promise<{ id: string }> {
  const url = await accountInviteUrl(input.role, input.token);
  const role = ROLE_LABEL[input.role] ?? input.role;
  const name = input.fullName?.trim();
  const subject = 'Your Divine Acquisition account';
  const body = `${name ? `${name}, you` : 'You'} are invited to Divine Acquisition as ${role}. The link expires in 7 days. Open it and choose a password.`;
  const footer = { reason: `You received this because a Divine Acquisition account was created for ${input.to}.` };
  const text = [body, '', url, '', ...textFooter(footer)].join('\n');
  const html = renderEmailHtml({
    subject,
    preheader: `Your ${role} account is ready.`,
    eyebrow: 'Account security',
    title: 'Your account is ready',
    paragraphs: [body],
    cta: { href: url, label: 'Accept invitation' },
    showFallbackLink: true,
    footer,
  });
  const digest = createHash('sha256').update(input.token).digest('hex');
  return requireSent(
    await sendAppEmail({
      purpose: 'security',
      to: input.to,
      replyTo: null,
      subject,
      html,
      text,
      template: 'account-invite',
      idempotencyKey: idempotencyKey(['account-invite', digest]),
      event: 'account.invite',
      payload: { role: input.role },
    }),
  );
}
