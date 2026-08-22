import { describe, expect, it } from 'vitest';
import { qualificationThankYouPath, trackingFromSearchParams, withTrackingParams } from './config';
import {
  followUpValueFromInput,
  ghlWebhookBody,
  isHoneypot,
  parseQualification,
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
