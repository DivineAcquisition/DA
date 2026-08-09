import { describe, expect, it } from 'vitest';
import {
  applyOperatorExactMappings,
  buildOperatorCompanyValues,
  buildOperatorSignerValues,
  buildSalesOperatorSignerValues,
  companyInfoFromSettings,
  filterKnownFields,
  initialsFromName,
  inferOperatorVariant,
  resolveCompanyRoleName,
  resolveOperatorSignerRoleName,
} from './operator-agreement';
import type { MappedField } from './field-mapping';

const company = companyInfoFromSettings({
  company_name: 'Divine Acquisition',
  company_rep: 'Malik Sannie',
  company_email: 'malik@divineacquisition.io',
  company_title: 'Owner',
});

describe('operator agreement variant', () => {
  it('detects the hourly VA template by name', () => {
    expect(inferOperatorVariant('VA Independent Contractor Agreement')).toBe('standard');
    expect(inferOperatorVariant('VA Independent Contractor Agreement — V2 Hourly')).toBe('hourly');
  });
});

describe('buildOperatorSignerValues', () => {
  it('fills the Novara standard VA contractor fields', () => {
    const values = buildOperatorSignerValues(
      {
        fullName: 'Alex Operator',
        legalName: 'Alexandra Operator',
        email: 'alex@example.com',
        phone: '+1 (555) 123-4567',
        address: '12 Baker Street',
        now: new Date('2026-08-07T12:00:00Z'),
      },
      company,
      'standard',
    );

    expect(values).toMatchObject({
      'Contractor Name': 'Alex Operator',
      'Full Name': 'Alex Operator',
      'Legal Name': 'Alexandra Operator',
      'Full Address': '12 Baker Street',
      'Mobile Number': '15551234567',
      Email: 'alex@example.com',
      Date: '2026-08-07',
      'Contractor Date': '2026-08-07',
      'Authorized Rep': 'Malik Sannie',
    });
  });

  it('fills the hourly VA template fields', () => {
    const values = buildOperatorSignerValues(
      {
        fullName: 'Alex Operator',
        email: 'alex@example.com',
        now: new Date('2026-08-07T12:00:00Z'),
      },
      company,
      'hourly',
    );

    expect(values).toEqual({
      'Contractor Name': 'Alex Operator',
      'Authorized Representative': 'Malik Sannie',
      'Effective Date': '2026-08-07',
      Date: '2026-08-07',
    });
  });
});

describe('buildOperatorCompanyValues', () => {
  it('maps the company countersign page', () => {
    expect(buildOperatorCompanyValues(company, 'standard', new Date('2026-08-07T12:00:00Z'))).toMatchObject({
      'Effective Date': '2026-08-07',
      'Company Date': '2026-08-07',
      'Company Signature': 'Malik Sannie',
    });
    expect(buildOperatorCompanyValues(company, 'hourly')).toEqual({
      'Company Full Name': 'Divine Acquisition',
      'Company Signature': 'Malik Sannie',
    });
  });
});

describe('sales operator / role resolution', () => {
  it('prefers Operator and Divine Acquisition roles when present', () => {
    const submitters = [
      { name: 'Operator', uuid: 'a' },
      { name: 'Divine Acquisition', uuid: 'b' },
    ];
    expect(resolveOperatorSignerRoleName(submitters)).toBe('Operator');
    expect(resolveCompanyRoleName(submitters)).toBe('Divine Acquisition');
  });

  it('builds Sales Operator signer values and initials', () => {
    expect(initialsFromName('A Sannie')).toBe('AS');
    expect(
      buildSalesOperatorSignerValues({
        fullName: 'A Sannie',
        email: 'asannie74@gmail.com',
        now: new Date('2026-08-09T12:00:00Z'),
      }),
    ).toEqual({
      Operator: 'A Sannie',
      Name: 'A Sannie',
      'Effective Date': '2026-08-09',
      Date: '2026-08-09',
      'Operator initials': 'AS',
    });
  });
});

describe('filter + apply', () => {
  it('drops fields that are not on the current template revision', () => {
    expect(
      filterKnownFields(
        { 'Contractor Name': 'Alex', 'Ghost Field': 'nope' },
        ['Contractor Name'],
      ),
    ).toEqual({ 'Contractor Name': 'Alex' });
  });

  it('overlays exact VA values onto generic mapped fields', () => {
    const mapped: MappedField[] = [
      {
        name: 'Contractor Name',
        type: 'text',
        required: true,
        value: null,
        sourceKey: null,
        sourceLabel: 'No match',
        origin: 'none',
        confidence: 'none',
      },
      {
        name: 'Authorized Rep',
        type: 'text',
        required: false,
        value: null,
        sourceKey: null,
        sourceLabel: 'No match',
        origin: 'none',
        confidence: 'none',
      },
      {
        name: 'Signature',
        type: 'signature',
        required: true,
        value: null,
        sourceKey: null,
        sourceLabel: 'Signer completes',
        origin: 'skipped',
        confidence: 'none',
      },
    ];

    const next = applyOperatorExactMappings(mapped, {
      'Contractor Name': 'Alex Operator',
      'Authorized Rep': 'Malik Sannie',
    });

    expect(next[0].value).toBe('Alex Operator');
    expect(next[0].sourceLabel).toBe('VA / operator map');
    expect(next[1].value).toBe('Malik Sannie');
    expect(next[2].origin).toBe('skipped');
  });
});
