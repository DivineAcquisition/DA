import { describe, expect, it } from 'vitest';
import { isCalOrigin, readCalIframeHeight } from './cal-embed';

describe('isCalOrigin', () => {
  it('accepts Cal.com hosts', () => {
    expect(isCalOrigin('https://app.cal.com')).toBe(true);
    expect(isCalOrigin('https://cal.com')).toBe(true);
    expect(isCalOrigin('https://embed.cal.com')).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isCalOrigin('https://acq.divineacquisition.io')).toBe(false);
    expect(isCalOrigin('not-a-url')).toBe(false);
  });
});

describe('readCalIframeHeight', () => {
  it('reads CustomEvent detail.data.iframeHeight', () => {
    expect(readCalIframeHeight({ detail: { data: { iframeHeight: 820.4 } } })).toBe(821);
  });

  it('reads postMessage arg.iframeHeight', () => {
    expect(readCalIframeHeight({ originator: 'CAL', method: '__dimensionChanged', arg: { iframeHeight: 640 } })).toBe(
      640,
    );
  });

  it('reads a flat iframeHeight or height field', () => {
    expect(readCalIframeHeight({ iframeHeight: 900 })).toBe(900);
    expect(readCalIframeHeight({ data: { height: 480 } })).toBe(480);
  });

  it('ignores missing or non-positive heights', () => {
    expect(readCalIframeHeight(null)).toBeNull();
    expect(readCalIframeHeight({ iframeHeight: 0 })).toBeNull();
    expect(readCalIframeHeight({ iframeHeight: '800' })).toBeNull();
  });
});
