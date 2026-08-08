import { describe, expect, it } from 'vitest';
import { consentsForRecipientType, OPERATOR_CONSENTS } from './consents';

describe('signing consents', () => {
  it('requires operator-specific independent contractor acknowledgement', () => {
    const consents = consentsForRecipientType('operator');
    expect(consents).toEqual(OPERATOR_CONSENTS);
    expect(consents.some((c) => c.id === 'independent_contractor')).toBe(true);
    expect(consents.some((c) => c.id === 'esign_consent')).toBe(true);
  });

  it('uses a shorter consent set for clients', () => {
    const consents = consentsForRecipientType('client');
    expect(consents.some((c) => c.id === 'independent_contractor')).toBe(false);
    expect(consents.length).toBeGreaterThanOrEqual(2);
  });
});
