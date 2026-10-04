/**
 * One look for every email DA sends: brand bar, a single card, and the brand
 * footer. Table layout with inline styles only, because Gmail and
 * Outlook drop <style> blocks and flexbox.
 */

const SITE_URL = 'https://divineacquisition.io';
const ACQ_ORIGIN = (process.env.NEXT_PUBLIC_ACQ_HOST ?? 'https://acq.divineacquisition.io').replace(/\/$/, '');

export const EMAIL_BRAND = {
  name: 'Divine Acquisition',
  motto: 'Devotion. Value. Exclusivity.',
  siteUrl: SITE_URL,
  siteLabel: 'divineacquisition.io',
  auditUrl: ACQ_ORIGIN,
  privacyUrl: `${ACQ_ORIGIN}/privacy`,
  termsUrl: `${ACQ_ORIGIN}/terms`,
  markUrl: `${ACQ_ORIGIN}/email-mark.png`,
} as const;

const C = {
  canvas: '#07070b',
  card: '#0f0e15',
  cardBorder: '#211f2d',
  panel: '#0a0910',
  panelBorder: '#24222f',
  rule: '#1d1b27',
  accent: '#9a88fc',
  accentSoft: '#c3b6fe',
  formal: '#f87171',
  heading: '#ffffff',
  body: '#c9c8d3',
  muted: '#8a8898',
  faint: '#5f5d6c',
} as const;

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** First name for the greeting; the full name when the first token is an initial. */
export function greetingName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  const first = trimmed.split(/\s+/)[0] ?? '';
  return first.length >= 2 ? first : trimmed;
}

export type EmailDetail = { label: string; value: string; href?: string | null };

export type EmailFooter = {
  /** Why this person is getting the email. */
  reason: string;
  /** Client-facing mail links to the free audit; talent and team mail does not. */
  showAuditLink?: boolean;
  disclaimer?: string;
};

export type EmailContent = {
  subject: string;
  /** Inbox preview text, hidden in the body. */
  preheader: string;
  eyebrow: string;
  title: string;
  greeting?: string | null;
  paragraphs?: string[];
  /** Pre-rendered body placed after the paragraphs (escape anything you pass in). */
  bodyHtml?: string;
  details?: EmailDetail[];
  cta?: { href: string; label: string; formal?: boolean } | null;
  /** Prints the CTA address under the button for clients that block links. */
  showFallbackLink?: boolean;
  /** Pre-rendered blocks placed after the CTA (escape anything you pass in). */
  extraHtml?: string;
  note?: string | null;
  signoff?: { name: string; role?: string } | null;
  footer: EmailFooter;
};

export function paragraphHtml(text: string, color: string = C.body): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${color};">${escapeHtml(text).replace(/\n/g, '<br />')}</p>`;
}

export function buttonHtml(href: string, label: string, formal = false): string {
  const bg = formal ? C.formal : C.accent;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${bg}" style="border-radius:12px;background-color:${bg};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:15px;font-weight:700;line-height:1;color:${C.canvas};text-decoration:none;border-radius:12px;">${escapeHtml(label)}&nbsp;&rarr;</a>
</td></tr></table>`;
}

export function detailsHtml(details: EmailDetail[]): string {
  const rows = details
    .map((detail, index) => {
      const value = detail.href
        ? `<a href="${escapeHtml(detail.href)}" style="color:${C.accentSoft};text-decoration:none;word-break:break-all;">${escapeHtml(detail.value)}</a>`
        : escapeHtml(detail.value);
      const border = index === 0 ? '' : `border-top:1px solid ${C.panelBorder};`;
      return `<tr><td style="padding:14px 20px;${border}">
<p style="margin:0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};">${escapeHtml(detail.label)}</p>
<p style="margin:6px 0 0;font-family:${SANS};font-size:16px;line-height:1.5;color:${C.heading};">${value}</p>
</td></tr>`;
    })
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.panel};border:1px solid ${C.panelBorder};border-radius:14px;">${rows}</table>`;
}

/** A bordered block used for each item in a digest. */
export function itemCardHtml(title: string, bodyHtml: string, link?: { href: string; label: string } | null): string {
  const action = link
    ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:14px;font-weight:700;"><a href="${escapeHtml(link.href)}" style="color:${C.accentSoft};text-decoration:none;">${escapeHtml(link.label)}&nbsp;&rarr;</a></p>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 14px;background-color:${C.panel};border:1px solid ${C.panelBorder};border-radius:14px;"><tr><td style="padding:18px 20px;">
<p style="margin:0 0 10px;font-family:${SANS};font-size:16px;font-weight:700;line-height:1.4;color:${C.heading};">${escapeHtml(title)}</p>
${bodyHtml}${action}
</td></tr></table>`;
}

function noteHtml(note: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="border-left:3px solid ${C.accent};padding:4px 0 4px 16px;">
<p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.65;color:${C.muted};">${escapeHtml(note).replace(/\n/g, '<br />')}</p>
</td></tr></table>`;
}

