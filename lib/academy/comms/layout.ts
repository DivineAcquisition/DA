const FONT_BODY = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FONT_HEAD = "'Plus Jakarta Sans', Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphHtml(text: string): string {
  const lines = text.split('\n');
  const listed = lines.every((line) => /^(- |\d+\. )/.test(line));
  if (listed && lines.length > 0 && lines[0].startsWith('- ')) {
    const items = lines
      .map((line) => `<li style="margin:0 0 8px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:#1c1b22;">${escapeHtml(line.slice(2))}</li>`)
      .join('');
    return `<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`;
  }
  if (listed && lines.length > 0 && /^\d+\. /.test(lines[0])) {
    const items = lines
      .map((line) => `<li style="margin:0 0 8px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:#1c1b22;">${escapeHtml(line.replace(/^\d+\. /, ''))}</li>`)
      .join('');
    return `<ol style="margin:0 0 16px;padding-left:20px;">${items}</ol>`;
  }
  return `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:16px;line-height:1.6;color:#1c1b22;">${escapeHtml(text).replace(/\n/g, '<br />')}</p>`;
}

export function buttonHtml(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;"><tr>
<td align="center" bgcolor="#6A00FF" style="border-radius:8px;background-color:#6A00FF;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT_HEAD};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function urlsIn(text: string): string[] {
  return [...new Set((text.match(/https?:\/\/[^\s<>]+/g) ?? []).map((url) => url.replace(/[).,]+$/, '')))];
}

/** The single action link, preferring the training route over a certificate or pulse link. */
export function primaryUrl(text: string, preferred?: Array<string | undefined>): string | null {
  const found = urlsIn(text);
  if (found.length === 0) return null;
  for (const candidate of preferred ?? []) {
    if (candidate && found.includes(candidate)) return candidate;
  }
  return found[0];
}

export function buttonLabel(body: string, href: string): string {
  const line = body.split('\n').find((item) => item.includes(href)) ?? '';
  const lead = line.split(href)[0].toLowerCase();
  if (lead.includes('sign in')) return 'Sign in';
  if (lead.includes('sign here') || lead.startsWith('sign')) return 'Sign';
  if (lead.includes('renew')) return 'Renew';
  if (/(^|\n)start /.test(line.toLowerCase()) || lead.includes('start now') || lead.includes('start your') || lead.includes('start here')) return 'Start';
  if (lead.includes('review') || lead.includes('open the review') || lead.includes('open it') || lead.includes('their page')) return 'Review';
  return 'Continue';
}

/**
 * One column, 600 pixels, real text only. The plain-text body is the same
 * words; the button repeats the single primary link.
 */
function blocksHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .filter((block) => block.trim().length > 0)
    .map((block) => paragraphHtml(block.trim()))
    .join('');
}

export function renderAcademyHtml(input: {
  subject: string;
  preheader: string;
  message: string;
  footer: string;
  href?: string | null;
  button?: string | null;
}): string {
  const blocks = blocksHtml(input.message);
  const footer = blocksHtml(input.footer);
  const button = input.href && input.button ? buttonHtml(input.href, input.button) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f5f8;color:#1c1b22;font-family:${FONT_BODY};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f6f5f8;">${escapeHtml(input.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f6f5f8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;">
<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 20px;font-family:${FONT_HEAD};font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6A00FF;">Divine Acquisition</p>
${blocks}
${button}
<div style="margin-top:8px;padding-top:16px;border-top:1px solid #e6e4ee;font-size:13px;line-height:1.5;color:#5c5a66;">${footer}</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
