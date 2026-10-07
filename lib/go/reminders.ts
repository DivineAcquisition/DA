import { Resend } from 'resend';
import { greetingName, paragraphHtml, renderEmailHtml, textFooter } from '@/lib/email/layout';
import { ACQ_AUDIT_CC } from '@/lib/acq/config';
import { GO_PRECALL_URL } from '@/lib/go/config';

export type GoEmailKind = 'confirmation' | 'reminder_24h' | 'reminder_2h';
export type GoSmsKind = 'sms_24h' | 'sms_2h' | 'sms_15m';

const META_DISCLAIMER = 'This message is not part of, or endorsed by, Facebook or Meta.';

export function formatSessionWhen(startsAt: string, timeZone: string): string {
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

export function buildGoSessionEmail(input: {
  fullName: string;
  startsAt: string;
  timeZone: string;
  meetUrl?: string | null;
  kind: GoEmailKind;
}): { subject: string; html: string; text: string } {
  const name = greetingName(input.fullName);
  const when = formatSessionWhen(input.startsAt, input.timeZone);
  const headline =
    input.kind === 'reminder_24h'
      ? 'Your strategy session is in 24 hours'
      : input.kind === 'reminder_2h'
        ? 'Your strategy session is in 2 hours'
        : 'Your strategy session is confirmed';
  const subject = input.kind === 'confirmation' ? `Confirmed: strategy session on ${when}` : `Reminder: ${headline}`;
  const intro =
    input.kind === 'reminder_24h'
      ? 'This is a reminder that your 30-minute strategy session is in 24 hours. Please keep the time.'
      : input.kind === 'reminder_2h'
        ? 'This is a reminder that your 30-minute strategy session starts in about 2 hours.'
        : "You're booked. We'll email you the day before and again two hours out, and text the Google Meet link 15 minutes before we start.";
  const focus =
    "Take the call from a private room, with the noise off and nothing else competing for your attention. We'll give the hour the same focus.";
  const footer = {
    reason: 'You received this email because you booked a strategy session with Divine Acquisition.',
    disclaimer: META_DISCLAIMER,
  };

  const text = [
    `Hi ${name},`,
    '',
    intro,
    '',
    `When: ${when}`,
    'Length: 30 minutes',
    input.meetUrl ? `Google Meet: ${input.meetUrl}` : 'Google Meet: the link will be in your calendar invite.',
    input.kind === 'confirmation' ? `Before the call: ${GO_PRECALL_URL}` : null,
    '',
    focus,
    '',
    'Malik',
    'Founder, Divine Acquisition',
    '',
    ...textFooter(footer),
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const html = renderEmailHtml({
    subject,
    preheader: `${when}. 30 minutes${input.meetUrl ? ' on Google Meet' : ''}.`,
    eyebrow: input.kind === 'confirmation' ? 'Session confirmed' : 'Session reminder',
    title: headline,
    greeting: name,
    paragraphs: [intro],
    details: [
      { label: 'When', value: when },
      { label: 'Length', value: '30 minutes' },
      ...(input.meetUrl ? [{ label: 'Google Meet', value: input.meetUrl, href: input.meetUrl }] : []),
      ...(input.kind === 'confirmation'
        ? [{ label: 'Before the call', value: 'Watch the briefing', href: GO_PRECALL_URL }]
        : []),
    ],
    cta: input.meetUrl ? { href: input.meetUrl, label: 'Join Google Meet' } : null,
    extraHtml: `${paragraphHtml(focus)}${
      input.kind === 'confirmation' ? paragraphHtml(`Watch this before we talk: ${GO_PRECALL_URL}`) : ''
    }`,
    signoff: { name: 'Malik', role: 'Founder, Divine Acquisition' },
    footer,
  });

  return { subject, html, text };
}

export function goSessionCc(to: string): string[] {
  const recipient = to.trim().toLowerCase();
  return recipient === ACQ_AUDIT_CC ? [] : [ACQ_AUDIT_CC];
}

export function goReminderSms(input: { kind: GoSmsKind; when: string; meetUrl?: string | null }): string {
  const link = input.meetUrl ? ` Google Meet: ${input.meetUrl}` : ' Check your email for the Google Meet link.';
  const stop = ' Reply STOP to opt out.';
  if (input.kind === 'sms_15m') {
    const join = input.meetUrl ? ` Join: ${input.meetUrl}` : ' The Google Meet link is in your confirmation email.';
    return `Divine Acquisition: we start in 15 minutes.${join}${stop}`;
  }
  if (input.kind === 'sms_2h') {
    return `Divine Acquisition: your strategy session is in 2 hours (${input.when}).${link}${stop}`;
  }
  return `Divine Acquisition: your strategy session is in 24 hours (${input.when}).${link}${stop}`;
}

export async function sendGoSessionEmail(input: {
  to: string;
  fullName: string;
  startsAt: string;
  timeZone: string;
  meetUrl?: string | null;
  kind: GoEmailKind;
  bookingId: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const from =
    process.env.RESEND_FROM?.trim() || 'Divine Acquisition <noreply@noreply.divineacquisition.io>';
  const content = buildGoSessionEmail(input);
  const resend = new Resend(apiKey);
  const cc = goSessionCc(input.to);
  const { data, error } = await resend.emails.send(
    {
      from,
      to: [input.to],
      ...(cc.length ? { cc } : {}),
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
    },
    { idempotencyKey: `go-session/${input.bookingId}/${input.kind}` },
  );
  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }
  return { id: data.id };
}
