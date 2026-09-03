import { describe, expect, it } from 'vitest';
import { isAirtableBaseId, parseAirtableBaseId } from './cells';
import { STELLAR_MASTER_BASE_ID } from './config';
import {
  clientBaseWriteFields,
  conversionFrom,
  formatClosedWonLabel,
  formatProgramPrice,
  onboardCta,
  onboardPrefillFrom,
  onboardingWriteFields,
  paymentPaidWriteFields,
} from './conversion';
import { mapLeadRecord } from './map';
import { readOnboardToken, signOnboardToken } from './onboard-token';
import type { DebriefRecord, LeadRecord } from './types';

function leadFrom(fields: Record<string, unknown>, id = 'recbhuwRMsnk618TH'): LeadRecord {
  return mapLeadRecord({ id, fields });
}

function debrief(overrides: Partial<DebriefRecord> & { recordId: string }): DebriefRecord {
  return {
    title: '',
    callDate: '2026-09-03',
    callType: 'Discovery',
    owner: 'Malik',
    statedGoal: '',
    currentSituation: '',
    whatTheyTried: '',
    whyNow: '',
    outcome: '',
    objection: '',
    amountQuoted: null,
    decisionMakers: '',
    theirTimeline: '',
    agreedNextStep: '',
    nextStepDate: '',
    closeConfidence: null,
    dealRisk: '',
    recordingLink: '',
    transcript: '',
    leadIds: ['recbhuwRMsnk618TH'],
    complete: false,
    ...overrides,
  };
}

const closedWonComplete = debrief({
  recordId: 'recClosedWonDebrief0',
  callDate: '2026-09-03',
  outcome: 'Closed Won',
  amountQuoted: 18000,
  decisionMakers: 'Founder and spouse — spouse handles finances',
  currentSituation: 'Dedicated setter, inconsistent on nights and weekends',
  agreedNextStep: 'Send the agreement',
  dealRisk: 'Spouse was not on the call',
  complete: true,
});

describe('conversionFrom', () => {
  it('converts from a Closed Won debrief without waiting for Stage or kicking off onboarding', () => {
    const profile = {
      lead: leadFrom({
        'Lead Name': 'Jordan',
        Stage: 'Qualified - Not Booked',
        'Payment Status': 'Pending',
      }),
      debriefs: [closedWonComplete],
    };
    const conversion = conversionFrom(profile);
    expect(conversion.converted).toBe(true);
    expect(conversion.closedWonAt).toBe('2026-09-03');
    expect(conversion.paymentConfirmed).toBe(false);
    expect(onboardCta(conversion)).toEqual({
      kind: 'waiting-payment',
      closedWonAt: '2026-09-03',
    });
    expect(formatClosedWonLabel(conversion.closedWonAt)).toBe('Closed Won — 9/3');
  });

  it('treats a historical Stage = Closed Won lead as converted even without a debrief', () => {
    const conversion = conversionFrom({
      lead: leadFrom({
        'Lead Name': 'TEST - Closed Won (DM)',
        Stage: { name: 'Closed Won' },
        'Payment Status': { name: 'Paid' },
      }),
      debriefs: [],
    });
    expect(conversion.converted).toBe(true);
    expect(conversion.closedWonAt).toBeNull();
    expect(onboardCta(conversion).kind).toBe('start');
  });

  it('does not convert a Proposal Out debrief', () => {
    const conversion = conversionFrom({
      lead: leadFrom({ Stage: 'Audit Held' }),
      debriefs: [
        debrief({
          recordId: 'recProposal0000000',
          outcome: 'Proposal Out',
          agreedNextStep: 'Send the one-pager',
          dealRisk: 'DIY',
          complete: true,
        }),
      ],
    });
    expect(conversion.converted).toBe(false);
    expect(onboardCta(conversion).kind).toBe('none');
  });

  it('replaces Start Onboarding with the operating-base link once the base is recorded', () => {
    const conversion = conversionFrom({
      lead: leadFrom({
        Stage: 'Closed Won',
        'Payment Status': 'Paid',
        'Client Base ID': STELLAR_MASTER_BASE_ID,
        'Client Base Name': 'Northside Coaching — Stellar',
        'Client Base Created': '2026-09-04',
      }),
      debriefs: [closedWonComplete],
    });
    expect(onboardCta(conversion)).toEqual({
      kind: 'client-base',
      base: {
        id: STELLAR_MASTER_BASE_ID,
        name: 'Northside Coaching — Stellar',
        created: '2026-09-04',
      },
    });
  });
});

