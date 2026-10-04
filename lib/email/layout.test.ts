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
  it('carries the growth consulting footer and legal links', () => {
    const html = renderEmailHtml(base);
    expect(html).toContain('Growth Consulting');
    expect(html).toContain(EMAIL_BRAND.positioning);
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

  it('mirrors the footer in plain text', () => {
    const text = textFooter({ reason: 'You booked a call.' }).join('\n');
    expect(text).toContain('Divine Acquisition | Growth Consulting');
    expect(text).toContain(EMAIL_BRAND.siteUrl);
    expect(text).toContain('You booked a call.');
  });
});
