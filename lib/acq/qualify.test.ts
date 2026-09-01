import { describe, expect, it } from 'vitest';
import {
  ACQ_CALENDAR_DEFAULT_EMBED_URL,
  ACQ_CALENDAR_EMBED_URL,
  ACQ_CAL_EMBED_SCRIPT,
  ACQ_CAL_LINK,
  ACQ_CAL_NAMESPACE,
  ACQ_META_PIXEL_ID,
  ACQ_PRECALL_PATH,
  ACQ_PRECALL_WISTIA_MEDIA_ID,
  ACQ_TYPEFORM_DEFAULT_URL,
  ACQ_TYPEFORM_URL,
  ACQ_WISTIA_MEDIA_ID,
  acqApplyUrl,
  acqBookUrl,
  acqPublicPath,
  qualificationThankYouPath,
  trackingFromSearchParams,
  withTrackingParams,
  withTrackingQuery,
} from './config';
import * as copy from './copy';
import {
  airtableFieldsFromPayload,
  followUpValueFromInput,
  ghlWebhookBody,
  isHoneypot,
  normalizeQualificationResult,
  parseQualification,
  qualificationResultTag,
  QualificationError,
} from './qualify';

const valid = {
  fullName: 'Jordan Blake',
  email: 'jordan@example.com',
  phone: '555-201-8890',
  companyName: 'Blake Coaching',
  adSpend: '$5k+',
  followUp: 'I do it myself',
  programPrice: '$2-5k',
  tracking: { utm_source: 'facebook', fbclid: 'abc.123' },
};

describe('parseQualification', () => {
  it('accepts a complete application and maps follow-up onto the Airtable value', () => {
    const payload = parseQualification(valid);

    expect(payload.firstName).toBe('Jordan');
    expect(payload.lastName).toBe('Blake');
    expect(payload.email).toBe('jordan@example.com');
    expect(payload.followUpOwner).toBe('Founder');
    expect(payload.followUpOwnerLabel).toBe('I do it myself');
    expect(payload.monthlyAdSpend).toBe('$5k+');
    expect(payload.programPrice).toBe('$2-5k');
    expect(payload.leadSource).toBe('Paid Ad');
    expect(payload.entryPoint).toBe('Audit Booking');
    expect(payload.stage).toBe('Step 1 Captured');
    expect(payload.tags).toContain('founding-install');
    expect(payload.tags).toContain('da-app-complete');
    expect(payload.tracking).toEqual({ utm_source: 'facebook', fbclid: 'abc.123' });
  });

  it('accepts the Airtable follow-up values as well as the form labels', () => {
    expect(followUpValueFromInput('Dedicated setter')).toBe('Dedicated setter');
    expect(followUpValueFromInput('Founder')).toBe('Founder');
    expect(followUpValueFromInput('Nobody, just automations')).toBe('Nobody');
    expect(followUpValueFromInput('Not sure')).toBe('Not sure');
  });

  it('rejects incomplete or invalid fields', () => {
    expect(() => parseQualification({ ...valid, fullName: 'A' })).toThrow(QualificationError);
    expect(() => parseQualification({ ...valid, email: 'not-an-email' })).toThrow(QualificationError);
    expect(() => parseQualification({ ...valid, phone: '12' })).toThrow(QualificationError);
    expect(() => parseQualification({ ...valid, adSpend: 'a lot' })).toThrow(QualificationError);
  });
});

describe('ghlWebhookBody', () => {
  it('emits both camelCase and snake_case keys for the existing Zap mapping', () => {
    const body = ghlWebhookBody(parseQualification(valid));
    expect(body.email).toBe('jordan@example.com');
    expect(body.follow_up_owner).toBe('Founder');
    expect(body.monthly_ad_spend).toBe('$5k+');
    expect(body.company_name).toBe('Blake Coaching');
    expect(body.utm_source).toBe('facebook');
    expect(body.fbclid).toBe('abc.123');
  });
});

describe('isHoneypot', () => {
  it('treats a filled website field as a bot', () => {
    expect(isHoneypot({ website: 'https://spam.test' })).toBe(true);
    expect(isHoneypot({ website: '   ' })).toBe(false);
    expect(isHoneypot({})).toBe(false);
  });
});

