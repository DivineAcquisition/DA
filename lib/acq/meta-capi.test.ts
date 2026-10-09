import { describe, expect, it } from 'vitest';
import { fbcFromFbclid, hashEmail, hashName, hashPhone, roofingCapiBody, sha256 } from './meta-capi';

describe('roofing conversions api payload', () => {
  it('hashes email and phone and does not send the raw values', () => {
    const email = hashEmail(' Dana@Roof.Example ');
    const phone = hashPhone('(555) 201-8890');
    expect(email).toBe(sha256('dana@roof.example'));
    expect(phone).toBe(sha256('15552018890'));
    expect(hashName('Dana')).toBe(sha256('dana'));

    const body = roofingCapiBody(
      {
        eventName: 'Lead',
        eventId: 'evt-123',
        email: 'Dana@Roof.Example',
        phone: '5552018890',
        firstName: 'Dana',
        fbclid: 'click123',
        eventSourceUrl: 'https://acq.divineacquisition.io/roofing?utm_content=c1',
        customData: { content_name: 'Lead Leak Audit', content_category: 'roofing' },
      },
      new Date('2026-10-09T00:00:00Z'),
    );
    const event = (body.data as Array<Record<string, unknown>>)[0];
    const user = event.user_data as Record<string, string>;
    expect(event.event_name).toBe('Lead');
    expect(event.event_id).toBe('evt-123');
    expect(event.action_source).toBe('website');
    expect(JSON.stringify(body)).not.toContain('Dana@Roof.Example');
    expect(JSON.stringify(body)).not.toContain('5552018890');
    expect(user.em).toBe(email);
    expect(user.ph).toBe(phone);
    expect(user.fn).toBe(sha256('dana'));
    expect(user.fbc).toBe(fbcFromFbclid('click123', new Date('2026-10-09T00:00:00Z').getTime()));
  });

  it('drops source urls that are not this site', () => {
    const body = roofingCapiBody({
      eventName: 'PageView',
      eventId: 'evt-page',
      eventSourceUrl: 'https://evil.example/phish',
    });
    const event = (body.data as Array<Record<string, unknown>>)[0];
    expect(event.event_source_url).toBe('https://acq.divineacquisition.io/roofing');
  });
});
