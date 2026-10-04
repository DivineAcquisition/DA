import { Resend } from 'resend';
import {
  greetingName,
  itemCardHtml,
  paragraphHtml,
  renderEmailHtml,
  textFooter,
} from '@/lib/email/layout';

export const WORKSPACE_RESEND_FROM =
  process.env.RESEND_AGREEMENT_FROM ??
  process.env.RESEND_FROM ??
  'Divine Acquisition <noreply@noreply.divineacquisition.io>';

export const WORKSPACE_RESEND_REPLY_TO =
  process.env.RESEND_AGREEMENT_REPLY_TO ?? process.env.RESEND_REPLY_TO ?? undefined;

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const content = buildAgreementInviteEmail(input);
  const resend = new Resend(apiKey);
  const cc = agreementInviteCc(input.to, input.cc);

  const { data, error } = await resend.emails.send({
    from: WORKSPACE_RESEND_FROM,
    to: [input.to],
    ...(cc.length > 0 ? { cc } : {}),
    subject: content.subject,
    html: content.html,
    text: content.text,
    ...(WORKSPACE_RESEND_REPLY_TO ? { replyTo: WORKSPACE_RESEND_REPLY_TO } : {}),
    tags: [
      { name: 'surface', value: 'workspace' },
      { name: 'type', value: 'agreement_invite' },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}
