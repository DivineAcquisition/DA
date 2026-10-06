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

  it('sets Inter Display on every text style and uses the auth lockup', () => {
    const html = renderEmailHtml(base);
    expect(html).toContain(EMAIL_BRAND.logoUrl);
    expect(html).toContain('alt="DivineAcquisition"');
    expect(html).toContain('InterDisplay-Regular.woff2');
    expect(html).toContain('InterDisplay-Italic.woff2');
    expect(html).toContain('InterDisplay-Bold.woff2');
    expect(html).not.toContain('email-mark.png');
    expect(html).not.toMatch(/Georgia|Times New Roman/);
    const families = html.match(/font-family:[^;}"]+/g) ?? [];
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      expect(family.startsWith("font-family:'Inter Display'")).toBe(true);
    }
  });

  it('keeps the password reset template on the same font and logo', () => {
    const html = readFileSync(new URL('../../supabase/templates/recovery.html', import.meta.url), 'utf8');
    expect(html).toContain('/email-logo.png');
    expect(html).toContain('Inter Display');
    expect(html).toContain('InterDisplay-Bold.woff2');
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
