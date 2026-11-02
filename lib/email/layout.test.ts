import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMAIL_BRAND, renderEmailHtml, textFooter } from './layout';

const base = {
  subject: 'Subject',
  preheader: 'Preview',
  eyebrow: 'Eyebrow',
  title: 'Title <b>',
  greeting: 'Jordan',
  paragraphs: ['Body & more'],
  footer: { reason: 'You booked a call.' },
};

describe('email layout', () => {
  it('carries the brand footer and legal links, without practice or positioning lines', () => {
    const html = renderEmailHtml(base);
    expect(html).toContain(EMAIL_BRAND.motto);
    expect(html).not.toMatch(/growth consulting|sales operation/i);
    expect(html).toContain(EMAIL_BRAND.privacyUrl);
    expect(html).toContain(EMAIL_BRAND.termsUrl);
    expect(html).toContain('You booked a call.');
    expect(html).not.toContain('Book a free audit');
  });

  it('adds the audit link and disclaimer only when asked', () => {
    const html = renderEmailHtml({ ...base, footer: { reason: 'r', showAuditLink: true, disclaimer: 'Not Meta.' } });
    expect(html).toContain('Book a free audit');
    expect(html).toContain('Not Meta.');
  });

  it('escapes content', () => {
    const html = renderEmailHtml(base);
    expect(html).toContain('Title &lt;b&gt;');
    expect(html).toContain('Body &amp; more');
  });

  it('uses Plus Jakarta Sans for headings, Inter for body, and the auth lockup', () => {
    const html = renderEmailHtml({ ...base, cta: { href: 'https://example.com/go', label: 'Open' } });
    expect(html).toContain(EMAIL_BRAND.logoUrl);
    expect(html).toContain('alt="DivineAcquisition"');
    expect(html).toContain('Plus+Jakarta+Sans');
    expect(html).toContain(EMAIL_BRAND.primary);
    expect(html).toContain(EMAIL_BRAND.accent);
    expect(html).not.toContain('email-mark.png');
    expect(html).not.toMatch(/Georgia|Times New Roman/);
    expect(html).toContain(`<h1 style="margin:14px 0 0;font-family:${"'Plus Jakarta Sans', Inter"}`);
    const families = html.match(/font-family:[^;}"]+/g) ?? [];
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family).toContain('Helvetica');
      expect(family).toContain('Arial');
    }
  });

  it('puts the reply-to inbox in the footer when one is set', () => {
    const html = renderEmailHtml({ ...base, footer: { reason: 'You booked a call.', replyTo: 'malik@divineacquisition.io' } });
    expect(html).toContain('Reply to this email at malik@divineacquisition.io.');
  });

  it('keeps the password reset template on the same font, logo, and button', () => {
    const html = readFileSync(new URL('../../supabase/templates/recovery.html', import.meta.url), 'utf8');
    expect(html).toContain('/email-logo.png');
    expect(html).toContain('Plus Jakarta Sans');
    expect(html).toContain('#6A00FF');
    expect(html).toContain('{{ .ConfirmationURL }}');
    expect(html).toContain('Devotion. Value. Exclusivity.');
    expect(html).not.toContain('email-mark.png');
    expect(html).not.toMatch(/Georgia|Times New Roman/);
  });

  it('mirrors the footer in plain text', () => {
    const text = textFooter({ reason: 'You booked a call.' }).join('\n');
    expect(text).toContain('Divine Acquisition');
    expect(text).not.toMatch(/growth consulting|sales operation/i);
    expect(text).toContain(EMAIL_BRAND.siteUrl);
    expect(text).toContain('You booked a call.');
  });
});
