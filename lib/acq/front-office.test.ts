import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildApplicationAlertEmail } from './application-email';
import { ghlContactNote, ghlWebhookBody } from './qualify';
import { GHL_FIELDS_TO_CREATE } from './niche-lead';
import { missedLeadCost } from './front-office-math';
import {
  FRONT_OFFICE_NICHES,
  SHARED_FRONT_OFFICE,
  frontOfficeFaqs,
  frontOfficeHeadlineVariant,
  frontOfficePriceFoot,
  headlineText,
  resolveFrontOffice,
  type FrontOfficeContent,
} from './front-office-content';
import { parseFrontOfficeLead, withFrontOfficeTouch } from './front-office-lead';
import { submitLead } from './submit-lead';
import { AI_FRONT_OFFICE_KEY, AI_FRONT_OFFICE_OFFER, AI_FRONT_OFFICE_TAG } from '@/lib/ghl/tags';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => strings(item, out));
  }
  return out;
}

function pageCopy(content: FrontOfficeContent): string {
  return [
    ...strings(content),
    ...frontOfficeFaqs(content).flatMap((item) => [item.question, item.answer]),
    frontOfficePriceFoot(content),
  ].join('\n');
}

const valid = {
  offerKey: AI_FRONT_OFFICE_KEY,
  niche: 'hvac',
  fullName: 'Dana',
  email: 'dana@hvac.example',
  phone: '555-201-8890',
  companyName: 'Dana HVAC',
  businessType: 'hvac',
  monthlyRevenue: '$50K to $100K',
  weeklyLeads: '10 to 25',
  biggestLeak: 'missed-calls',
  smsConsent: true,
  emailConsent: true,
  headlineVariant: 'c2' as const,
  tracking: {
    utm_source: 'facebook',
    utm_campaign: 'fall-audit',
    utm_content: 'hvac-c2-second-call',
    ad_id: '333',
  },
};

