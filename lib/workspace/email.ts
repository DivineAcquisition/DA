import {
  greetingName,
  itemCardHtml,
  paragraphHtml,
  renderEmailHtml,
  textFooter,
} from '@/lib/email/layout';
import { createHash } from 'node:crypto';
import { idempotencyKey } from '@/lib/email/policy';
import { requireSent, sendAppEmail } from '@/lib/email/service';

/** Always CC ownership on agreement invites unless overridden. */
export const WORKSPACE_AGREEMENT_CC = (
  process.env.RESEND_AGREEMENT_CC ?? 'malik@divineacquisition.io'
)
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export function buildAgreementInviteEmail(input: {
  recipientName: string;
  companyName: string;
  templateName: string;
  signingUrl: string;
  onboardingUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const name = greetingName(input.recipientName);
  const company = input.companyName.trim() || 'Divine Acquisition';
  const docName = input.templateName.trim() || 'Agreement';
  const onboardingUrl = (input.onboardingUrl ?? '').trim();

  const subject = `${company}: ${docName} ready for your signature`;
  const footer = {
    reason: `You received this because ${company} sent you an agreement to sign. If you were not expecting it, you can ignore this email.`,
  };
  const intro = `${company} sent you ${docName} to review and sign. Your link opens a private signing page that only you can use.`;
  const steps = 'You will read the document, confirm the required acknowledgements, and sign electronically. It takes a few minutes.';

  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `Document: ${docName}`,
    `Review & sign: ${input.signingUrl}`,
    '',
    steps,
    ...(onboardingUrl ? ['', `After you sign, finish onboarding (about 5 minutes): ${onboardingUrl}`] : []),
    '',
    `— ${company}`,
    '',
    ...textFooter(footer),
  ].join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${docName} is ready for your signature.`,
    eyebrow: 'Signature requested',
    title: 'Your agreement is ready',
    greeting: name,
    paragraphs: [intro, steps],
    details: [
      { label: 'Document', value: docName },
      { label: 'From', value: company },
    ],
    cta: { href: input.signingUrl, label: 'Review & sign' },
    showFallbackLink: true,
    extraHtml: onboardingUrl
      ? itemCardHtml(
          'Next: onboarding',
          paragraphHtml('After you sign, complete the short onboarding form. It takes about 5 minutes.'),
          { href: onboardingUrl, label: 'Open onboarding' },
        )
      : undefined,
    footer,
  });

  return { subject, html, text };
}

export function agreementInviteCc(to: string, extra: string[] = []): string[] {
  const recipients = new Set(
    [to, ...extra].map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  return WORKSPACE_AGREEMENT_CC.filter((email) => !recipients.has(email));
}

export async function sendAgreementInviteEmail(input: {
  to: string;
  recipientName: string;
  companyName: string;
  templateName: string;
  signingUrl: string;
  onboardingUrl?: string | null;
  cc?: string[];
}): Promise<{ id: string }> {
  const content = buildAgreementInviteEmail(input);
  const cc = agreementInviteCc(input.to, input.cc);
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      cc,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'agreement-invite',
      idempotencyKey: idempotencyKey(['agreement-invite', createHash('sha256').update(input.signingUrl).digest('hex')]),
      event: 'agreement.invite',
      payload: { templateName: input.templateName, companyName: input.companyName },
    }),
  );
}

export function buildOnboardingEmail(input: {
  recipientName: string;
  url: string;
}): { subject: string; html: string; text: string } {
  const name = greetingName(input.recipientName);
  const subject = 'Your Divine Acquisition onboarding';
  const body =
    'This is the sales operator onboarding. It covers who you are, your Divine Acquisition account, how you get paid, your equipment, and when you can work. Your answers save as you go.';
  const footer = {
    reason: 'You received this because Divine Acquisition started your sales operator onboarding.',
  };
  return {
    subject,
    text: [`Hi ${name},`, '', body, '', input.url, '', ...textFooter(footer)].join('\n'),
    html: renderEmailHtml({
      subject,
      preheader: 'Your sales operator onboarding is ready.',
      eyebrow: 'Onboarding',
      title: 'Your onboarding is ready',
      greeting: name,
      paragraphs: [body],
      cta: { href: input.url, label: 'Start onboarding' },
      showFallbackLink: true,
      footer,
    }),
  };
}

export async function sendOnboardingEmail(input: {
  to: string;
  recipientName: string;
  url: string;
}): Promise<{ id: string }> {
  const content = buildOnboardingEmail(input);
  return requireSent(
    await sendAppEmail({
      purpose: 'team',
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'operator-onboarding',
      idempotencyKey: idempotencyKey(['operator-onboarding', createHash('sha256').update(input.url).digest('hex')]),
      event: 'operator.onboarding',
      payload: { recipientName: input.recipientName },
    }),
  );
}
