import { Resend } from 'resend';
import { ACQ_AUDIT_CC, ACQ_PUBLIC_ORIGIN } from './config';

export type AcqEmailKind = 'confirmation' | 'reminder_24h' | 'reminder_2h';

const LOGO_URL = `${ACQ_PUBLIC_ORIGIN}/email-mark.png`;
const PRIVACY_URL = 'https://divineacquisition.io/privacy-policy';
const TERMS_URL = `${ACQ_PUBLIC_ORIGIN}/terms`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  return first.length >= 2 ? first : fullName.trim() || 'there';
}

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
}): { subject: string; html: string; text: string } {
  const name = firstName(input.fullName);
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
    'Divine Acquisition',
    PRIVACY_URL,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const meetButton = input.meetUrl
    ? `<tr><td style="padding-top:22px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
        <a href="${escapeHtml(input.meetUrl)}" style="display:inline-block;background-color:#9a88fc;color:#07070b;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">Join Google Meet</a>
      </td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#07070b;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070b;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#0b0a11;border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
          <tr>
            <td style="padding:32px 36px 8px;">
              <img src="${escapeHtml(LOGO_URL)}" width="42" height="56" alt="Divine Acquisition" style="display:block;border:0;outline:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 36px 0;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c3b6fe;">Divine Acquisition</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 36px 0;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">${escapeHtml(headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 36px 0;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#d4d4d4;">Hi ${escapeHtml(name)},</p>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#d4d4d4;">${escapeHtml(intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#14131c;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#ffffff;">
                    <strong>When</strong><br />
                    <span style="color:#d4d4d4;">${escapeHtml(when)}</span><br />
                    <span style="color:#a3a3a3;">30 minutes</span>
                    ${offer ? `<br /><br /><strong>What you sell</strong><br /><span style="color:#d4d4d4;">${escapeHtml(offer)}</span>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${meetButton}
          <tr>
            <td style="padding:18px 36px 0;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#d4d4d4;">${escapeHtml(effort)}</p>
              <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#d4d4d4;">${escapeHtml(scope)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 32px;">
              <p style="margin:0;border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#737373;">
                Divine Acquisition<br />
                You received this email because you booked an audit call with us.<br />
                <a href="${PRIVACY_URL}" style="color:#c3b6fe;text-decoration:none;">Privacy policy</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(TERMS_URL)}" style="color:#c3b6fe;text-decoration:none;">Terms</a><br />
                This message is not part of, or endorsed by, Facebook or Meta.<br />
                &copy; 2026 Divine Acquisition. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const from =
    process.env.RESEND_FROM?.trim() ||
    'Divine Acquisition <noreply@noreply.divineacquisition.io>';
  const content = buildAcqAuditEmail(input);
  const resend = new Resend(apiKey);
  const cc = acqAuditCc(input.to);
  const { data, error } = await resend.emails.send({
    from,
    to: [input.to],
    ...(cc.length ? { cc } : {}),
    subject: content.subject,
    html: content.html,
    text: content.text,
    ...(process.env.RESEND_REPLY_TO ? { replyTo: process.env.RESEND_REPLY_TO } : {}),
  });
  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }
  return { id: data.id };
}
