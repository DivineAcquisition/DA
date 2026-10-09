import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REMODELING_DRAFT,
  ROOFING,
  offerFoot,
  renderedFaqs,
  renderedOffer,
  renderedSteps,
  spendQualifies,
} from './niche-content';
import { GHL_FIELDS_TO_CREATE, parseRoofingLead } from './niche-lead';
import { ghlContactNote, ghlWebhookBody } from './qualify';
import { headlineVariantFromUtm } from './niche-tracking';
import { submitLead } from './submit-lead';

const FORBIDDEN = [
  '42 hours',
  '21x',
  '100x',
  '78%',
  'fifth contact',
  'guaranteed results',
  'guaranteed jobs',
  'guaranteed revenue',
  'show rate',
  'sales operations',
  '\u2014',
  '\u2013',
];

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => strings(item, out));
  }
  return out;
}

const valid = {
  niche: 'roofing',
  fullName: 'Dana',
  email: 'dana@roof.example',
  phone: '555-201-8890',
  companyName: 'Dana Roofing',
  spendBand: '$2,000 to $5,000',
  smsConsent: true,
  emailConsent: true,
  headlineVariant: 'c2',
  tracking: {
    utm_source: 'facebook',
    utm_medium: 'paid',
    utm_campaign: 'roof-audit',
    utm_term: 'roof',
    utm_content: 'roof-c2-cost',
    placement: 'feed',
    campaign_id: '111',
    adset_id: '222',
    ad_id: '333',
    fbclid: 'fb.1',
  },
};

describe('headline variants', () => {
  it('uses the default when utm_content is missing or unknown', () => {
    expect(headlineVariantFromUtm(undefined)).toBe('default');
    expect(headlineVariantFromUtm('')).toBe('default');
    expect(headlineVariantFromUtm('spring-sale')).toBe('default');
  });

  it('matches the start, ignoring capitals, and a segment such as roof-c1', () => {
    expect(headlineVariantFromUtm('C1')).toBe('c1');
    expect(headlineVariantFromUtm('c1-first-to-call')).toBe('c1');
    expect(headlineVariantFromUtm('roof-c1-first-to-call')).toBe('c1');
    expect(headlineVariantFromUtm('ROOF-C2-COST')).toBe('c2');
    expect(headlineVariantFromUtm('c3')).toBe('c3');
    expect(headlineVariantFromUtm('myc1')).toBe('default');
  });
});

describe('roofing copy rules', () => {
  it('keeps the supplied claims and leaves quotes and the delivery promise off', () => {
    expect(ROOFING.published).toBe(true);
    expect(ROOFING.quotes.enabled).toBe(false);
    expect(ROOFING.quotes.items).toEqual([]);
    expect(ROOFING.video.enabled).toBe(false);
    expect(ROOFING.video.url).toBe('');
    expect(ROOFING.deliveryCommitment.enabled).toBe(false);
    expect(ROOFING.qualificationCutoff).toBe(2000);
    expect(ROOFING.stats.map((stat) => stat.value)).toEqual(['$107', '$228', '74%', '$17,631']);
    const visible = [
      ...strings(ROOFING),
      ...renderedFaqs(ROOFING).map((item) => item.answer),
      offerFoot(ROOFING),
    ].join('\n');
    for (const phrase of FORBIDDEN) expect(visible.toLowerCase()).not.toContain(phrase.toLowerCase());
    expect(renderedFaqs(ROOFING).find((item) => item.question.startsWith('Do you guarantee'))?.answer).not.toContain(
      "you don't pay",
    );
  });

  it('turns the delivery line on only when the setting is on', () => {
    const on = renderedFaqs({
      ...ROOFING,
      deliveryCommitment: { ...ROOFING.deliveryCommitment, enabled: true },
    });
    expect(on.find((item) => item.question.startsWith('Do you guarantee'))?.answer).toContain(
      ROOFING.deliveryCommitment.line,
    );
  });

  it('reads the price, time, and weekly review settings', () => {
    expect(renderedFaqs(ROOFING).find((item) => item.question === 'What does it cost?')?.answer).toContain(
      ROOFING.priceLine,
    );
    expect(offerFoot({ ...ROOFING, offer: { ...ROOFING.offer, timeEstimate: 'about two hours' } })).toContain(
      'about two hours',
    );
    expect(renderedSteps({ ...ROOFING, weeklyReview: 'Changed review.' })[2]?.body).toBe('Changed review.');
    expect(
      renderedOffer({ ...ROOFING, offer: { ...ROOFING.offer, weeklyReviewBullet: 'A weekly 20-minute review.' } })[3]
        ?.bullets.at(-1),
    ).toBe('A weekly 20-minute review.');
  });
});

