import { greetingName, paragraphHtml, renderEmailHtml, textFooter } from '@/lib/email/layout';
import { idempotencyKey } from '@/lib/email/policy';
import { loadEmailIdentity, requireSent, sendAppEmail } from '@/lib/email/service';
import { ACQ_AUDIT_CC } from './config';

export type AcqEmailKind = 'confirmation' | 'reminder_24h' | 'reminder_2h';

const META_DISCLAIMER = 'This message is not part of, or endorsed by, Facebook or Meta.';

function formatWhen(startsAt: string, timeZone: string): string {
  return new Date(startsAt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });
}

export function buildAcqAuditEmail(input: {
  fullName: string;
  offer?: string | null;
  startsAt: string;
  timeZone: string;
  meetUrl?: string | null;
  kind: AcqEmailKind;
  replyTo?: string | null;
}): { subject: string; html: string; text: string } {
  const name = greetingName(input.fullName);
  const when = formatWhen(input.startsAt, input.timeZone);
  const offer = input.offer?.trim();
  const headline =
    input.kind === 'reminder_24h'
      ? 'Your audit is in 24 hours'
      : input.kind === 'reminder_2h'
        ? 'Your audit is in 2 hours'
        : 'Your audit is confirmed';
  const subject =
    input.kind === 'confirmation'
      ? `Confirmed: your audit on ${when}`
      : `Reminder: ${headline}`;
  const intro =
    input.kind === 'reminder_24h'
      ? 'This is a reminder that your 30-minute audit is tomorrow. Please keep the time.'
      : input.kind === 'reminder_2h'
        ? 'This is a reminder that your 30-minute audit starts in about 2 hours.'
        : 'Your 30-minute audit is confirmed.';

  const effort =
    'I put real time into the system roadmaps and blueprints for this call. Please treat the time you booked with the same care.';
  const scope =
    'We do not actively manage ad campaigns. We assist with offer positioning and messaging so it lines up with the system we build.';
  const footer = {
    reason: 'You received this email because you booked an audit call with Divine Acquisition.',
    disclaimer: META_DISCLAIMER,
  };

  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `When: ${when}`,
    'Length: 30 minutes',
    input.meetUrl ? `Google Meet: ${input.meetUrl}` : null,
    offer ? `What you sell: ${offer}` : null,
    '',
    effort,
    '',
    scope,
    '',
    'Malik',
    'Founder, Divine Acquisition',
    '',
    ...textFooter({ ...footer, replyTo: input.replyTo }),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${when}. 30 minutes${input.meetUrl ? ' on Google Meet' : ''}.`,
    eyebrow: input.kind === 'confirmation' ? 'Audit confirmed' : 'Audit reminder',
    title: headline,
    greeting: name,
    paragraphs: [intro],
    details: [
      { label: 'When', value: when },
      { label: 'Length', value: '30 minutes' },
      ...(input.meetUrl ? [{ label: 'Google Meet', value: input.meetUrl, href: input.meetUrl }] : []),
      ...(offer ? [{ label: 'What you sell', value: offer }] : []),
    ],
    cta: input.meetUrl ? { href: input.meetUrl, label: 'Join Google Meet' } : null,
    extraHtml: `${paragraphHtml(effort)}${paragraphHtml(scope)}`,
    signoff: { name: 'Malik', role: 'Founder, Divine Acquisition' },
    footer: { ...footer, replyTo: input.replyTo },
  });

  return { subject, html, text };
}

export function acqAuditCc(to: string): string[] {
  const recipient = to.trim().toLowerCase();
  return recipient === ACQ_AUDIT_CC ? [] : [ACQ_AUDIT_CC];
}

export async function sendAcqAuditEmail(input: {
  to: string;
  fullName: string;
  offer?: string | null;
  startsAt: string;
  timeZone: string;
  meetUrl?: string | null;
  kind: AcqEmailKind;
}): Promise<{ id: string }> {
  const identity = await loadEmailIdentity('client');
  const content = buildAcqAuditEmail({ ...input, replyTo: identity.replyTo });
  const cc = acqAuditCc(input.to);
  return requireSent(
    await sendAppEmail({
      purpose: 'client',
      to: input.to,
      cc,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: `acq-audit-${input.kind}`,
      idempotencyKey: idempotencyKey(['acq-audit', input.kind, input.to, input.startsAt]),
      event: `acq.audit.${input.kind}`,
      payload: { kind: input.kind },
    }),
  );
}
