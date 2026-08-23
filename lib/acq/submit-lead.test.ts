import { describe, expect, it } from 'vitest';
import { submitLead } from './submit-lead';

const valid = {
  fullName: 'Jordan Blake',
  email: 'jordan@example.com',
  phone: '555-201-8890',
  companyName: 'Blake Coaching',
  adSpend: '$5k+',
  followUp: 'I do it myself',
  programPrice: '$2-5k',
};

describe('submitLead', () => {
  it('accepts honeypot bots without calling the pipeline', async () => {
    const result = await submitLead({ ...valid, website: 'https://spam.test' }, 'localhost');
    expect(result).toEqual({ ok: true, redirectTo: '/acq/thank-you' });
  });

  it('rejects invalid fields before any API call', async () => {
    const result = await submitLead({ ...valid, email: 'not-an-email' }, 'localhost');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('email');
    }
  });

  it('blocks when the GHL acquisition location is not configured', async () => {
    const result = await submitLead(valid, 'localhost');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/paused/i);
    }
  });
});
