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

/** Prefer a real first name; fall back to full name / "there" for initials. */
function inviteGreetingName(recipientName: string): string {
  const trimmed = recipientName.trim();
  if (!trimmed) return 'there';
  const first = trimmed.split(/\s+/)[0] ?? '';
  if (first.length >= 2) return first;
  return trimmed;
}

export function buildAgreementInviteEmail(input: {
  recipientName: string;
  companyName: string;
  templateName: string;
  signingUrl: string;
}): { subject: string; html: string; text: string } {
  const greetingName = inviteGreetingName(input.recipientName);
  const company = input.companyName.trim() || 'Divine Acquisition';
  const docName = input.templateName.trim() || 'Agreement';

  const subject = `${company}: ${docName} ready for your signature`;

  const text = [
    `Hi ${greetingName},`,
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
<body style="margin:0;padding:0;background-color:#0a0a0c;color:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0c;">
    <tr>
      <td align="center" style="padding-top:40px;padding-bottom:48px;padding-left:16px;padding-right:16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:22px;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:0.02em;color:#ffffff;">
                ${escapeHtml(company)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#121218;border:1px solid #26262f;border-radius:18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-top:36px;padding-bottom:4px;padding-left:36px;padding-right:36px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9a88fc;">
                      Signature requested
                    </p>
                    <h1 style="margin:14px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.25;font-weight:700;color:#ffffff;">
                      Your agreement is ready
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px;padding-bottom:4px;padding-left:36px;padding-right:36px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#b3b3bc;">
                      Hi ${escapeHtml(greetingName)},
                    </p>
                    <p style="margin-top:12px;margin-bottom:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#b3b3bc;">
                      Please review and sign
                      <span style="color:#ffffff;">${escapeHtml(docName)}</span>
                      from ${escapeHtml(company)}. Your link opens a private signing page on talent.divineacquisition.io.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:26px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0c;border:1px solid #2a2a35;border-radius:12px;">
                      <tr>
                        <td style="padding:18px 20px;">
                          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#6f6f7a;">
                            Document
                          </p>
                          <p style="margin:8px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.4;font-weight:700;color:#ffffff;">
                            ${escapeHtml(docName)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:30px;padding-bottom:8px;padding-left:36px;padding-right:36px;">
                    <a href="${escapeHtml(input.signingUrl)}" style="display:inline-block;background-color:#9a88fc;color:#0a0a0c;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding-top:14px;padding-bottom:14px;padding-left:32px;padding-right:32px;border-radius:10px;">
                      Review &amp; sign
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;padding-bottom:28px;padding-left:36px;padding-right:36px;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.65;color:#6f6f7a;text-align:center;">
                      This link is unique to you. If the button doesn’t open, use:<br />
                      <a href="${escapeHtml(input.signingUrl)}" style="color:#c3b6fe;text-decoration:underline;word-break:break-all;">${escapeHtml(input.signingUrl)}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#52525b;">
                ${escapeHtml(company)} · If you weren’t expecting this, you can ignore it.
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