describe('remodeling draft', () => {
  it('stores the supplied draft and does not publish a route', () => {
    expect(REMODELING_DRAFT.published).toBe(false);
    expect(REMODELING_DRAFT.pill).toBe('For remodeling companies running ads');
    expect(REMODELING_DRAFT.stats.map((stat) => stat.value)).toEqual(['$104', '$518B', 'More than 80%']);
    expect(REMODELING_DRAFT.problem.places[1]?.title).toBe('The quote you sent three weeks ago.');
    expect(REMODELING_DRAFT.headlines.default).toContain('Without Hiring A Salesperson');
    expect(existsSync('app/acq/remodeling/page.tsx')).toBe(false);
    expect(existsSync('app/remodeling/page.tsx')).toBe(false);
  });
});

describe('roofing lead payload', () => {
  it('qualifies spend at or above the cutoff and keeps the band that is under it', () => {
    expect(spendQualifies(ROOFING.form.options[0]!, ROOFING.qualificationCutoff)).toBe(false);
    expect(spendQualifies(ROOFING.form.options[1]!, ROOFING.qualificationCutoff)).toBe(true);
    const low = parseRoofingLead({ ...valid, spendBand: 'Under $2,000', headlineVariant: 'default' });
    expect(low.nicheQualified).toBe(false);
    expect(low.tags).toContain('qualified-no');
    expect(low.tags).toContain('niche-roofing');
    expect(low.monthlyAdSpend).toBe('');
  });

  it('sends niche, spend, headline, and ad params on the webhook and the contact note', () => {
    const payload = parseRoofingLead(valid);
    expect(payload.nicheQualified).toBe(true);
    expect(payload.headlineVariant).toBe('c2');
    expect(payload.coachingNiche).toBe('Roofing');
    const body = ghlWebhookBody(payload);
    expect(body.niche).toBe('roofing');
    expect(body.spend_band).toBe('$2,000 to $5,000');
    expect(body.qualified).toBe('yes');
    expect(body.headline_variant).toBe('c2');
    expect(body.utm_content).toBe('roof-c2-cost');
    expect(body.placement).toBe('feed');
    expect(body.campaign_id).toBe('111');
    expect(body.adset_id).toBe('222');
    expect(body.ad_id).toBe('333');
    expect(body.fbclid).toBe('fb.1');
    const note = ghlContactNote(payload);
    expect(note).toContain('Spend band: $2,000 to $5,000');
    expect(note).toContain('Qualified: yes');
    expect(note).toContain('Headline: c2');
    expect(note).toContain('placement: feed');
    expect(GHL_FIELDS_TO_CREATE.map((field) => field.name)).toEqual([
      'DA - Niche',
      'DA - Spend Band',
      'DA - Qualified',
      'DA - Headline Variant',
      'DA - UTM Source',
      'DA - UTM Medium',
      'DA - UTM Campaign',
      'DA - UTM Term',
      'DA - UTM Content',
      'DA - Placement',
      'DA - Campaign ID',
      'DA - Ad Set ID',
      'DA - Ad ID',
    ]);
  });

  it('routes under $2,000 to not-yet and everyone else toward booking', async () => {
    const low = await submitLead({ ...valid, spendBand: 'Under $2,000' }, 'localhost');
    expect(low.ok).toBe(true);
    if (low.ok) {
      expect(low.redirectTo.startsWith('/acq/roofing/not-yet')).toBe(true);
      expect(low.redirectTo).toContain('utm_content=roof-c2-cost');
      expect(low.redirectTo).toContain('ad_id=333');
      expect(low.pixel).toBe('UnqualifiedLead');
    }

    const high = await submitLead(valid, 'acq.divineacquisition.io');
    expect(high.ok).toBe(true);
    if (high.ok) {
      expect(high.redirectTo.startsWith('/roofing/not-yet')).toBe(false);
      expect(high.pixel).toBe('Lead');
      expect(high.redirectTo).toContain('placement=feed');
    }
  });

  it('rejects a bad phone without dropping the other fields from the error', async () => {
    const result = await submitLead({ ...valid, phone: '12' }, 'localhost');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('phone');
  });
});
