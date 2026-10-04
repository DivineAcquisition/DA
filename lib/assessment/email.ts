import { Resend } from 'resend';
import { greetingName, renderEmailHtml, textFooter } from '@/lib/email/layout';
import { RESEND_CC, RESEND_FROM, RESEND_REPLY_TO } from './config';

const TALENT_FOOTER = {
  reason: 'You received this email because you asked Divine Acquisition about placing operators with your business.',
};

export function buildAssessmentInviteEmail(input: {
  fullName: string;
  companyName?: string | null;
  bookingUrl: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const firstName = greetingName(input.fullName);
  const company = input.companyName?.trim();
  const expiresLabel = new Date(input.expiresAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const subject = company
    ? `Quick assessment call — ${company} × Divine Acquisition`
    : 'Book your 20–30 min assessment call with Divine Acquisition';
  const thanks = company
    ? `Thank you for your interest in placing operators with ${company}.`
    : 'Thank you for your interest in placing operators with Divine Acquisition.';
  const ask = 'We would like to schedule a brief 20–30 minute assessment call to walk through fit, timeline, and next steps.';
  const expiry = 'If the link expires, reply to this email and we will send a fresh one.';

  const text = [
    `Hi ${firstName},`,
    '',
    thanks,
    '',
    ask,
    '',
    `Please use your personal booking link (expires in 24 hours — ${expiresLabel}):`,
    input.bookingUrl,
    '',
    expiry,
    '',
    '— Divine Acquisition',
    '',
    ...textFooter(TALENT_FOOTER),
  ].join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: 'Pick a time for a short assessment call. Your link expires in 24 hours.',
    eyebrow: 'Assessment call',
    title: 'Book a 20–30 minute assessment call',
    greeting: firstName,
    paragraphs: [thanks, ask],
    details: [
      { label: 'Length', value: '20–30 minutes' },
      { label: 'Link expires', value: expiresLabel },
    ],
    cta: { href: input.bookingUrl, label: 'Choose a time' },
    showFallbackLink: true,
    note: expiry,
    footer: TALENT_FOOTER,
  });

  return { subject, html, text };
}

async function sendTemplatedEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const cc = RESEND_CC.filter((email) => email.toLowerCase() !== input.to.toLowerCase());

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [input.to],
    ...(cc.length > 0 ? { cc } : {}),
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(RESEND_REPLY_TO ? { replyTo: RESEND_REPLY_TO } : {}),
    tags: [
      { name: 'surface', value: 'assessment' },
      { name: 'type', value: input.type },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}

export async function sendAssessmentInviteEmail(input: {
  to: string;
  fullName: string;
  companyName?: string | null;
  bookingUrl: string;
  expiresAt: string;
}): Promise<{ id: string }> {
  const content = buildAssessmentInviteEmail(input);
  return sendTemplatedEmail({
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    type: 'booking_invite',
  });
}

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

function buildScheduledCallEmail(input: {
  fullName: string;
  companyName?: string | null;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  calendarUrl?: string | null;
  kind: 'confirmation' | 'reminder';
}): { subject: string; html: string; text: string } {
  const firstName = greetingName(input.fullName);
  const when = formatWhen(input.startsAt, input.timeZone);
  const company = input.companyName?.trim();
  const meetLine = input.meetUrl ? `Google Meet: ${input.meetUrl}` : 'Meeting link will follow shortly.';
  const calLine = input.calendarUrl ? `Calendar: ${input.calendarUrl}` : null;

  const subject =
    input.kind === 'reminder'
      ? `Reminder: assessment call in 30 minutes — ${when}`
      : company
        ? `Confirmed: assessment call with ${company} — ${when}`
        : `Confirmed: your assessment call — ${when}`;

  const intro =
    input.kind === 'reminder'
      ? `This is a reminder that your ${input.durationMinutes}-minute assessment call starts in about 30 minutes.`
      : `Your ${input.durationMinutes}-minute assessment call is confirmed.`;

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
    '— Divine Acquisition',
    '',
    ...textFooter(TALENT_FOOTER),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${when}. ${input.durationMinutes} minutes${input.meetUrl ? ' on Google Meet' : ''}.`,
    eyebrow: input.kind === 'reminder' ? 'Starting soon' : 'Call confirmed',
    title: input.kind === 'reminder' ? 'Your call starts in 30 minutes' : 'Your assessment call is confirmed',
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
    footer: TALENT_FOOTER,
  });

  return { subject, html, text };
}

export async function sendAssessmentBookingConfirmationEmail(input: {
  to: string;
  fullName: string;
  companyName?: string | null;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  calendarUrl?: string | null;
}): Promise<{ id: string }> {
  const content = buildScheduledCallEmail({ ...input, kind: 'confirmation' });
  return sendTemplatedEmail({
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    type: 'booking_confirmation',
  });
}

export async function sendAssessmentBookingReminderEmail(input: {
  to: string;
  fullName: string;
  companyName?: string | null;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  meetUrl?: string | null;
  calendarUrl?: string | null;
}): Promise<{ id: string }> {
  const content = buildScheduledCallEmail({ ...input, kind: 'reminder' });
  return sendTemplatedEmail({
    to: input.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    type: 'booking_reminder',
  });
}
