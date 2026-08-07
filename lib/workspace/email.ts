import { Resend } from 'resend';

export const WORKSPACE_RESEND_FROM =
  process.env.RESEND_AGREEMENT_FROM ??
  process.env.RESEND_FROM ??
  'Divine Acquisition <noreply@noreply.divineacquisition.io>';

export const WORKSPACE_RESEND_REPLY_TO =
  process.env.RESEND_AGREEMENT_REPLY_TO ?? process.env.RESEND_REPLY_TO ?? undefined;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildAgreementInviteEmail(input: {
  recipientName: string;
  companyName: string;
  templateName: string;
  signingUrl: string;
}): { subject: string; html: string; text: string } {
  const firstName = input.recipientName.trim().split(/\s+/)[0] || 'there';
  const company = input.companyName.trim() || 'Divine Acquisition';
  const docName = input.templateName.trim() || 'Agreement';

  const subject = `${company}: please review and sign ${docName}`;

  const text = [
    `Hi ${firstName},`,
    '',
    `${company} sent you a document to review and sign: ${docName}.`,
    '',
    'Open your personal signing link:',
    input.signingUrl,
    '',
    'This link is unique to you. If you were not expecting this email, you can ignore it.',
    '',
    `— ${company}`,
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
                ${escapeHtml(company)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
              <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;">
                Please review and sign
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding-top:12px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                Hi ${escapeHtml(firstName)},
              </p>
              <p style="margin-top:14px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                <span style="color:#ffffff;">${escapeHtml(company)}</span> sent you
                <span style="color:#ffffff;">${escapeHtml(docName)}</span> to review and sign.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:28px;padding-bottom:12px;padding-left:36px;padding-right:36px;">
              <a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background-color:#9a88fc;color:#07070b;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding-top:14px;padding-bottom:14px;padding-left:28px;padding-right:28px;border-radius:999px;">
                Open document
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:8px;padding-bottom:28px;padding-left:36px;padding-right:36px;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#737373;text-align:center;">
                Your personal Divine Acquisition signing link
              </p>
              <p style="margin-top:18px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#525252;word-break:break-all;">
                ${escapeHtml(input.signingUrl)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:0;padding-bottom:32px;padding-left:36px;padding-right:36px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin-top:24px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#525252;">
                If you were not expecting this email, you can ignore it.
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

export async function sendAgreementInviteEmail(input: {
  to: string;
  recipientName: string;
  companyName: string;
  templateName: string;
  signingUrl: string;
}): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const content = buildAgreementInviteEmail(input);
  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: WORKSPACE_RESEND_FROM,
    to: [input.to],
    subject: content.subject,
    html: content.html,
    text: content.text,
    ...(WORKSPACE_RESEND_REPLY_TO ? { replyTo: WORKSPACE_RESEND_REPLY_TO } : {}),
    tags: [
      { name: 'surface', value: 'workspace' },
      { name: 'type', value: 'agreement_invite' },
    ],
  });

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Resend did not return an email id');
  }

  return { id: data.id };
}
