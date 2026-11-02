import { createHash } from 'node:crypto';
import { accountInviteUrl } from '@/lib/email/auth-mail';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import { idempotencyKey } from '@/lib/email/policy';
import { requireSent, sendAppEmail } from '@/lib/email/service';

function mail(input: { subject: string; title: string; paragraphs: string[]; href?: string; label?: string; reason: string }) {
  const footer = { reason: input.reason };
  return {
    subject: input.subject,
    html: renderEmailHtml({
      subject: input.subject,
      preheader: input.paragraphs[0] ?? input.title,
      eyebrow: 'Divine Acquisition',
      title: input.title,
      paragraphs: input.paragraphs,
      cta: input.href && input.label ? { href: input.href, label: input.label } : null,
      showFallbackLink: Boolean(input.href),
      footer,
    }),
    text: [...input.paragraphs, '', input.href && input.label ? `${input.label}: ${input.href}` : '', '', ...textFooter(footer)]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

export async function sendHireInvite(input: { to: string; name: string; token: string }) {
  const url = await accountInviteUrl('operator', input.token);
  const content = mail({
    subject: 'Your Divine Acquisition account',
    title: 'Your account is ready',
    paragraphs: [
      `${input.name}, your Sales Operator account is ready.`,
      'Open the link and choose a password. It expires in 7 days.',
    ],
    href: url,
    label: 'Accept invitation',
    reason: `You received this because Divine Acquisition invited ${input.to}.`,
  });
  const digest = createHash('sha256').update(input.token).digest('hex');
  return requireSent(
    await sendAppEmail({
      purpose: 'security',
      to: input.to,
      replyTo: null,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'auth-invite',
      idempotencyKey: idempotencyKey(['auth-invite', digest]),
      event: 'auth.invite',
      payload: { name: input.name },
    }),
  );
}

export async function sendOperatorWelcome(input: { to: string; name: string; operatorId: string }) {
  const content = mail({
    subject: 'Welcome to Divine Acquisition',
    title: `Welcome, ${input.name.split(' ')[0] || 'there'}`,
    paragraphs: [
      'Your operator record is open.',
      'Sign in, finish onboarding, and complete the DA Operator Academy. Placement starts when every readiness item is done.',
    ],
    reason: 'You received this because Divine Acquisition added you as an operator.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-welcome',
      idempotencyKey: idempotencyKey(['operator-welcome', input.operatorId]),
      event: 'operator.welcome',
      related: { operatorId: input.operatorId },
    }),
  );
}

export async function sendOnboardingReminder(input: { to: string; name: string; operatorId: string; count: number }) {
  const content = mail({
    subject: 'Finish your Divine Acquisition onboarding',
    title: 'Onboarding is still open',
    paragraphs: [
      `${input.name.split(' ')[0] || 'there'}, your onboarding form is not finished.`,
      'Sign in and complete the remaining steps. This is reminder ' + input.count + ' of 3.',
    ],
    reason: 'You received this because your operator onboarding is still open.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-onboarding-reminder',
      idempotencyKey: idempotencyKey(['operator-onboarding-reminder', input.operatorId, input.count]),
      event: 'operator.onboarding_reminder',
      related: { operatorId: input.operatorId },
      payload: { count: input.count },
    }),
  );
}

export async function sendOverrideGranted(input: { to: string; name: string; operatorId: string; overrideId: string; expiresOn: string }) {
  const content = mail({
    subject: 'Your Academy access is open',
    title: 'Finish certification by ' + input.expiresOn,
    paragraphs: [
      `${input.name.split(' ')[0] || 'there'}, you can use the workspace before Level 1 is finished.`,
      `Complete the DA Operator Academy by ${input.expiresOn}. This access is not a certification.`,
    ],
    reason: 'You received this because DA Admin granted a certification override.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-override-granted',
      idempotencyKey: idempotencyKey(['operator-override-granted', input.overrideId]),
      event: 'operator.certification_override_granted',
      related: { operatorId: input.operatorId },
      payload: { expiresOn: input.expiresOn },
    }),
  );
}

export async function sendOverrideExpiring(input: {
  to: string;
  name: string;
  operatorId: string;
  overrideId: string;
  days: number;
  expiresOn: string;
}) {
  const content = mail({
    subject: `Academy access ends in ${input.days} days`,
    title: `Certification is due ${input.expiresOn}`,
    paragraphs: [
      `${input.name.split(' ')[0] || 'there'}, your workspace access ends on ${input.expiresOn} unless you reach Level 1.`,
      'Finish the remaining Academy modules before that date.',
    ],
    reason: 'You received this because your certification override is close to its end date.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-override-expiring',
      idempotencyKey: idempotencyKey(['operator-override-expiring', input.overrideId, input.days]),
      event: 'operator.certification_override_expiring',
      related: { operatorId: input.operatorId },
      payload: { days: input.days },
    }),
  );
}

export async function sendOverrideAdminAlert(input: { to: string; operatorName: string; overrideId: string; expiresOn: string }) {
  const content = mail({
    subject: `Override for ${input.operatorName} ends ${input.expiresOn}`,
    title: 'A certification override ends in 7 days',
    paragraphs: [
      `${input.operatorName} still does not have Level 1.`,
      `Workspace access from the override ends on ${input.expiresOn}.`,
    ],
    reason: 'You received this because you are a DA Admin.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'alerts',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'alert-override-expiring',
      idempotencyKey: idempotencyKey(['alert-override-expiring', input.overrideId]),
      event: 'alert.override_expiring',
      payload: { operatorName: input.operatorName },
    }),
  );
}

export async function sendReady(input: { to: string; name: string; operatorId: string }) {
  const content = mail({
    subject: 'You are ready to place',
    title: 'Every readiness item is done',
    paragraphs: [
      `${input.name.split(' ')[0] || 'there'}, onboarding, agreement, payout, and Academy access are in place.`,
      'DA will match you with a client. You will see the placement here when it starts.',
    ],
    reason: 'You received this because your operator readiness checklist is complete.',
  });
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-ready',
      idempotencyKey: idempotencyKey(['operator-ready', input.operatorId]),
      event: 'operator.ready_to_place',
      related: { operatorId: input.operatorId },
    }),
  );
}
