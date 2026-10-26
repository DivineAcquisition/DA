import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { acqCapiBody } from './meta-capi';
import { REVENUE_LEAK, REVENUE_LEAK_NOINDEX, REVENUE_LEAK_TESTIMONIALS } from './revenue-leak-content';
import { REVENUE_LEAK_META_PIXEL_ID, revenueLeakEmbedUrl, vslEmbed } from './revenue-leak';

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => strings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => strings(item, out));
  return out;
}

describe('revenue leak audit copy', () => {
  const copy = strings(REVENUE_LEAK);

  it('keeps the page out of search while it is being tested', () => {
    expect(REVENUE_LEAK_NOINDEX).toBe(true);
    expect(REVENUE_LEAK.noindex).toBe(true);
  });

  it('hides results until real testimonials are pasted in', () => {
    expect(REVENUE_LEAK_TESTIMONIALS).toEqual([]);
  });

  it('embeds the AI operations audit calendar and the ads pixel', () => {
    expect(REVENUE_LEAK.booking.url).toBe(
      'https://app.iclosed.io/e/divineacquisitionn/ai-operations-audit',
    );
    expect(REVENUE_LEAK.booking.widgetTitle).toBe('DivineACQ™ Operation Audit');
    expect(REVENUE_LEAK_META_PIXEL_ID).toBe('658113660313482');
  });

  it('does not use an em dash or the dropped missed-call statistic', () => {
    for (const line of copy) {
      expect(line).not.toMatch(/[\u2014\u2013]/);
      expect(line).not.toContain('62%');
    }
  });

  it('names the published sources and keeps prices off the packages', () => {
    const sources = REVENUE_LEAK.sources.join(' ');
    expect(sources).toContain('Invoca 2026');
    expect(sources).toContain('Invoca 2024');
    expect(sources).toContain('CallRail');
    expect(sources).toContain('ServiceTitan');
    expect(sources).toContain('Hatch 2024');
    expect(sources).toContain('SearchLight Digital');
    expect(REVENUE_LEAK.pipeline.steps).toHaveLength(7);
    expect(REVENUE_LEAK.faq.items).toHaveLength(7);
    expect(REVENUE_LEAK.packages.guarantee).toBe('');
    for (const item of REVENUE_LEAK.packages.items) {
      expect(JSON.stringify(item)).not.toContain('$');
    }
  });

  it('is allowed on the acq host', () => {
    const proxy = readFileSync('proxy.ts', 'utf8');
    expect(proxy).toContain("pathname === '/leak'");
    expect(proxy).toContain("pathname === '/api/meta/acq-capi'");
    expect(readFileSync('app/acq/leak/page.tsx', 'utf8')).toContain('LeakLanding');
    expect(readFileSync('app/acq/leak/not-yet/page.tsx', 'utf8')).toContain('notYet');
  });
});

describe('revenue leak tracking urls', () => {
  it('forwards ad ids into the booking embed', () => {
    const src = revenueLeakEmbedUrl(
      'https://app.iclosed.io/e/example/audit',
      { utm_source: 'facebook', utm_campaign: 'leak', fbclid: 'click-1' },
      { fbp: 'fb.1.1', fbc: 'fb.1.2.click-1' },
    );
    const url = new URL(src);
    expect(url.searchParams.get('utm_source')).toBe('facebook');
    expect(url.searchParams.get('utm_campaign')).toBe('leak');
    expect(url.searchParams.get('fbclid')).toBe('click-1');
    expect(url.searchParams.get('fbp')).toBe('fb.1.1');
    expect(url.searchParams.get('fbc')).toBe('fb.1.2.click-1');
  });

  it('turns a pasted video link into an embed and ignores junk', () => {
    expect(vslEmbed('')).toEqual({ kind: 'empty' });
    expect(vslEmbed('https://www.youtube.com/watch?v=abcdefghijk')).toMatchObject({ kind: 'iframe' });
    expect(vslEmbed('topebzrych')).toMatchObject({
      kind: 'iframe',
      src: expect.stringContaining('topebzrych'),
    });
    expect(vslEmbed('javascript:alert(1)')).toEqual({ kind: 'empty' });
  });

  it('sends booking events at the leak page when the source url is unusable', () => {
    const body = acqCapiBody({
      eventName: 'Schedule',
      eventId: 'evt-leak-1',
      eventSourceUrl: 'https://evil.example/phish',
      fbclid: 'click-1',
    });
    const event = (body.data as Array<Record<string, unknown>>)[0];
    expect(event.event_name).toBe('Schedule');
    expect(event.event_source_url).toBe('https://acq.divineacquisition.io/leak');
    expect(JSON.stringify(body)).not.toContain('evil.example');
  });
});
