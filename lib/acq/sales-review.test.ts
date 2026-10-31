import { describe, expect, it } from 'vitest';
import { parseSalesReview, salesReviewNote } from './sales-review';

const complete = {
  firstName: 'Dana Cole',
  email: 'dana@northline.example',
  phone: '(415) 555-0134',
  company: 'Northline Advisory',
  process: 'Follow-up after the discovery call depends on whoever remembers.',
  smsConsent: true,
  website: '',
  visit: { utm_source: 'linkedin', fbclid: 'click.1' },
};

describe('sales operations review request', () => {
  it('accepts a complete request and keeps the visit', () => {
    const parsed = parseSalesReview(complete);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lead.company).toBe('Northline Advisory');
    expect(parsed.lead.visit.utm_source).toBe('linkedin');
    expect(parsed.lead.visit.fbclid).toBe('click.1');
    const note = salesReviewNote(parsed.lead);
    expect(note).toContain('Page: sales operations review');
    expect(note).toContain('utm_source: linkedin');
  });

  it('rejects a short process note and a missing consent', () => {
    expect(parseSalesReview({ ...complete, process: 'too short' })).toMatchObject({
      ok: false,
      field: 'process',
    });
    expect(parseSalesReview({ ...complete, smsConsent: false })).toMatchObject({
      ok: false,
      field: 'smsConsent',
    });
  });

  it('treats the honeypot as a silent success signal', () => {
    expect(parseSalesReview({ ...complete, website: 'https://spam.example' })).toEqual({
      ok: false,
      error: 'honeypot',
    });
  });
});
