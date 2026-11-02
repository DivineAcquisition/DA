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

  it('rewrites the cleaning host home page into the go surface', async () => {
    const home = await proxy(new NextRequest('https://go.divineacquisition.io/', { headers: { host: 'go.divineacquisition.io' } }));
    expect(home.status).not.toBe(404);
    expect(home.headers.get('x-middleware-rewrite') ?? '').toContain('/go');
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

  it('rewrites the sales operations page onto the acq surface', async () => {
    const request = new NextRequest('https://acq.divineacquisition.io/operations', {
      headers: { host: 'acq.divineacquisition.io' },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(404);
    expect(response.headers.get('x-middleware-rewrite') ?? '').toContain('/acq/operations');
  });

  it('sends the team home to the operator portal instead of not found', async () => {
    const response = await proxy(
      new NextRequest('https://team.divineacquisition.io/workspace', {
        headers: { host: 'team.divineacquisition.io' },
      }),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://team.divineacquisition.io/workspace/operator');
  });

  it('serves the team forgot-password and reset-password screens', async () => {
    for (const path of ['/workspace/forgot-password', '/workspace/reset-password']) {
      const response = await proxy(
        new NextRequest(`https://team.divineacquisition.io${path}`, {
          headers: { host: 'team.divineacquisition.io' },
        }),
      );
      expect(response.status).not.toBe(404);
    }
  });

  it('keeps admin screens off the team app', async () => {
    const response = await proxy(
      new NextRequest('https://team.divineacquisition.io/workspace/operations', {
        headers: { host: 'team.divineacquisition.io' },
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not found');
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
