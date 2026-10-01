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

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function recordUrl(baseUrl: string, link: string | null): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}${teamPath(link ?? '/vistrial/operator/inbox')}`;
}

function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#d4d4d4;">${escapeHtml(block).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');
}

function button(href: string, label: string, formal: boolean): string {
  const bg = formal ? '#f87171' : '#a78bfa';
  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${bg};color:#0b0a11;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function shell(subject: string, inner: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#07070b;color:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070b;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#0b0a11;border:1px solid rgba(255,255,255,0.08);">
<tr><td style="padding:32px 32px 8px;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c3b6fe;">Divine Acquisition Team</p></td></tr>
<tr><td style="padding:8px 32px 24px;">${inner}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#737373;">${footer}</p></td></tr>
</table></td></tr></table></body></html>`;
}

const ACTION_LABEL = (item: MailItem) => (item.formal ? 'View this notice' : 'Open the record');

export function buildTeamEmail(message: MailMessage, baseUrl: string): { subject: string; html: string; text: string } {
  const footerText =
    message.kind === 'digest'
      ? 'Non-urgent updates arrive together once a day during your working hours. Reply to this email to reach DA.'
      : 'Reply to this email to reach DA.';

  if (message.kind === 'single' || message.items.length === 1) {
    const item = message.items[0];
    const url = recordUrl(baseUrl, item.link);
    const heading = `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(item.title)}</h1>`;
    return {
      subject: item.subject,
      html: shell(item.subject, `${heading}${paragraphs(item.body)}${button(url, ACTION_LABEL(item), item.formal)}`, footerText),
      text: [item.body, '', `${ACTION_LABEL(item)}: ${url}`, '', '— Divine Acquisition Team', footerText].join('\n'),
    };
  }

  const subject = `${message.items.length} updates from Divine Acquisition Team`;
  const greeting = `<h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.3;color:#ffffff;">Hi ${escapeHtml(message.first_name || 'there')}, here is today's update</h1>`;
  const blocks = message.items
    .map((item) => {
      const url = recordUrl(baseUrl, item.link);
      // The greeting is already at the top; each item drops its own "Hi Name," opener.
      const body = item.body.replace(/^Hi [^,\n]+,\s*/, '');
      return `<div style="margin:0 0 22px;padding:16px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;"><p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">${escapeHtml(item.title)}</p>${paragraphs(body)}<a href="${escapeHtml(url)}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c3b6fe;">${ACTION_LABEL(item)}</a></div>`;
    })
    .join('');
  const text = [
    `Hi ${message.first_name || 'there'}, here is today's update.`,
    '',
    ...message.items.flatMap((item) => [
      item.title,
      item.body.replace(/^Hi [^,\n]+,\s*/, ''),
      `${ACTION_LABEL(item)}: ${recordUrl(baseUrl, item.link)}`,
      '',
    ]),
    '— Divine Acquisition Team',
    footerText,
  ].join('\n');
  return { subject, html: shell(subject, `${greeting}${blocks}`, footerText), text };
}
