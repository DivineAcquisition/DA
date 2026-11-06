import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseDiagnosticRequest, type DiagnosticRequest } from './forms';
import { recordDiagnosticRequest, type Destinations } from './inquiry';

const parsed = parseDiagnosticRequest({
  fullName: 'Avery Stone',
  email: 'avery@example.co',
  company: 'Stone Roofing',
  website: 'stoneroofing.com',
  position: 'Founder / Owner',
  businessType: 'Roofing / Remodeling',
  dealValue: '$5,001–$20,000',
  monthlyOpportunities: '11–30',
  constraints: ['Poor CRM organization'],
  crm: 'No CRM',
  timeline: 'Exploring Options',
  privacyConsent: true,
  marketingConsent: true,
});
if (!parsed.ok) throw new Error('fixture should parse');
const request: DiagnosticRequest = parsed.value;

function destinations(overrides: Partial<Destinations> = {}): Destinations & { failures: string[] } {
  const failures: string[] = [];
  return {
    crm: vi.fn(async () => 'contact-1'),
    alert: vi.fn(async () => true),
    logFailure: vi.fn(async (step: string) => {
      failures.push(step);
    }),
    ...overrides,
    failures,
  };
}

describe('recording a diagnostic request', () => {
  it('writes the contact with the diagnostic tags and emails the team', async () => {
    const live = destinations();
    const result = await recordDiagnosticRequest(request, live);
    expect(result).toMatchObject({ ok: true, crm: true, email: true });
    const crmCall = vi.mocked(live.crm).mock.calls[0][0];
    expect(crmCall.tags).toEqual(['source - sales operations diagnostic', 'diagnostic - new inquiry', 'consent - marketing opt in']);
    expect(crmCall.tags).not.toContain('consent - sms opt in');
    expect(crmCall.note).toContain(result.inquiryId);
    expect(vi.mocked(live.alert).mock.calls[0][0].replyTo).toBe('avery@example.co');
  });

  it('still counts as received when only one destination takes it', async () => {
    const live = destinations({ crm: vi.fn(async () => Promise.reject(new Error('GHL down'))) });
    const result = await recordDiagnosticRequest(request, live);
    expect(result).toMatchObject({ ok: true, crm: false, email: true });
    expect(live.failures).toEqual(['site-crm']);
  });

  it('reports failure when nothing recorded it', async () => {
    const live = destinations({
      crm: vi.fn(async () => Promise.reject(new Error('GHL down'))),
      alert: vi.fn(async () => Promise.reject(new Error('email down'))),
    });
    const result = await recordDiagnosticRequest(request, live);
    expect(result.ok).toBe(false);
    expect(live.failures).toEqual(['site-crm', 'site-alert']);
  });
});
