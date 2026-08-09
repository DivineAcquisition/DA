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

  const subject = `${company}: ${docName} ready for your signature`;

  const text = [
    `Hi ${firstName},`,
    '',
    `${company} sent you an agreement to review and sign.`,
    '',
    `Document: ${docName}`,
    '',
    'Open your secure signing page (unique to you):',
    input.signingUrl,
    '',
    'You’ll review the document, confirm the required acknowledgements, and sign electronically.',
    'If you were not expecting this email, you can ignore it.',
    '',
    `— ${company}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#07070b;color:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#07070b;">
    <tr>
      <td align="center" style="padding-top:32px;padding-bottom:40px;padding-left:16px;padding-right:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
          <tr>
            <td style="padding-bottom:18px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c3b6fe;">
                ${escapeHtml(company)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0b0a11;border:1px solid rgba(255,255,255,0.08);border-radius:20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,#9a88fc 0%,#6650d8 55%,rgba(154,136,252,0.15) 100%);border-radius:20px 20px 0 0;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding-top:32px;padding-bottom:8px;padding-left:32px;padding-right:32px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#ae9dfd;">
                      Agreement ready
                    </p>
                    <h1 style="margin:12px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;">
                      Please review and sign
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;padding-bottom:8px;padding-left:32px;padding-right:32px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                      Hi ${escapeHtml(firstName)},
                    </p>
                    <p style="margin-top:12px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#a3a3a3;">
                      <span style="color:#ffffff;">${escapeHtml(company)}</span> prepared
                      <span style="color:#ffffff;">${escapeHtml(docName)}</span> for you.
                      Open your secure page to review the terms and complete your signature.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:22px;padding-bottom:8px;padding-left:32px;padding-right:32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#100f18;border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#737373;">
                            Document
                          </p>
                          <p style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.4;font-weight:700;color:#ffffff;">
                            ${escapeHtml(docName)}
                          </p>
                          <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#a3a3a3;">
                            Personal link · Secure signing on talent.divineacquisition.io
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:28px;padding-bottom:10px;padding-left:32px;padding-right:32px;">
                    <a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background-color:#9a88fc;color:#07070b;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding-top:15px;padding-bottom:15px;padding-left:34px;padding-right:34px;border-radius:999px;">
                      Open signing page
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;padding-bottom:8px;padding-left:32px;padding-right:32px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#737373;text-align:center;">
                      Review → acknowledge → sign. Takes a few minutes.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px;padding-bottom:28px;padding-left:32px;padding-right:32px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#525252;word-break:break-all;text-align:center;">
                      ${escapeHtml(input.signingUrl)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:0;padding-bottom:28px;padding-left:32px;padding-right:32px;border-top:1px solid rgba(255,255,255,0.06);">
                    <p style="margin-top:22px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#525252;">
                      This link is unique to you. If you were not expecting this email, you can ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:18px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#525252;">
                ${escapeHtml(company)} · Secure document delivery
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
