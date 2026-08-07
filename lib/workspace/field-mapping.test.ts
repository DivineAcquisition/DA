import { describe, expect, it } from 'vitest';
import {
  buildProfile,
  mapFields,
  mappingSummary,
  matchProfileKey,
  normalizeFieldName,
  splitName,
  toDocuSealFields,
} from './field-mapping';

const recipient = {
  full_name: 'Ada Lovelace',
  email: 'ada@analytical.co',
  phone: '+15551234567',
  business_name: 'Analytical Engines LLC',
};

describe('field name matching', () => {
  it('normalizes punctuation and casing', () => {
    expect(normalizeFieldName("Client's  Full-Name ")).toBe('client s full name');
  });

  it('matches an exact alias', () => {
    expect(matchProfileKey('Email Address')).toEqual({ key: 'email', confidence: 'exact' });
  });

  it('matches a decorated label that contains the alias', () => {
    expect(matchProfileKey('Client Full Name')?.key).toBe('full_name');
    expect(matchProfileKey('Company Legal Name')?.key).toBe('business_name');
    expect(matchProfileKey('Cell Phone Number')?.key).toBe('phone');
  });

  it('refuses a match it cannot justify', () => {
    expect(matchProfileKey('Preferred Kickoff Cadence')).toBeNull();
    expect(matchProfileKey('')).toBeNull();
  });
});

describe('profile building', () => {
  it('splits a full name into first and last', () => {
    expect(splitName('Ada Lovelace')).toEqual({ first: 'Ada', last: 'Lovelace' });
    expect(splitName('Ada King Lovelace')).toEqual({ first: 'Ada', last: 'King Lovelace' });
    expect(splitName('')).toEqual({ first: '', last: '' });
  });

  it('fills gaps from previously submitted answers without overwriting the record', () => {
    const profile = buildProfile({
      recipient,
      submitted: {
        'Company Name': 'Stale Co',
        'Mailing Address': '12 Baker Street',
        Date: 'January 1, 1843',
      },
    });

    expect(profile.business_name).toBe('Analytical Engines LLC');
    expect(profile.address).toBe('12 Baker Street');
    expect(profile.date).not.toBe('January 1, 1843');
  });
});

describe('mapping a template', () => {
  const fields = [
    { name: 'Full Name', type: 'text', required: true },
    { name: 'Email Address', type: 'text', required: true },
    { name: 'Company', type: 'text' },
    { name: 'Effective Date', type: 'date' },
    { name: 'Signature', type: 'signature', required: true },
    { name: 'Preferred Kickoff Cadence', type: 'text' },
    { name: 'terms_page_url', type: 'text' },
  ];

  const context = {
    profile: buildProfile({ recipient, now: new Date('2026-03-04T00:00:00Z') }),
    submitted: { 'Preferred Kickoff Cadence': 'Weekly' },
    pageUrls: { terms_page_url: 'https://admin.divineacquisition.io/p/abc' },
  };

  it('fills identity fields from the recipient record', () => {
    const mapped = mapFields(fields, context);
    const byName = Object.fromEntries(mapped.map((field) => [field.name, field]));

    expect(byName['Full Name'].value).toBe('Ada Lovelace');
    expect(byName['Email Address'].value).toBe('ada@analytical.co');
    expect(byName['Company'].value).toBe('Analytical Engines LLC');
    expect(byName['Effective Date'].value).toBe('2026-03-04');
  });

  it('reuses an answer the recipient gave on an earlier agreement', () => {
    const mapped = mapFields(fields, context);
    const cadence = mapped.find((field) => field.name === 'Preferred Kickoff Cadence');
    expect(cadence?.value).toBe('Weekly');
    expect(cadence?.origin).toBe('submitted');
  });

  it('leaves signature fields to the signer', () => {
    const mapped = mapFields(fields, context);
    const signature = mapped.find((field) => field.name === 'Signature');
    expect(signature?.value).toBeNull();
    expect(signature?.origin).toBe('skipped');
    expect(mappingSummary(mapped).missingRequired).toEqual([]);
  });

  it('honours an administrator override and an ignore instruction', () => {
    const mapped = mapFields(fields, {
      ...context,
      overrides: {
        company: { sourceKey: 'literal', literalValue: 'Divine Acquisition' },
        'full name': { sourceKey: 'ignore' },
      },
    });
    const byName = Object.fromEntries(mapped.map((field) => [field.name, field]));

    expect(byName['Company'].value).toBe('Divine Acquisition');
    expect(byName['Company'].origin).toBe('override');
    expect(byName['Full Name'].value).toBeNull();
    expect(byName['Full Name'].origin).toBe('skipped');
  });

  it('always sends tokenized page URLs as read-only', () => {
    const mapped = mapFields(fields, context);
    const sent = toDocuSealFields(mapped);
    const page = sent.find((field) => field.name === 'terms_page_url');
    const name = sent.find((field) => field.name === 'Full Name');

    expect(page).toEqual({
      name: 'terms_page_url',
      default_value: 'https://admin.divineacquisition.io/p/abc',
      readonly: true,
    });
    expect(name?.readonly).toBe(false);
  });

  it('sends a page URL even when the field catalogue is stale', () => {
    const mapped = mapFields([], {
      ...context,
      pageUrls: { late_page: 'https://admin.divineacquisition.io/p/xyz' },
    });
    expect(mapped).toHaveLength(1);
    expect(mapped[0].origin).toBe('page');
  });

  it('reports what it could not fill', () => {
    const mapped = mapFields(
      [
        { name: 'Full Name', type: 'text', required: true },
        { name: 'Referral Source', type: 'text', required: true },
      ],
      { profile: context.profile, submitted: {} },
    );
    const summary = mappingSummary(mapped);

    expect(summary).toMatchObject({
      total: 2,
      filled: 1,
      unmapped: ['Referral Source'],
      missingRequired: ['Referral Source'],
    });
  });
});
