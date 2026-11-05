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

  it.each(['https://www.divineacquisition.io/', 'https://divineacquisition.io/'])('serves the homepage at %s by default', async (url) => {
    const proxy = await loadProxy();
    const home = await proxy(get(url));
    expect(home.status).not.toBe(404);
    expect(home.headers.get('x-middleware-rewrite') ?? '').toContain('/site');
    expect(home.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('keeps careers off the homepage host', async () => {
    const proxy = await loadProxy();
    const foreign = await proxy(get('https://www.divineacquisition.io/hiring'));
    expect(foreign.status).toBe(404);
  });

  it('leaves the careers host on the careers board', async () => {
    const proxy = await loadProxy();
    const careers = await proxy(get('https://hiring.divineacquisition.io/'));
    expect(careers.status).not.toBe(404);
    expect(careers.headers.get('x-middleware-rewrite') ?? '').not.toContain('/site');
  });

  it('follows DA_SITE_HOSTS when it is set', async () => {
    const proxy = await loadProxy('preview.divineacquisition.io');
    const preview = await proxy(get('https://preview.divineacquisition.io/'));
    expect(preview.headers.get('x-middleware-rewrite') ?? '').toContain('/site');
    const www = await proxy(get('https://www.divineacquisition.io/'));
    expect(www.headers.get('x-middleware-rewrite') ?? '').not.toContain('/site');
  });
});
