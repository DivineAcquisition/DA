import { Resend } from 'resend';
import {
  WORKSPACE_AGREEMENT_CC,
  WORKSPACE_RESEND_FROM,
  WORKSPACE_RESEND_REPLY_TO,
} from '../workspace/email';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function greetingName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  const first = trimmed.split(/\s+/)[0] ?? '';
  return first.length >= 2 ? first : trimmed;
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

  const text = [
    `Hi ${firstName},`,
    '',
    `Your ${input.durationMinutes}-minute Lead Leak Audit is confirmed.`,
    '',
    `When: ${when}`,
    meetLine,
    ...(calLine ? [calLine] : []),
    '',
    company ? `Company: ${company}` : null,
    '— Divine Acquisition',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const cta = input.meetUrl
    ? `<a href="${escapeHtml(input.meetUrl)}" style="display:inline-block;background-color:#9a88fc;color:#07070b;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;border-radius:999px;">Join Google Meet</a>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#07070b;color:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070b;">
    <tr><td align="center" style="padding-top:40px;padding-bottom:40px;padding-left:16px;padding-right:16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#0b0a11;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="padding-top:36px;padding-bottom:12px;padding-left:36px;padding-right:36px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c3b6fe;">Divine Acquisition</p>
        </td></tr>
        <tr><td style="padding-top:8px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
          <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">Your Lead Leak Audit is confirmed</h1>
        </td></tr>
        <tr><td style="padding-top:12px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">Hi ${escapeHtml(firstName)},</p>
          <p style="margin-top:14px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">Your ${input.durationMinutes}-minute Lead Leak Audit is confirmed.</p>
          <p style="margin-top:14px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#ffffff;"><strong>When:</strong> ${escapeHtml(when)}</p>
          ${
            input.meetUrl
              ? `<p style="margin-top:10px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;"><strong style="color:#ffffff;">Meet:</strong> ${escapeHtml(input.meetUrl)}</p>`
              : ''
          }
        </td></tr>
        ${
          cta
            ? `<tr><td align="center" style="padding-top:28px;padding-bottom:28px;padding-left:36px;padding-right:36px;">${cta}</td></tr>`
            : '<tr><td style="padding-bottom:28px;"></td></tr>'
        }
      </table>
    </td></tr>
  </table>
</body>
</html>`;

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
