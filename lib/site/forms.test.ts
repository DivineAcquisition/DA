import { describe, expect, it } from 'vitest';

import { HONEYPOT_FIELD, normalizeWebsite, parseDiagnosticRequest, parseDiscovery, trackFor } from './forms';

const request = {
  fullName: 'Avery Stone',
  email: 'Avery@Example.co',
  company: 'Stone Roofing',
  website: 'stoneroofing.com',
  position: 'Founder / Owner',
  phone: '',
  businessType: 'Roofing / Remodeling',
  dealValue: '$5,001–$20,000',
  monthlyOpportunities: '11–30',
  constraints: ['Proposals or estimates going quiet', 'Poor CRM organization'],
  crm: 'Spreadsheets / Manual Process',
  timeline: 'Within 30 days',
  privacyConsent: true,
  marketingConsent: false,
};

const discovery = {
  email: 'avery@example.co',
  company: 'Stone Roofing',
  businessType: 'Roofing / Remodeling',
  primaryServices: 'Roof replacement',
  mainOffer: 'Full replacement with warranty',
  averageDealValue: '$14,000',
  salesCycle: '1–4 weeks',
  sources: ['Referrals', 'Paid Ads'],
  newOpportunityProcess: 'Calls go to the office.',
  qualificationOwner: 'The owner.',
  pipelineManagement: 'A spreadsheet.',
  stalledProspects: 'Usually nothing.',
  qualifiedLast30: '24',
  progressedLast30: '',
  customersLast30Unknown: true,
  biggestLoss: 'After the estimate.',
  tools: 'Gmail, a spreadsheet',
  disconnected: 'Estimates and follow-up',
  approver: 'The owner',
  successLooksLike: 'Fewer quiet estimates',
  estimateBooking: 'By phone',
  estimateFollowUp: 'Nobody, consistently',
  jobHandoff: 'A text to the crew lead',
};

describe('diagnostic request', () => {
  it('accepts a complete request and normalizes it', () => {
    const result = parseDiagnosticRequest(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe('avery@example.co');
    expect(result.value.website).toBe('https://stoneroofing.com');
    expect(result.value.constraints).toEqual(['Proposals or estimates going quiet', 'Poor CRM organization']);
    expect(result.value.marketingConsent).toBe(false);
  });

  it('reports every missing field at once', () => {
    const result = parseDiagnosticRequest({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fields ?? {})).toEqual(
      expect.arrayContaining(['fullName', 'email', 'company', 'website', 'position', 'businessType', 'dealValue', 'monthlyOpportunities', 'constraints', 'crm', 'timeline', 'privacyConsent']),
    );
    expect(result.fields?.phone).toBeUndefined();
  });

  it('requires the privacy acknowledgement but not marketing consent', () => {
    const result = parseDiagnosticRequest({ ...request, privacyConsent: false });
    expect(result).toMatchObject({ ok: false, field: 'privacyConsent' });
  });

  it('allows no website when the box is checked', () => {
    const result = parseDiagnosticRequest({ ...request, website: '', noWebsite: true });
    expect(result.ok && result.value.website).toBeNull();
  });

  it('rejects options that are not on the form', () => {
    expect(parseDiagnosticRequest({ ...request, crm: 'Zoho' })).toMatchObject({ ok: false, field: 'crm' });
    expect(parseDiagnosticRequest({ ...request, constraints: ['Something else'] })).toMatchObject({ ok: false, field: 'constraints' });
  });

  it('flags a bot that fills the hidden field', () => {
    expect(parseDiagnosticRequest({ ...request, [HONEYPOT_FIELD]: 'x' })).toEqual({ ok: false, error: 'honeypot' });
  });

  it('normalizes websites', () => {
    expect(normalizeWebsite('acme.io/')).toBe('https://acme.io');
    expect(normalizeWebsite('http://acme.io')).toBe('http://acme.io');
    expect(normalizeWebsite('not a site')).toBeNull();
  });
});

describe('pre-discovery questionnaire', () => {
  it('asks the local-service follow-ups and keeps unknown figures', () => {
    const result = parseDiscovery(discovery);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.qualifiedLast30).toBe(24);
    expect(result.value.progressedLast30).toBeNull();
    expect(result.value.customersLast30).toBe('Unknown');
    expect(result.value.followUps.map((item) => item.label)).toHaveLength(3);
  });

  it('requires the B2B follow-ups for a consultancy', () => {
    const result = parseDiscovery({ ...discovery, businessType: 'B2B Consultancy' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fields ?? {})).toEqual(['proposalTracking', 'postDiscoveryOwner', 'renewals']);
  });

  it('rejects a figure that is not a whole number', () => {
    expect(parseDiscovery({ ...discovery, qualifiedLast30: 'about 20' })).toMatchObject({ ok: false, field: 'qualifiedLast30' });
  });

  it('maps business types to their follow-up track', () => {
    expect(trackFor('Specialized Agency')).toBe('b2b');
    expect(trackFor('Other High-End Local Services')).toBe('local');
    expect(trackFor('Other')).toBe('general');
  });
});
