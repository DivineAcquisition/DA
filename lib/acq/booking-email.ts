import { greetingName, renderEmailHtml, textFooter } from '@/lib/email/layout';
import { idempotencyKey } from '@/lib/email/policy';
import { loadEmailIdentity, requireSent, sendAppEmail } from '@/lib/email/service';
import { WORKSPACE_AGREEMENT_CC } from '../workspace/email';

function formatWhen(startsAt: string, timeZone: string): string {
  return new Date(startsAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });
}

export function buildProspectCallEmail(input: {
  fullName: string;
  companyName?: string | null;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  calendarUrl?: string | null;
  replyTo?: string | null;
}): { subject: string; html: string; text: string } {
  const firstName = greetingName(input.fullName);
  const when = formatWhen(input.startsAt, input.timeZone);
  const company = input.companyName?.trim();
  const meetLine = input.meetUrl ? `Google Meet: ${input.meetUrl}` : 'Meeting link will follow shortly.';
  const calLine = input.calendarUrl ? `Calendar: ${input.calendarUrl}` : null;

  const subject = company
    ? `Confirmed: Lead Leak Audit with ${company} — ${when}`
    : `Confirmed: your Lead Leak Audit — ${when}`;
  const intro = `Your ${input.durationMinutes}-minute Lead Leak Audit is confirmed.`;
  const agenda =
    'On the call we look at how fast a new inquiry gets a reply, how many booked calls actually show up, and what happens to the people who say they need to think about it.';
  const footer = {
    reason: 'You received this email because you booked a Lead Leak Audit with Divine Acquisition.',
  };

  const text = [
    `Hi ${firstName},`,
    '',
    intro,
    '',
    `When: ${when}`,
    meetLine,
    ...(calLine ? [calLine] : []),
    company ? `Company: ${company}` : null,
    '',
    agenda,
    '',
    '— Divine Acquisition',
    '',
    ...textFooter({ ...footer, replyTo: input.replyTo }),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${when}. ${input.durationMinutes} minutes${input.meetUrl ? ' on Google Meet' : ''}.`,
    eyebrow: 'Lead Leak Audit',
    title: 'Your Lead Leak Audit is confirmed',
    greeting: firstName,
    paragraphs: [intro],
    details: [
      { label: 'When', value: when },
      { label: 'Length', value: `${input.durationMinutes} minutes` },
      ...(company ? [{ label: 'Company', value: company }] : []),
      input.meetUrl
        ? { label: 'Google Meet', value: input.meetUrl, href: input.meetUrl }
        : { label: 'Meeting link', value: 'Follows shortly by email' },
      ...(input.calendarUrl ? [{ label: 'Calendar', value: 'Add to your calendar', href: input.calendarUrl }] : []),
    ],
    cta: input.meetUrl ? { href: input.meetUrl, label: 'Join Google Meet' } : null,
    note: agenda,
    footer: { ...footer, replyTo: input.replyTo },
  });

  return { subject, html, text };
}

export async function sendProspectCallConfirmationEmail(input: {
  to: string;
  fullName: string;
  companyName?: string | null;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  calendarUrl?: string | null;
}): Promise<{ id: string }> {
  const identity = await loadEmailIdentity('client');
  const content = buildProspectCallEmail({ ...input, replyTo: identity.replyTo });
  const cc = WORKSPACE_AGREEMENT_CC.filter((email) => email !== input.to.toLowerCase());
  return requireSent(
    await sendAppEmail({
      purpose: 'client',
      to: input.to,
      cc,
      subject: content.subject,
      html: content.html,
      text: content.text,
      template: 'prospect-call',
      idempotencyKey: idempotencyKey(['prospect-call', input.to, input.startsAt]),
      event: 'prospect.call.confirmation',
    }),
  );
}
