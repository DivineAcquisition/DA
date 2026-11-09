import { appUrl } from '@/lib/apps';
import { renderEmailHtml, textFooter } from '@/lib/email/layout';
import type { EmailPurpose } from '@/lib/email/policy';

export type EodMailPayload = {
  name?: string;
  client?: string;
  work_date?: string;
  due_label?: string;
  shift_label?: string;
  time_zone?: string;
  wins?: string;
  blockers?: string;
  plan?: string;
  needs_help?: boolean;
  was_late?: boolean;
  to?: string[] | string;
  cc?: string[] | string;
  link_path?: string;
  review_path?: string;
  operator_id?: string;
  placement_id?: string;
  case_file_id?: string;
};

export type EodLetter = {
  purpose: EmailPurpose;
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  text: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function emails(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(list.map((item) => text(item).toLowerCase()).filter((item) => item.includes('@')))];
}

function zoneLabel(zone: string): string {
  if (zone === 'America/Chicago') return 'Central';
  if (zone === 'America/New_York') return 'Eastern';
  return zone;
}

function clock(label: string, zone: string): string {
  if (!label) return '';
  const where = zoneLabel(zone);
  return where ? `${label} ${where}` : label;
}

function prettyDay(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function letter(input: {
  purpose: EmailPurpose;
  to: string[];
  cc?: string[] | string;
  subject: string;
  title: string;
  paragraphs: string[];
  href?: string;
  label?: string;
  reason: string;
}): EodLetter {
  const footer = { reason: input.reason };
  return {
    purpose: input.purpose,
    to: input.to,
    cc: emails(input.cc),
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
    text: [input.title, '', ...input.paragraphs, '', input.href && input.label ? `${input.label}: ${input.href}` : '', '', ...textFooter(footer)]
      .filter((line) => line !== '')
      .join('\n'),
  };
}

function reportLines(payload: EodMailPayload): string[] {
  const lines = [
    `Wins: ${text(payload.wins) || 'Nothing written.'}`,
    `Blockers: ${text(payload.blockers) || 'Nothing written.'}`,
    `Tomorrow: ${text(payload.plan) || 'Nothing written.'}`,
  ];
  if (payload.needs_help) lines.push('He asked for manager help.');
  if (payload.was_late) lines.push('This report was submitted late.');
  return lines;
}

/** The letter for one queued end-of-day mail row. The client letter has no edit link. */
export function eodLetter(kind: string, payload: EodMailPayload, env: Record<string, string | undefined> = process.env): EodLetter {
  const name = text(payload.name) || 'The operator';
  const client = text(payload.client) || 'the client';
  const day = prettyDay(text(payload.work_date));
  const zone = text(payload.time_zone);
  const to = emails(payload.to);
  const cc = emails(payload.cc).filter((email) => !to.includes(email));

  if (kind === 'operator.eod_reminder') {
    const path = text(payload.link_path).startsWith('/') ? text(payload.link_path) : '';
    const href = path ? `${appUrl('team', env)}${path}` : undefined;
    return letter({
      purpose: 'team',
      to,
      cc,
      subject: `Your end of day for ${client}${day ? ` on ${day}` : ''}`,
      title: 'Your end of day is coming up',
      paragraphs: [
        `${name}, your shift with ${client}${day ? ` on ${day}` : ''} ends at ${clock(text(payload.shift_label), zone)}.`,
        `Your end of day is due at ${clock(text(payload.due_label), zone)}. This link opens the report. No sign-in.`,
      ],
      href,
      label: href ? 'Open your end of day' : undefined,
      reason: `You received this because your shift with ${client} ends at ${clock(text(payload.shift_label), zone)}.`,
    });
  }

  if (kind === 'manager.eod_submitted') {
    const path = text(payload.review_path).startsWith('/workspace/') ? text(payload.review_path) : '';
    const href = path ? `${appUrl('admin', env)}${path}` : undefined;
    return letter({
      purpose: 'team',
      to,
      cc,
      subject: `${name} submitted the end of day for ${client}`,
      title: `${name} submitted ${day || 'the end of day'}`,
      paragraphs: [`${name} submitted the end of day for ${client}${day ? ` on ${day}` : ''}.`, ...reportLines(payload)],
      href,
      label: href ? 'Open the report' : undefined,
      reason: `You received this because you manage ${name} on ${client}.`,
    });
  }

  return letter({
    purpose: 'client',
    to,
    cc,
    subject: `${name} submitted the end of day for ${client}`,
    title: `${name} submitted the end of day`,
    paragraphs: [`${name} submitted the end of day for ${client}${day ? ` on ${day}` : ''}.`, ...reportLines(payload)],
    reason: `You received this because ${name} is the operator Divine Acquisition placed with ${client}.`,
  });
}
