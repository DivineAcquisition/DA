import { Resend } from 'resend';
import { RESEND_CC, RESEND_FROM, RESEND_REPLY_TO } from './config';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAssessmentInviteEmail(input: {
  fullName: string;
  companyName?: string | null;
  bookingUrl: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const firstName = input.fullName.trim().split(/\s+/)[0] || 'there';
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

  const text = [
    `Hi ${firstName},`,
    '',
    company
      ? `Thank you for your interest in placing operators with ${company}.`
      : 'Thank you for your interest in placing operators with Divine Acquisition.',
    '',
    'We would like to schedule a brief 20–30 minute assessment call to walk through fit, timeline, and next steps.',
    '',
    `Please use your personal booking link (expires in 24 hours — ${expiresLabel}):`,
    input.bookingUrl,
    '',
    'If the link expires, reply to this email and we will send a fresh one.',
    '',
    '— Divine Acquisition Talent',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#07070b;color:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070b;">
    <tr>
      <td align="center" style="padding-top:40px;padding-bottom:40px;padding-left:16px;padding-right:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#0b0a11;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="padding-top:36px;padding-bottom:12px;padding-left:36px;padding-right:36px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c3b6fe;">
                Divine Acquisition Talent
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">
                Book a 20–30 minute assessment call
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                Hi ${escapeHtml(firstName)},
              </p>
              <p style="margin-top:14px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                ${
                  company
                    ? `Thank you for your interest in placing operators with <span style="color:#ffffff;">${escapeHtml(company)}</span>.`
                    : 'Thank you for your interest in placing operators with Divine Acquisition.'
                }
                We would like to schedule a brief assessment call to cover fit, timeline, and next steps.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;padding-bottom:12px;padding-left:36px;padding-right:36px;">
              <a href="${escapeHtml(input.bookingUrl)}" style="display:inline-block;background-color:#9a88fc;color:#07070b;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;border-radius:999px;">
                Choose a time
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;padding-bottom:28px;padding-left:36px;padding-right:36px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#737373;text-align:center;">
                This personal link expires in 24 hours (${escapeHtml(expiresLabel)}).
              </p>
              <p style="margin-top:18px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#525252;word-break:break-all;">
                ${escapeHtml(input.bookingUrl)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:0;padding-bottom:32px;padding-left:36px;padding-right:36px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin-top:24px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#525252;">
                If the link expires, reply to this email and we will send a fresh one.
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

export async function sendAssessmentInviteEmail(input: {
  to: string;
  fullName: string;
  companyName?: string | null;
  bookingUrl: string;
  expiresAt: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(apiKey);
  const content = buildAssessmentInviteEmail(input);

  const cc = RESEND_CC.filter((email) => email.toLowerCase() !== input.to.toLowerCase());

  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to: [input.to],
    ...(cc.length > 0 ? { cc } : {}),
    subject: content.subject,
    html: content.html,
    text: content.text,
    ...(RESEND_REPLY_TO ? { replyTo: RESEND_REPLY_TO } : {}),
    tags: [
      { name: 'surface', value: 'assessment' },
      { name: 'type', value: 'booking_invite' },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}
