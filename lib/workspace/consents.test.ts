import { describe, expect, it } from 'vitest';
import { OPERATOR_CONSENTS, consentsForRecipientType } from './consents';

describe('consentsForRecipientType', () => {
  it('returns the full operator consent set for operators', () => {
    const consents = consentsForRecipientType('operator');
    expect(consents).toHaveLength(OPERATOR_CONSENTS.length);
    expect(consents.map((c) => c.id)).toContain('esign_consent');
    expect(consents.map((c) => c.id)).toContain('independent_contractor');
  });

  it('returns a shorter set for non-operators', () => {
    const consents = consentsForRecipientType('client');
    expect(consents.map((c) => c.id)).toEqual(['read_agreement', 'esign_consent']);
  });
});
