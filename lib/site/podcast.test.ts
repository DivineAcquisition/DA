import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { HONEYPOT_FIELD, parsePodcastRequest, podcastSummary } from './forms';
import { recordPodcastRequest, type Destinations } from './inquiry';

const answers = {
  fullName: 'Jordan Reyes',
  email: 'Jordan@Reyes.co',
  phone: '(415) 555-0142',
  company: 'Reyes Advisory',
  website: 'reyes.co',
  position: 'Founder / Owner',
  episode: '',
  whyNow: 'The follow-up episode. We lose deals after the proposal.',
  businessType: 'B2B Consultancy',
  primaryServices: 'Fractional finance for SaaS founders.',
  dealValue: '$5,001–$20,000',
  monthlyOpportunities: '11–30',
  salesCycle: '1–4 weeks',
  sources: ['Referrals', 'Content / Social Media'],
  newOpportunityProcess: 'I reply by email when I can.',
  qualificationOwner: 'Me.',
  crm: 'HubSpot',
  tools: '',
  constraints: ['Proposals or estimates going quiet'],
  biggestLoss: 'After the proposal goes out.',
  successLooksLike: 'Every proposal gets a follow-up and I know where each deal stands.',
  timeline: 'Within 30 days',
  approver: 'Just me',
  privacyConsent: true,
  marketingConsent: false,
};

describe('the podcast 1-on-1 request', () => {
  it('parses a full request and keeps optional fields optional', () => {
    const parsed = parsePodcastRequest(answers);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.email).toBe('jordan@reyes.co');
    expect(parsed.value.website).toBe('https://reyes.co');
    expect(parsed.value.episode).toBe('');
    const rows = podcastSummary(parsed.value, 'abc12345');
    expect(rows[0]).toEqual(['Inquiry', 'Podcast 1-on-1 · abc12345']);
    expect(rows.find(([label]) => label === 'Why they reached out')?.[1]).toContain('follow-up episode');
  });

  it('requires a phone number and the discovery answers, and reports every missing field', () => {
    const parsed = parsePodcastRequest({ ...answers, phone: '', biggestLoss: '', sources: [], privacyConsent: false });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.field).toBe('phone');
    expect(Object.keys(parsed.fields ?? {})).toEqual(['phone', 'sources', 'biggestLoss', 'privacyConsent']);
  });

  it('treats a filled honeypot as a bot', () => {
    expect(parsePodcastRequest({ ...answers, [HONEYPOT_FIELD]: 'x' })).toEqual({ ok: false, error: 'honeypot' });
  });

  it('writes the pipeline, the CRM with podcast tags, and the team alert', async () => {
    const parsed = parsePodcastRequest(answers);
    if (!parsed.ok) throw new Error('fixture should parse');
    const live: Destinations = {
      store: vi.fn(async () => 'lead-1'),
      crm: vi.fn(async () => 'contact-1'),
      alert: vi.fn(async () => true),
      logFailure: vi.fn(async () => {}),
    };
    const result = await recordPodcastRequest(parsed.value, live);
    expect(result).toMatchObject({ ok: true, stored: true, crm: true, email: true });
    expect(vi.mocked(live.store).mock.calls[0][0]).toMatchObject({ kind: 'podcast', inquiryId: result.inquiryId, phone: '(415) 555-0142' });
    expect(vi.mocked(live.crm).mock.calls[0][0]).toMatchObject({ source: 'podcast', tags: ['source - podcast', 'podcast - call request'] });
    expect(vi.mocked(live.alert).mock.calls[0][0]).toMatchObject({ event: 'site.podcast-request', eyebrow: 'Podcast 1-on-1', replyTo: 'jordan@reyes.co' });
  });
});