function footerHtml(footer: EmailFooter): string {
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:${C.accentSoft};text-decoration:none;">${escapeHtml(label)}</a>`;
  const dot = `<span style="color:${C.faint};">&nbsp;&nbsp;&middot;&nbsp;&nbsp;</span>`;
  const links = [
    link(EMAIL_BRAND.siteUrl, EMAIL_BRAND.siteLabel),
    ...(footer.showAuditLink ? [link(EMAIL_BRAND.auditUrl, 'Book a free audit')] : []),
    link(EMAIL_BRAND.privacyUrl, 'Privacy policy'),
    link(EMAIL_BRAND.termsUrl, 'Terms'),
  ].join(dot);
  const small = (text: string, top = 8) =>
    `<p style="margin:${top}px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};">${text}</p>`;

  return `<tr><td style="padding:36px 8px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid ${C.rule};padding-top:28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px;"><img src="${escapeHtml(EMAIL_BRAND.markUrl)}" width="21" height="28" alt="" style="display:block;border:0;outline:none;" /></td>
<td valign="middle">
<p style="margin:0;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${C.heading};">${escapeHtml(EMAIL_BRAND.name)}</p>
</td></tr></table>
<p style="margin:16px 0 0;font-family:${SERIF};font-size:13px;font-style:italic;line-height:1.6;color:${C.muted};">${escapeHtml(EMAIL_BRAND.motto)}</p>
<p style="margin:16px 0 0;font-family:${SANS};font-size:12px;line-height:1.8;">${links}</p>
${small(escapeHtml(footer.reason), 16)}
${footer.disclaimer ? small(escapeHtml(footer.disclaimer)) : ''}
${small(`&copy; ${new Date().getFullYear()} ${escapeHtml(EMAIL_BRAND.name)}. All rights reserved.`)}
</td></tr></table>
</td></tr>`;
}

export function renderEmailHtml(content: EmailContent): string {
  const body: string[] = [];
  if (content.greeting) body.push(paragraphHtml(`Hi ${content.greeting},`));
  for (const text of content.paragraphs ?? []) body.push(paragraphHtml(text));
  if (content.bodyHtml) body.push(content.bodyHtml);

  const sections: string[] = [];
  if (content.details?.length) sections.push(`<tr><td style="padding:8px 40px 0;">${detailsHtml(content.details)}</td></tr>`);
  if (content.cta) {
    sections.push(`<tr><td style="padding:28px 40px 0;">${buttonHtml(content.cta.href, content.cta.label, content.cta.formal)}</td></tr>`);
    if (content.showFallbackLink) {
      sections.push(`<tr><td style="padding:14px 40px 0;">
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.faint};">If the button does not open, paste this into your browser:<br />
<a href="${escapeHtml(content.cta.href)}" style="color:${C.accentSoft};text-decoration:none;word-break:break-all;">${escapeHtml(content.cta.href)}</a></p>
</td></tr>`);
    }
  }
  if (content.extraHtml) sections.push(`<tr><td style="padding:24px 40px 0;">${content.extraHtml}</td></tr>`);
  if (content.note) sections.push(`<tr><td style="padding:28px 40px 0;">${noteHtml(content.note)}</td></tr>`);
  if (content.signoff) {
    sections.push(`<tr><td style="padding:28px 40px 0;">
<p style="margin:0;font-family:${SERIF};font-size:17px;font-style:italic;color:${C.heading};">${escapeHtml(content.signoff.name)}</p>
${content.signoff.role ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:13px;color:${C.muted};">${escapeHtml(content.signoff.role)}</p>` : ''}
</td></tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.canvas};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.canvas};">${escapeHtml(content.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.canvas}" style="background-color:${C.canvas};">
<tr><td align="center" style="padding:40px 16px 48px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;">
<tr><td style="padding:0 8px 22px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td valign="middle">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding-right:12px;"><img src="${escapeHtml(EMAIL_BRAND.markUrl)}" width="27" height="36" alt="${escapeHtml(EMAIL_BRAND.name)}" style="display:block;border:0;outline:none;" /></td>
<td valign="middle"><p style="margin:0;font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${C.heading};">${escapeHtml(EMAIL_BRAND.name)}</p></td>
</tr></table>
</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.cardBorder};border-radius:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="height:4px;line-height:4px;font-size:0;background-color:${C.accent};border-radius:20px 20px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:36px 40px 0;">
<p style="margin:0;font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${C.accent};">${escapeHtml(content.eyebrow)}</p>
<h1 style="margin:14px 0 0;font-family:${SERIF};font-size:30px;line-height:1.22;font-weight:700;color:${C.heading};">${escapeHtml(content.title)}</h1>
</td></tr>
<tr><td style="padding:22px 40px 0;">${body.join('')}</td></tr>
${sections.join('\n')}
<tr><td style="height:40px;line-height:40px;font-size:0;">&nbsp;</td></tr>
</table>
</td></tr>
${footerHtml(content.footer)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Plain-text footer that mirrors the HTML one. */
export function textFooter(footer: EmailFooter): string[] {
  return [
    '--',
    EMAIL_BRAND.name,
    EMAIL_BRAND.siteUrl,
    ...(footer.showAuditLink ? [`Book a free audit: ${EMAIL_BRAND.auditUrl}`] : []),
    `Privacy policy: ${EMAIL_BRAND.privacyUrl}`,
    `Terms: ${EMAIL_BRAND.termsUrl}`,
    '',
    footer.reason,
    ...(footer.disclaimer ? [footer.disclaimer] : []),
  ];
}
