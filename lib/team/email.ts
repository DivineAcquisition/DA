import { itemCardHtml, paragraphHtml, renderEmailHtml, textFooter } from '@/lib/email/layout';
import { teamPath } from './url';

/**
 * VA-facing email, sent from notify.divineacquisition.io. The record is the
 * truth and the email is only the doorbell: every message carries counts, dates
 * and times (never customer details, which the database never puts in a
 * message) and a link to the exact record.
 */

export type MailItem = { id: string; subject: string; title: string; body: string; link: string | null; formal: boolean };

export type MailMessage = {
  kind: 'single' | 'digest';
  operator_id: string;
  to: string;
  first_name: string;
  preferred_channel: string | null;
  items: MailItem[];
};

export function recordUrl(baseUrl: string, link: string | null): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${teamPath(link ?? '/vistrial/operator/inbox')}`;
}

function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => paragraphHtml(block))
    .join('');
}

const ACTION_LABEL = (item: MailItem) => (item.formal ? 'View this notice' : 'Open the record');
const EYEBROW = 'DivineACQ Team';

function teamFooter(kind: MailMessage['kind']) {
  const timing =
    kind === 'digest'
      ? 'Non-urgent updates arrive together once a day during your working hours. '
      : '';
  return {
    reason: `${timing}You received this because you work with Divine Acquisition as an operator. Reply to this email to reach DA.`,
  };
}

export function buildTeamEmail(message: MailMessage, baseUrl: string): { subject: string; html: string; text: string } {
  const footer = teamFooter(message.kind);

  if (message.kind === 'single' || message.items.length === 1) {
    const item = message.items[0];
    const url = recordUrl(baseUrl, item.link);
    return {
      subject: item.subject,
      html: renderEmailHtml({
        subject: item.subject,
        preheader: item.title,
        eyebrow: item.formal ? `${EYEBROW} · Formal notice` : EYEBROW,
        title: item.title,
        bodyHtml: paragraphs(item.body),
        cta: { href: url, label: ACTION_LABEL(item), formal: item.formal },
        footer,
      }),
      text: [item.body, '', `${ACTION_LABEL(item)}: ${url}`, '', '— DivineACQ Team', '', ...textFooter(footer)].join('\n'),
    };
  }

  const subject = `${message.items.length} updates from DivineACQ Team`;
  const greeting = message.first_name || 'there';
  // The greeting is already at the top; each item drops its own "Hi Name," opener.
  const stripGreeting = (body: string) => body.replace(/^Hi [^,\n]+,\s*/, '');
  const blocks = message.items
    .map((item) =>
      itemCardHtml(item.title, paragraphs(stripGreeting(item.body)), {
        href: recordUrl(baseUrl, item.link),
        label: ACTION_LABEL(item),
      }),
    )
    .join('');
  const text = [
    `Hi ${greeting}, here is today's update.`,
    '',
    ...message.items.flatMap((item) => [
      item.title,
      stripGreeting(item.body),
      `${ACTION_LABEL(item)}: ${recordUrl(baseUrl, item.link)}`,
      '',
    ]),
    '— DivineACQ Team',
    '',
    ...textFooter(footer),
  ].join('\n');
  return {
    subject,
    html: renderEmailHtml({
      subject,
      preheader: `${message.items.length} updates: ${message.items.map((item) => item.title).join(' · ')}`,
      eyebrow: EYEBROW,
      title: `Hi ${greeting}, here is today's update`,
      bodyHtml: blocks,
      footer,
    }),
    text,
  };
}
