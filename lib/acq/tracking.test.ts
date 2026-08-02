import { describe, expect, it } from 'vitest';
import { withTrackingParams } from './config';

describe('withTrackingParams', () => {
  it('forwards known ad attribution params into the booking URL', () => {
    const params = new URLSearchParams({
      utm_source: 'facebook',
      utm_campaign: 'pilot',
      fbclid: 'abc.123',
      junk: 'drop-me',
    });

    const result = withTrackingParams(
      'https://form.typeform.com/to/lvtP8G4E?typeform-source=divineacquisition.io',
      params,
    );
    const url = new URL(result);

    expect(url.searchParams.get('typeform-source')).toBe('divineacquisition.io');
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('utm_campaign')).toBe('pilot');
    expect(url.searchParams.get('fbclid')).toBe('abc.123');
    expect(url.searchParams.has('junk')).toBe(false);
  });

  it('preserves existing booking query params', () => {
    const result = withTrackingParams(
      'https://form.typeform.com/to/lvtP8G4E?typeform-source=divineacquisition.io',
      { utm_medium: 'cpc' },
    );
    const url = new URL(result);

    expect(url.searchParams.get('typeform-source')).toBe('divineacquisition.io');
    expect(url.searchParams.get('utm_medium')).toBe('cpc');
  });
});