describe('qualificationThankYouPath', () => {
  it('uses the bare /thank-you path on the dedicated acq host', () => {
    expect(qualificationThankYouPath('acq.divineacquisition.io')).toBe('/thank-you');
    expect(qualificationThankYouPath('acq.divineacquisition.io:443')).toBe('/thank-you');
  });

  it('uses the prefixed path on localhost and previews', () => {
    expect(qualificationThankYouPath('localhost')).toBe('/acq/thank-you');
    expect(qualificationThankYouPath('divine-acq-123.vercel.app')).toBe('/acq/thank-you');
  });
});

describe('acqPublicPath', () => {
  it('uses the bare booking path on the dedicated acq host', () => {
    expect(acqPublicPath('/book', 'acq.divineacquisition.io')).toBe('/book');
  });

  it('prefixes the booking path on localhost and previews', () => {
    expect(acqPublicPath('/book', 'localhost')).toBe('/acq/book');
    expect(acqPublicPath('/book', 'divine-acq-123.vercel.app')).toBe('/acq/book');
  });

  it('uses the bare precall path on the dedicated acq host', () => {
    expect(acqPublicPath('/precall', 'acq.divineacquisition.io')).toBe('/precall');
  });

  it('prefixes the precall path on localhost and previews', () => {
    expect(acqPublicPath('/precall', 'localhost')).toBe('/acq/precall');
  });
});

describe('withTrackingQuery', () => {
  it('appends known ad params onto a relative path', () => {
    expect(
      withTrackingQuery('/acq/book', { utm_source: 'facebook', fbclid: 'abc.123' }),
    ).toBe('/acq/book?utm_source=facebook&fbclid=abc.123');
  });
});

describe('acqBookUrl', () => {
  it('sends landing CTA traffic to the GHL book page with ad params', () => {
    expect(acqBookUrl({ utm_source: 'facebook', fbclid: 'abc.123' }, 'acq.divineacquisition.io')).toBe(
      '/book?utm_source=facebook&fbclid=abc.123',
    );
    expect(acqBookUrl({ utm_source: 'facebook' }, 'localhost')).toBe('/acq/book?utm_source=facebook');
  });
});

describe('acqApplyUrl', () => {
  it('keeps the issued Typeform URL available with ad params', () => {
    expect(ACQ_TYPEFORM_URL).toBe('https://form.typeform.com/to/lvtP8G4E');
    expect(ACQ_TYPEFORM_DEFAULT_URL).toBe('https://form.typeform.com/to/lvtP8G4E');

    const url = new URL(acqApplyUrl({ utm_source: 'facebook', fbclid: 'abc.123' }));
    expect(`${url.origin}${url.pathname}`).toBe('https://form.typeform.com/to/lvtP8G4E');
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('fbclid')).toBe('abc.123');
  });
});

describe('trackingFromSearchParams', () => {
  it('keeps known ad params and drops everything else', () => {
    expect(
      trackingFromSearchParams({
        utm_campaign: 'founding',
        fbclid: ['first', 'second'],
        junk: 'drop',
      }),
    ).toEqual({ utm_campaign: 'founding', fbclid: 'first' });
  });
});

describe('withTrackingParams', () => {
  it('forwards known ad attribution params', () => {
    const result = withTrackingParams('https://acq.divineacquisition.io/thank-you', {
      utm_source: 'facebook',
      fbclid: 'abc.123',
      junk: 'drop-me',
    });
    const url = new URL(result);
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('fbclid')).toBe('abc.123');
    expect(url.searchParams.has('junk')).toBe(false);
  });
});

