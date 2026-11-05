import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The proxy reads host lists when it loads, so each case loads it fresh. */
async function loadProxy(siteHosts?: string) {
  vi.resetModules();
  if (siteHosts !== undefined) vi.stubEnv('DA_SITE_HOSTS', siteHosts);
  return (await import('../proxy')).proxy;
}

const get = (url: string) => new NextRequest(url, { headers: { host: new URL(url).host } });

describe('company homepage host', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves the apex on the careers board until DA_SITE_HOSTS is set', async () => {
    const proxy = await loadProxy();
    const home = await proxy(get('https://divineacquisition.io/'));
    expect(home.headers.get('x-middleware-rewrite') ?? '').not.toContain('/site');
    const hidden = await proxy(get('https://divineacquisition.io/site'));
    expect(hidden.status).toBe(404);
  });

  it('serves the homepage on the apex once DA_SITE_HOSTS names it', async () => {
    const proxy = await loadProxy('divineacquisition.io,www.divineacquisition.io');
    const home = await proxy(get('https://divineacquisition.io/'));
    expect(home.status).not.toBe(404);
    expect(home.headers.get('x-middleware-rewrite') ?? '').toContain('/site');
    expect(home.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('keeps other surfaces off the homepage host', async () => {
    const proxy = await loadProxy('divineacquisition.io');
    const foreign = await proxy(get('https://divineacquisition.io/hiring'));
    expect(foreign.status).toBe(404);
  });
});
