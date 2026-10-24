import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicationAlertEmail } from './application-email';
import { ghlContactNote, ghlWebhookBody } from './qualify';
import { GHL_FIELDS_TO_CREATE } from './niche-lead';
import { missedLeadCost } from './front-office-math';
import {
  SHARED_FRONT_OFFICE,
  frontOfficeFaqs,
  frontOfficeHeadlineVariant,
  frontOfficePriceFoot,
  headlineText,
} from './front-office-content';
import { parseFrontOfficeLead, withFrontOfficeTouch } from './front-office-lead';
import { submitLead } from './submit-lead';
import { AI_FRONT_OFFICE_KEY, AI_FRONT_OFFICE_OFFER, AI_FRONT_OFFICE_TAG } from '@/lib/ghl/tags';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const INDUSTRY_NAMES = [
  'hvac',
  'plumbing',
  'roofing',
  'remodel',
  'lawn',
  'pest',
  'cleaning',
  'med spa',
  'med-spa',
  'dental',
];

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => strings(item, out));
  }
  return out;
}

function pageCopy(content: typeof SHARED_FRONT_OFFICE): string {
  return [
    ...strings(content),
    ...frontOfficeFaqs(content).flatMap((item) => [item.question, item.answer]),
    frontOfficePriceFoot(content),
  ].join('\n');
}

const valid = {
  offerKey: AI_FRONT_OFFICE_KEY,
  fullName: 'Dana',
  email: 'dana@service.example',
  phone: '555-201-8890',
  companyName: 'Dana Service Co',
  businessType: 'Local service company',
  monthlyRevenue: '$50K to $100K',
  weeklyLeads: '10 to 25',
  biggestLeak: 'missed-calls',
  smsConsent: true,
  emailConsent: true,
  headlineVariant: 'c2' as const,
  tracking: {
    utm_source: 'facebook',
    utm_campaign: 'fall-audit',
    utm_content: 'c2-second-call',
    ad_id: '333',
  },
};

describe('AI Front Office page', () => {
  it('uses the shared copy and no industry names', () => {
    const visible = pageCopy(SHARED_FRONT_OFFICE);
    expect(SHARED_FRONT_OFFICE.pill).toBe('For local service owners doing $50K+/month');
    expect(headlineText(SHARED_FRONT_OFFICE.headlines.default)).toBe(
      'We Build The AI Front Office That Answers, Books And Follows Up On Every Lead (Live In 3 Weeks)',
    );
    expect(SHARED_FRONT_OFFICE.subhead).toContain('new leads');
    expect(SHARED_FRONT_OFFICE.leaks.map((card) => card.text)).toEqual([
      'Called 7:40 PM. Voicemail. Hired someone else by 8.',
      '$6,800 quote sent Tuesday. No follow-up.',
      '312 customers last year. 0 asked back this year.',
    ]);
    expect(SHARED_FRONT_OFFICE.buildItems.map((item) => item.title)).toEqual([
      'AI receptionist',
      'Speed-to-lead',
      'Quote follow-up',
      'Booking and reminders',
      'Reviews engine',
      'Reactivation',
      'Owner dashboard',
    ]);
    expect(SHARED_FRONT_OFFICE.finalCta.heading).toBe('Find out where your leads leak. Free.');
    expect(SHARED_FRONT_OFFICE.proof.text).toBe(
      'We run this same system in our own service business before we build it for anyone else.',
    );
    expect(SHARED_FRONT_OFFICE.form.businessLabel).toBe('What type of service business do you run?');
    expect(visible).not.toContain(EM_DASH);
    expect(visible).not.toContain(EN_DASH);
    expect(visible.toLowerCase()).not.toContain('guaranteed');
    for (const name of INDUSTRY_NAMES) expect(visible.toLowerCase()).not.toContain(name);
    expect(SHARED_FRONT_OFFICE.leaks.every((card) => card.example)).toBe(true);
    expect(SHARED_FRONT_OFFICE.proof.clientResult.enabled).toBe(false);
  });

  it('picks c1, c2, and c3 from the content parameter and defaults otherwise', () => {
    expect(frontOfficeHeadlineVariant('c1', undefined)).toBe('c1');
    expect(frontOfficeHeadlineVariant('c2-second-call', 'spring')).toBe('c2');
    expect(frontOfficeHeadlineVariant(undefined, 'C3')).toBe('c3');
    expect(frontOfficeHeadlineVariant(undefined, undefined)).toBe('default');
    expect(frontOfficeHeadlineVariant('spring-sale', 'brand')).toBe('default');
    expect(headlineText(SHARED_FRONT_OFFICE.headlines.c1)).toBe('Every Missed Call Is A Job Your Competitor Books');
    expect(headlineText(SHARED_FRONT_OFFICE.headlines.c2)).toBe('Every Quote You Sent Last Month Deserves A Second Call');
    expect(SHARED_FRONT_OFFICE.headlines.default.highlight).toBe('Answers, Books And Follows Up');
  });

  it('keeps the price line behind the setting', () => {
    expect(frontOfficeFaqs(SHARED_FRONT_OFFICE).find((item) => item.question === 'What does it cost?')?.answer).toContain(
      'Builds start at $7,000.',
    );
    expect(frontOfficePriceFoot(SHARED_FRONT_OFFICE)).toBe('Builds start at $7,000.');
    const hidden = frontOfficeFaqs({ ...SHARED_FRONT_OFFICE, showPrice: false });
    expect(hidden.find((item) => item.question === 'What does it cost?')?.answer).toBe(
      'Your exact scope and price come out of the blueprint.',
    );
    expect(hidden.map((item) => item.answer).join(' ')).not.toContain('$7,000');
    expect(frontOfficePriceFoot({ ...SHARED_FRONT_OFFICE, showPrice: false })).toBe('');
  });
});

