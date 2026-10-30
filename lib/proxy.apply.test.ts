import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../proxy';

describe('coaches application route', () => {
  it('does not 404 the application API on the coaches host', async () => {
    const request = new NextRequest('https://acq.divineacquisition.io/api/acq/apply', {
      method: 'POST',
      headers: { host: 'acq.divineacquisition.io' },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(404);
  });

  it('rewrites a cleaning-host invite into the booking page', async () => {
    const request = new NextRequest('https://go.divineacquisition.io/invite/luis', {
      headers: { host: 'go.divineacquisition.io' },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(404);
    const rewrite = response.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite).toContain('/go/invite/luis');
  });

  it('rewrites the cleaning landing on the cleaning host', async () => {
    const request = new NextRequest('https://go.divineacquisition.io/cleaning', {
      headers: { host: 'go.divineacquisition.io' },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(404);
    const rewrite = response.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite).toContain('/go/cleaning');
  });

  it('does not rewrite the cleaning audit API into the cleaning pages', async () => {
    const request = new NextRequest('https://go.divineacquisition.io/api/go/cleaning-audit', {
      method: 'POST',
      headers: { host: 'go.divineacquisition.io' },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(404);
    const rewrite = response.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite.includes('/go/api/')).toBe(false);
  });

  it('does not rewrite the application API into the coaches pages', async () => {
    const request = new NextRequest('https://acq.divineacquisition.io/api/acq/apply', {
      method: 'POST',
      headers: { host: 'acq.divineacquisition.io' },
    });
    const response = await proxy(request);
    const rewrite = response.headers.get('x-middleware-rewrite') ?? '';
    expect(rewrite.includes('/acq/api/')).toBe(false);
  });
});
