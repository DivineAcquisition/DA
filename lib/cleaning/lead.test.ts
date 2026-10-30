import { describe, expect, it } from 'vitest';
import { cleaningVisibleCopy } from './copy';
import { cleaningLeadNote, parseCleaningLead } from './lead';
import { cleaningSettings } from './settings';

const valid = {
  firstName: 'Malik',
  phone: '202-555-0199',
  email: 'owner@example.com',
  company: 'Bright Homes',
  serviceArea: 'Montgomery County',
  monthlyRevenue: 'under $15K',
  recurringShare: 'Under 25%',
  answersLeads: 'A VA or office',
  adBudget: 'Not yet',
  tracking: { utm_source: 'meta', utm_campaign: 'cleaning' },
};

describe('cleaning lead', () => {
  it('accepts a complete request and flags low revenue and budget', () => {
    const parsed = parseCleaningLead(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lead.page).toBe('cleaning');
    expect(parsed.lead.underRevenueFloor).toBe(true);
    expect(parsed.lead.budgetNotYet).toBe(true);
    expect(parsed.lead.tracking.utm_source).toBe('meta');
    expect(cleaningLeadNote(parsed.lead)).toContain('Page: cleaning');
    expect(cleaningLeadNote(parsed.lead)).toContain('utm_campaign: cleaning');
  });

  it('does not treat a qualified owner as a spot', () => {
    const parsed = parseCleaningLead({
      ...valid,
      monthlyRevenue: '$30K to $75K',
      adBudget: 'Yes',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lead.underRevenueFloor).toBe(false);
    expect(parsed.lead.budgetNotYet).toBe(false);
  });

  it('rejects a short phone and keeps the field name', () => {
    const parsed = parseCleaningLead({ ...valid, phone: '555' });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.field).toBe('phone');
  });
});

describe('cleaning copy', () => {
  it('pulls the editable settings into the promise', () => {
    const text = cleaningVisibleCopy();
    expect(text).toContain(String(cleaningSettings.firstCleans));
    expect(text).toContain(cleaningSettings.promiseWindow);
    expect(text).toContain(cleaningSettings.minimumAdBudget);
    expect(text).toContain(cleaningSettings.proofStat);
    expect(text).toContain(`$${cleaningSettings.feePerRecurringClient}`);
  });

  it('hides the pay row when the founding offer is off', () => {
    const rows = cleaningVisibleCopy({ ...cleaningSettings, foundingPartnerOffer: false });
    expect(rows).not.toContain('per new recurring client');
  });

  it('does not make banned claims', () => {
    const text = cleaningVisibleCopy().toLowerCase();
    for (const banned of ['24/7', 'instant', 'ready to book', 'jobber', 'housecall', 'servicetitan', 'skyrocket', 'guaranteed income']) {
      expect(text).not.toContain(banned);
    }
  });
});
