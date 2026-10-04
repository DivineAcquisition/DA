import { Resend } from 'resend';
import { greetingName, renderEmailHtml, textFooter } from '@/lib/email/layout';
import {
  WORKSPACE_AGREEMENT_CC,
  WORKSPACE_RESEND_FROM,
  WORKSPACE_RESEND_REPLY_TO,
} from '../workspace/email';

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
    ...textFooter(footer),
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
    footer,
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const content = buildProspectCallEmail(input);
  const cc = WORKSPACE_AGREEMENT_CC.filter((email) => email !== input.to.toLowerCase());
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: WORKSPACE_RESEND_FROM,
    to: [input.to],
    ...(cc.length > 0 ? { cc } : {}),
    subject: content.subject,
    html: content.html,
    text: content.text,
    ...(WORKSPACE_RESEND_REPLY_TO ? { replyTo: WORKSPACE_RESEND_REPLY_TO } : {}),
    tags: [
      { name: 'surface', value: 'acq' },
      { name: 'type', value: 'prospect_booking_confirmation' },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}