describe('AI Front Office calculator', () => {
  it('turns $500, 10 missed a week, and 30 percent into about $6,450 a month', () => {
    expect(missedLeadCost(500, 10, 30)).toBe(6450);
  });

  it('does not save or send calculator input', () => {
    const source = readFileSync('app/acq/components/niche/LeakCalculator.tsx', 'utf8');
    expect(source).not.toMatch(/fetch\(|localStorage|sessionStorage|sendBeacon|XMLHttpRequest/);
  });
});

describe('AI Front Office lead', () => {
  it('qualifies $50K and up, and sends under $50K to the not-yet page', async () => {
    const low = await submitLead({ ...valid, monthlyRevenue: 'Under $50K' }, 'acq.divineacquisition.io');
    expect(low.ok).toBe(true);
    if (low.ok) {
      expect(low.redirectTo.startsWith('/ai/not-yet')).toBe(true);
      expect(low.pixel).toBe('UnqualifiedLead');
      expect(low.redirectTo).toContain('utm_content=c2-second-call');
    }

    const high = await submitLead(valid, 'acq.divineacquisition.io');
    expect(high.ok).toBe(true);
    if (high.ok) {
      expect(high.redirectTo.startsWith('/ai/not-yet')).toBe(false);
      expect(high.redirectTo.startsWith('/schedule/') || high.redirectTo.startsWith('/thank-you')).toBe(true);
      expect(high.pixel).toBe('Lead');
    }
  });

  it('stores the offer, business type, revenue, weekly leads, leak, headline, and ad name', async () => {
    const payload = parseFrontOfficeLead(valid);
    expect(payload.coachingNiche).toBe(AI_FRONT_OFFICE_OFFER);
    expect(payload.source).toBe(AI_FRONT_OFFICE_OFFER);
    expect(payload.niche).toBeUndefined();
    expect(payload.businessLabel).toBe('Local service company');
    expect(payload.monthlyRevenue).toBe('$50K to $100K');
    expect(payload.weeklyLeads).toBe('10 to 25');
    expect(payload.biggestLeak).toBe('Missed calls');
    expect(payload.headlineVariant).toBe('c2');
    expect(payload.tracking.utm_content).toBe('c2-second-call');
    expect(payload.tags).toContain(AI_FRONT_OFFICE_TAG);
    expect(payload.tags.some((tag) => tag.startsWith('niche -'))).toBe(false);
    expect(payload.nicheQualified).toBe(true);
    const touched = await withFrontOfficeTouch(payload);
    const body = ghlWebhookBody(touched);
    expect(body.offer).toBe(AI_FRONT_OFFICE_OFFER);
    expect(body.business_type).toBe('Local service company');
    expect(body.monthly_revenue).toBe('$50K to $100K');
    expect(body.weekly_leads).toBe('10 to 25');
    expect(body.biggest_leak).toBe('Missed calls');
    expect(body.headline_variant).toBe('c2');
    expect(body.ad_name || body.utm_content).toBe('c2-second-call');
    const note = ghlContactNote(touched);
    expect(note.startsWith(AI_FRONT_OFFICE_OFFER)).toBe(true);
    expect(note).toContain('Business: Local service company');
    expect(note).toContain('Monthly revenue: $50K to $100K');
    expect(note).toContain('Biggest leak: Missed calls');
    expect(note).toContain('Ad name: c2-second-call');
    expect(note).not.toContain('Lead Leak Audit');
    const mail = buildApplicationAlertEmail({ payload: touched });
    expect(mail.subject).toContain(AI_FRONT_OFFICE_OFFER);
    expect(mail.text).toContain(AI_FRONT_OFFICE_OFFER);
    expect(mail.text).toContain('Local service company');
    expect(GHL_FIELDS_TO_CREATE.map((field) => field.name)).toEqual(
      expect.arrayContaining([
        'DA - Headline Variant',
        'DA - Business Type',
        'DA - Monthly Revenue',
        'DA - Weekly Leads',
        'DA - Biggest Leak',
      ]),
    );
  });
});