describe('AI Front Office pages', () => {
  it('renders shared words and each published niche with its own words', () => {
    expect(SHARED_FRONT_OFFICE.pill).toContain('home service and med spa');
    expect(headlineText(SHARED_FRONT_OFFICE.headlines.default)).toContain('Every Lead');
    expect(SHARED_FRONT_OFFICE.subhead).toContain('new leads');
    expect(SHARED_FRONT_OFFICE.leaks[1]?.text).toContain('$8,400 quote');
    expect(SHARED_FRONT_OFFICE.buildItems[2]?.title).toBe('Quote follow-up');
    expect(frontOfficeFaqs(SHARED_FRONT_OFFICE).find((item) => item.question === 'Do you run ads?')?.answer).toContain(
      'booked jobs',
    );
    expect(SHARED_FRONT_OFFICE.finalCta.heading).toContain('your leads leak');

    const hvac = resolveFrontOffice('hvac').content;
    expect(hvac.pill).toContain('HVAC');
    expect(hvac.subhead).toContain('service calls');
    expect(hvac.leaks[0]?.text).toContain('AC out');
    expect(hvac.buildItems[6]?.text).toContain('booked job');

    const plumbing = resolveFrontOffice('plumbing').content;
    expect(plumbing.words.lead).toBe(hvac.words.lead);
    expect(plumbing.words.quote).toBe('estimate');
    expect(plumbing.pill).toContain('plumbing');

    const roofing = resolveFrontOffice('roofing').content;
    expect(roofing.subhead).toContain('estimate requests');
    expect(roofing.leaks[1]?.text).toContain('$18,500 estimate');
    expect(roofing.form.leakLabel).toContain('projects');

    const remodeling = resolveFrontOffice('remodeling').content;
    expect(remodeling.leaks[1]?.text).toContain('$18,500 proposal');
    expect(remodeling.buildItems[2]?.title).toBe('Proposal follow-up');

    for (const id of ['lawn-care', 'pest-control', 'cleaning']) {
      const niche = resolveFrontOffice(id).content;
      expect(niche.subhead).toContain('quote requests');
      expect(niche.subhead).toContain('booked recurring customer');
      expect(niche.leaks[2]?.text).toContain('210 one-time customers');
      expect(niche.fit.text).toContain('quote requests come in every week');
    }

    const medSpa = resolveFrontOffice('med-spa').content;
    expect(medSpa.pill).toContain('med spa');
    expect(medSpa.subhead).toContain('consult requests');
    expect(medSpa.leaks[1]?.text).toContain('Treatment plan presented');
    expect(medSpa.buildItems[6]?.text).toContain('booked patient');
    expect(medSpa.finalCta.heading).toContain('consult requests');
    expect(FRONT_OFFICE_NICHES.every((item) => item.published)).toBe(true);
  });

  it('falls back to the shared page for an unknown or unpublished niche', () => {
    expect(resolveFrontOffice('dental')).toEqual({ content: SHARED_FRONT_OFFICE, fallback: true });
    expect(resolveFrontOffice(undefined).fallback).toBe(false);
    const draft = FRONT_OFFICE_NICHES.map((item) =>
      item.id === 'remodeling' ? { ...item, published: false } : item,
    );
    const resolved = resolveFrontOffice('remodeling', draft);
    expect(resolved.fallback).toBe(true);
    expect(resolved.content.pill).toContain('home service and med spa');
  });

  it('picks c1, c2, and c3 from the content parameter and defaults otherwise', () => {
    expect(frontOfficeHeadlineVariant('c1', undefined)).toBe('c1');
    expect(frontOfficeHeadlineVariant('c2-second-call', 'spring')).toBe('c2');
    expect(frontOfficeHeadlineVariant(undefined, 'C3')).toBe('c3');
    expect(frontOfficeHeadlineVariant(undefined, undefined)).toBe('default');
    expect(frontOfficeHeadlineVariant('spring-sale', 'brand')).toBe('default');
    expect(headlineText(SHARED_FRONT_OFFICE.headlines.c1)).toBe('Every Missed Call Is A Job Your Competitor Books');
    expect(headlineText(resolveFrontOffice('hvac').content.headlines.c2)).toContain('Every Estimate');
    expect(SHARED_FRONT_OFFICE.headlines.default.highlight).toBe('Answers, Books And Follows Up');
  });

  it('labels every example card and keeps price behind the setting', () => {
    for (const content of [SHARED_FRONT_OFFICE, ...FRONT_OFFICE_NICHES]) {
      expect(content.leaks.every((card) => card.example)).toBe(true);
      expect(content.exampleLabel).toBe('Example');
      const visible = pageCopy(content);
      expect(visible).not.toContain(EM_DASH);
      expect(visible).not.toContain(EN_DASH);
      expect(visible.toLowerCase()).not.toContain('guaranteed');
      expect(content.proof.clientResult.enabled).toBe(false);
      expect(content.proof.clientResult.text).toBe('');
    }
    expect(SHARED_FRONT_OFFICE.proof.text).toBe(
      'We run this same system in our own cleaning business before we build it for anyone else.',
    );
    const price = frontOfficeFaqs(SHARED_FRONT_OFFICE).find((item) => item.question === 'What does it cost?');
    expect(price?.answer).toContain('Builds start at $7,000.');
    expect(frontOfficePriceFoot(SHARED_FRONT_OFFICE)).toBe('Builds start at $7,000.');
    const hidden = frontOfficeFaqs({ ...SHARED_FRONT_OFFICE, showPrice: false });
    expect(hidden.find((item) => item.question === 'What does it cost?')?.answer).toBe(
      'Your exact scope and price come out of the blueprint.',
    );
    expect(hidden.map((item) => item.answer).join(' ')).not.toContain('$7,000');
    expect(frontOfficePriceFoot({ ...SHARED_FRONT_OFFICE, showPrice: false })).toBe('');
  });

  it('keeps the med spa form off health, treatment intake, and patient details', () => {
    const medSpa = resolveFrontOffice('med-spa').content;
    const formText = strings(medSpa.form).join('\n');
    expect(formText).not.toMatch(/symptom|diagnosis|medication|hipaa|condition|botox|filler|patient history|health/i);
    expect(medSpa.form.businesses.map((item) => item.label)).toContain('Med spa');
    expect(medSpa.form.leakOptions.map((item) => item.label)).toContain('Past customers never return');
    expect(Object.keys(medSpa.form)).not.toContain('treatment');
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
    const low = await submitLead({ ...valid, monthlyRevenue: 'Under $50K' }, 'localhost');
    expect(low.ok).toBe(true);
    if (low.ok) {
      expect(low.redirectTo.startsWith('/acq/ai/not-yet')).toBe(true);
      expect(low.pixel).toBe('UnqualifiedLead');
      expect(low.redirectTo).toContain('utm_content=hvac-c2-second-call');
    }

    const high = await submitLead(valid, 'acq.divineacquisition.io');
    expect(high.ok).toBe(true);
    if (high.ok) {
      expect(high.redirectTo.startsWith('/ai/not-yet')).toBe(false);
      expect(high.pixel).toBe('Lead');
    }
  });

  it('stores the offer, niche, revenue, weekly leads, leak, headline, and ad name', async () => {
    const payload = parseFrontOfficeLead(valid);
    expect(payload.coachingNiche).toBe(AI_FRONT_OFFICE_OFFER);
    expect(payload.source).toBe(AI_FRONT_OFFICE_OFFER);
    expect(payload.niche).toBe('hvac');
    expect(payload.monthlyRevenue).toBe('$50K to $100K');
    expect(payload.weeklyLeads).toBe('10 to 25');
    expect(payload.biggestLeak).toBe('Missed calls');
    expect(payload.headlineVariant).toBe('c2');
    expect(payload.tracking.utm_content).toBe('hvac-c2-second-call');
    expect(payload.tags).toContain(AI_FRONT_OFFICE_TAG);
    expect(payload.tags).toContain('niche - hvac');
    expect(payload.tags).toContain('ad - headline c2');
    expect(payload.nicheQualified).toBe(true);
    const touched = await withFrontOfficeTouch(payload);
    const body = ghlWebhookBody(touched);
    expect(body.offer).toBe(AI_FRONT_OFFICE_OFFER);
    expect(body.monthly_revenue).toBe('$50K to $100K');
    expect(body.weekly_leads).toBe('10 to 25');
    expect(body.biggest_leak).toBe('Missed calls');
    expect(body.headline_variant).toBe('c2');
    expect(body.ad_name || body.utm_content).toBe('hvac-c2-second-call');
    const note = ghlContactNote(touched);
    expect(note.startsWith(AI_FRONT_OFFICE_OFFER)).toBe(true);
    expect(note).toContain('Monthly revenue: $50K to $100K');
    expect(note).toContain('Weekly leads: 10 to 25');
    expect(note).toContain('Biggest leak: Missed calls');
    expect(note).toContain('Headline: c2');
    expect(note).toContain('Ad name: hvac-c2-second-call');
    expect(note).not.toContain('Lead Leak Audit');
    const mail = buildApplicationAlertEmail({ payload: touched });
    expect(mail.subject).toContain(AI_FRONT_OFFICE_OFFER);
    expect(mail.text).toContain(AI_FRONT_OFFICE_OFFER);
    expect(mail.text).toContain('Monthly revenue: $50K to $100K');
    expect(GHL_FIELDS_TO_CREATE.map((field) => field.name)).toEqual(
      expect.arrayContaining(['DA - Niche', 'DA - Headline Variant', 'DA - Monthly Revenue', 'DA - Weekly Leads', 'DA - Biggest Leak']),
    );
  });

  it('does not send a roofing AI application through the Lead Leak Audit parser', async () => {
    const result = await submitLead(
      { ...valid, businessType: 'roofing', niche: 'roofing', weeklyLeads: '25 to 50' },
      'localhost',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectTo).not.toContain('/roofing/not-yet');
      expect(result.pixel).toBe('Lead');
    }
  });
});