describe('founding landing media', () => {
  it('embeds the issued Wistia VSL', () => {
    expect(ACQ_WISTIA_MEDIA_ID).toBe('topebzrych');
  });

  it('embeds the issued precall Wistia briefing', () => {
    expect(ACQ_PRECALL_WISTIA_MEDIA_ID).toBe('pk21l05fbv');
    expect(ACQ_PRECALL_PATH).toBe('/precall');
  });

  it('ships the Meta Pixel on the acq landing', () => {
    expect(ACQ_META_PIXEL_ID).toBe('2779578425739507');
  });

  it('keeps the issued landing copy blocks', () => {
    expect(copy.HEADLINE).toBe(
      `${copy.HEADLINE_BEFORE}${copy.HEADLINE_ACCENT}${copy.HEADLINE_AFTER}`,
    );
    expect(copy.HEADLINE).not.toMatch(/[—–]/);
    expect(copy.HEADLINE_ACCENT).toBe('Completely Done For You In The Next 14 Days');
    expect(copy.HEADLINE).toContain('To Increase Show Rate');
    expect(copy.INCLUDED).toHaveLength(7);
    expect(copy.INCLUDED[0].title).toBe('Lead intake and scoring');
    expect(copy.FOUNDING_OFFER.lead).toBe('Three founding seats.');
    expect(copy.SUBHEADLINE.toLowerCase()).not.toContain('case study');
    expect(copy.PILL_BANNER).toBe('Sales operations for coaching & consulting');
    expect(copy.CTA_LABEL).toBe('Book a free audit');
    expect(copy.THANK_YOU.title).toBe("Thanks. You're in. Grab a time below.");
    expect(copy.THANK_YOU.title).not.toMatch(/[—–]/);
    expect(copy.BOOK_PAGE.title).toBe('Book your free sales audit');
    expect(copy.BOOK_PAGE.title).toBe(
      `${copy.BOOK_PAGE.titleBefore}${copy.BOOK_PAGE.titleAccent}`,
    );
    expect(copy.BOOK_PAGE.eyebrow.toLowerCase()).toContain('free');
    expect(copy.BOOK_PAGE.body.toLowerCase()).toContain('free');
    expect(copy.PRECALL.title).toBe('Your Free Sales Audit Has Been Confirmed');
    expect(copy.PRECALL.title).toBe(`${copy.PRECALL.titleBefore}${copy.PRECALL.titleAccent}`);
    expect(copy.PRECALL.title).not.toMatch(/[—–]/);
    expect(copy.PRECALL.body).not.toMatch(/[—–]/);
    expect(copy.PRECALL.stepsEyebrow).toBe('What To Expect');
    expect(copy.PRECALL.stepsTitle).toBe('Here Are Your Next Steps After Booking A Call');
    expect(copy.PRECALL.steps).toHaveLength(3);
    expect(copy.PRECALL.steps[0].label.toLowerCase()).toContain('email');
    expect(copy.PRECALL.steps[2].label.toLowerCase()).toContain('self-educate');
  });

  it('embeds the issued Cal.com event on /book', () => {
    expect(ACQ_CAL_LINK).toBe('malik-sannie-zztskt/30min');
    expect(ACQ_CAL_NAMESPACE).toBe('30min');
    expect(ACQ_CAL_EMBED_SCRIPT).toBe('https://app.cal.com/embed/embed.js');
  });

  it('defaults the thank-you booking calendar to the issued GHL widget', () => {
    expect(ACQ_CALENDAR_DEFAULT_EMBED_URL).toContain('v0e24e3kxYEGCTUkSP4A');
    expect(ACQ_CALENDAR_EMBED_URL).toContain('widget/booking');
  });
});

describe('qualification scoring helpers', () => {
  it('maps Airtable results onto GHL tags', () => {
    expect(qualificationResultTag('Qualified')).toBe('da-qualified');
    expect(qualificationResultTag('Manual Review')).toBe('da-manual-review');
    expect(qualificationResultTag('Disqualified')).toBe('da-disqualified');
    expect(normalizeQualificationResult(' manual-review ')).toBe('Manual Review');
    expect(normalizeQualificationResult('nope')).toBeNull();
  });

  it('writes the Leads table fields from a qualification payload', () => {
    const fields = airtableFieldsFromPayload(parseQualification(valid), {
      ghlContactId: 'ghl_123',
      today: '2026-08-23',
      entryPoint: 'Audit Booking',
    });

    expect(fields['Lead Name']).toBe('Jordan Blake');
    expect(fields.Email).toBe('jordan@example.com');
    expect(fields['Company Name']).toBe('Blake Coaching');
    expect(fields['Monthly Ad Spend']).toBe('$5k+');
    expect(fields['Follow-Up Owner']).toBe('Founder');
    expect(fields['Program Price']).toBe('$2-5k');
    expect(fields['Lead Source']).toBe('Paid Ad');
    expect(fields['Entry Point']).toBe('Audit Booking');
    expect(fields['Opt-In Date']).toBe('2026-08-23');
    expect(fields.Campaign).toBe('Landing Page');
    expect(fields['GHL Contact ID']).toBe('ghl_123');
  });
});