describe('onboardPrefillFrom', () => {
  it('prefills contact, follow-up, quote, decision makers, and lead volume; leaves install fields blank', () => {
    const prefill = onboardPrefillFrom({
      lead: leadFrom({
        'Lead Name': 'Jordan Blake',
        Email: 'jordan@example.com',
        Phone: '555-0100',
        'Company Name': 'Blake Coaching',
        'Follow-Up Owner': 'Dedicated setter',
        'Program Price': '$5k+',
        'Monthly Lead Volume': '50-150',
      }),
      debriefs: [closedWonComplete],
    });
    expect(prefill.businessName).toBe('Blake Coaching');
    expect(prefill.contactName).toBe('Jordan Blake');
    expect(prefill.email).toBe('jordan@example.com');
    expect(prefill.phone).toBe('555-0100');
    expect(prefill.followUpOwner).toBe('Dedicated setter');
    expect(prefill.followUpHow).toBe('Dedicated setter, inconsistent on nights and weekends');
    expect(prefill.programPrice).toBe('$18,000');
    expect(prefill.programPriceSource).toBe('quote');
    expect(prefill.decisionMakers).toBe('Founder and spouse — spouse handles finances');
    expect(prefill.monthlyLeadVolume).toBe('50-150');
    expect(prefill.crmAccess).toBe('');
    expect(prefill.adminLogins).toBe('');
    expect(prefill.databaseSize).toBe('');
    expect(prefill.trainingSchedule).toBe('');
  });

  it('uses the application Program Price when Amount Quoted is missing, and does not guess lead volume', () => {
    const prefill = onboardPrefillFrom({
      lead: leadFrom({
        'Company Name': 'Won Coaching',
        'Program Price': '$5k+',
        'Follow-Up Owner': 'Dedicated setter',
      }),
      debriefs: [
        debrief({
          recordId: 'recNoQuote00000000',
          outcome: 'Closed Won',
          agreedNextStep: 'Pay in Commas',
          dealRisk: 'None',
          complete: true,
        }),
      ],
    });
    expect(formatProgramPrice({ programPrice: '$5k+' }, { amountQuoted: 12000 }).value).toBe(
      '$12,000',
    );
    expect(prefill.programPrice).toBe('$5k+');
    expect(prefill.programPriceSource).toBe('application');
    expect(prefill.monthlyLeadVolume).toBe('');
    expect(prefill.decisionMakers).toBe('');
  });
});

describe('onboarding writes stay off the lead', () => {
  it('writes the install worksheet fields and the Lead link, never Stage or Payment Status', () => {
    const fields = onboardingWriteFields({
      leadId: 'recbhuwRMsnk618TH',
      leadName: 'Jordan Blake',
      submitted: '2026-09-04',
      businessName: 'Blake Coaching',
      contactName: 'Jordan Blake',
      email: 'jordan@example.com',
      phone: '555-0100',
      followUpOwner: 'Dedicated setter',
      followUpHow: 'Setter covers weekday hours',
      programPrice: '$18,000',
      programPriceSource: 'quote',
      decisionMakers: 'Founder',
      monthlyLeadVolume: '50-150',
      crmAccess: 'GoHighLevel, location Northside',
      adminLogins: '',
      databaseSize: '',
      trainingSchedule: 'Tuesdays 2pm ET',
    });
    expect(fields.Lead).toEqual(['recbhuwRMsnk618TH']);
    expect(fields['Business Name']).toBe('Blake Coaching');
    expect(fields['Program Price']).toBe('$18,000');
    expect(fields['CRM Access']).toBe('GoHighLevel, location Northside');
    expect(fields['Admin Logins']).toBeUndefined();
    expect(fields.Stage).toBeUndefined();
    expect(fields['Payment Status']).toBeUndefined();
    expect(fields['Client Base ID']).toBeUndefined();
    expect(fields.Notes).toBeUndefined();
  });

  it('records only the three client-base fields on the lead', () => {
    expect(
      clientBaseWriteFields({
        baseId: STELLAR_MASTER_BASE_ID,
        name: 'Northside Coaching — Stellar',
        created: '2026-09-04',
      }),
    ).toEqual({
      'Client Base ID': STELLAR_MASTER_BASE_ID,
      'Client Base Name': 'Northside Coaching — Stellar',
      'Client Base Created': '2026-09-04',
    });
    expect(paymentPaidWriteFields()).toEqual({ 'Payment Status': 'Paid' });
  });
});

describe('parseAirtableBaseId', () => {
  it('accepts a raw app id or an airtable.com URL', () => {
    expect(isAirtableBaseId(STELLAR_MASTER_BASE_ID)).toBe(true);
    expect(parseAirtableBaseId(STELLAR_MASTER_BASE_ID)).toBe(STELLAR_MASTER_BASE_ID);
    expect(parseAirtableBaseId(`https://airtable.com/${STELLAR_MASTER_BASE_ID}/tblxxx`)).toBe(
      STELLAR_MASTER_BASE_ID,
    );
    expect(parseAirtableBaseId('https://example.com/app0I1Krtkcg6SEfd')).toBeNull();
    expect(parseAirtableBaseId('recbhuwRMsnk618TH')).toBeNull();
  });
});

describe('onboard tokens', () => {
  it('round-trips a lead id and rejects a tampered signature', () => {
    const token = signOnboardToken('recbhuwRMsnk618TH', 'test-secret');
    expect(token.startsWith('recbhuwRMsnk618TH.')).toBe(true);
    expect(readOnboardToken(token, 'test-secret')).toBe('recbhuwRMsnk618TH');
    expect(readOnboardToken(`${token}x`, 'test-secret')).toBeNull();
    expect(readOnboardToken(token, 'other-secret')).toBeNull();
  });
});
