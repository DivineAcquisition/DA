import { describe, expect, it } from 'vitest';
import { buildBrandedPdf } from './branded-pdf';
import { airtableOperatorFields, maskAccount, onboardingSections } from './onboarding-packet';

describe('branded placement pdf', () => {
  it('is a PDF that carries the operator name and not a broken header', () => {
    const bytes = buildBrandedPdf({
      kicker: 'DIVINE ACQUISITION',
      title: 'Ana Cruz',
      subtitle: 'Sales operator placement packet',
      sections: onboardingSections({
        legal_name: { value: 'Ana Cruz' },
        preferred_name: { value: 'Ana' },
        account_number: { value: '9988776655' },
        shift: { value: '9am_530pm_est' },
      }),
    });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('Ana Cruz');
    expect(text).toContain('9988776655');
    expect(text).toContain('9AM - 5:30PM EST');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});

describe('airtable operator fields', () => {
  it('keeps only the last four digits of the account number', () => {
    expect(maskAccount('9988-7766-55')).toBe('ending 6655');
    const fields = airtableOperatorFields({
      name: 'Ana Cruz',
      email: 'ana.cruz@operators.test',
      answers: {
        preferred_name: { value: 'Ana' },
        legal_name: { value: 'Ana Cruz' },
        email: { value: 'ana.work@operators.test' },
        account_number: { value: '9988776655' },
        bank_name: { value: 'BPI' },
        discord: { value: '@ana.cruz' },
      },
    });
    expect(fields.name).toBe('Ana');
    expect(fields.email).toBe('ana.work@operators.test');
    expect(fields.discord).toBe('ana.cruz');
    expect(fields.notes).toContain('ending 6655');
    expect(fields.notes).not.toContain('9988776655');
  });
});
