import { describe, expect, it } from 'vitest';
import {
  filterLeads,
  formatMinutes,
  leadOfferLabel,
  leadSource,
  mapPipelineLead,
  marketSlug,
  parsePipelineFilters,
  pipelineAttention,
  pipelineMetrics,
  stageLabel,
  type Market,
  type PipelineLead,
} from './pipeline';

const NOW = Date.parse('2026-10-21T12:00:00Z');

function lead(overrides: Partial<PipelineLead> = {}): PipelineLead {
  return {
    id: overrides.id ?? 'a',
    createdAt: '2026-10-20T12:00:00Z',
    fullName: 'Lead',
    email: 'lead@example.com',
    phone: '',
    companyName: '',
    niche: '',
    offerLine: 'coaching',
    market: null,
    trade: '',
    stage: 'Step 1 Captured',
    stageChangedAt: null,
    qualificationResult: null,
    readinessScore: null,
    monthlyAdSpend: '',
    ownerId: null,
    nextAction: '',
    firstTouchAt: null,
    callAt: null,
    meetUrl: '',
    source: 'Direct',
    ...overrides,
  };
}

const markets: Market[] = [
  { slug: 'home_services', label: 'Home services', active: true, sortOrder: 10 },
  { slug: 'med_spa', label: 'Med spa', active: true, sortOrder: 20 },
];

describe('mapPipelineLead', () => {
  it('keeps the market for local leads only', () => {
    const local = mapPipelineLead({ id: '1', created_at: 'x', offer_line: 'local', market: 'med_spa', payload: { trade: 'injectables' } });
    expect(local.offerLine).toBe('local');
    expect(local.market).toBe('med_spa');
    expect(local.trade).toBe('injectables');

    const coaching = mapPipelineLead({ id: '2', created_at: 'x', offer_line: 'coaching', market: 'med_spa' });
    expect(coaching.market).toBeNull();
  });

  it('treats a lead without an offer line as coaching', () => {
    expect(mapPipelineLead({ id: '1', created_at: 'x' }).offerLine).toBe('coaching');
  });

  it('uses the go. session time when the lead has no audit time', () => {
    expect(mapPipelineLead({ id: '1', created_at: 'x' }, '2026-10-22T15:00:00Z').callAt).toBe('2026-10-22T15:00:00Z');
    expect(mapPipelineLead({ id: '1', created_at: 'x', scheduled_for: '2026-10-23T15:00:00Z' }, '2026-10-22T15:00:00Z').callAt).toBe(
      '2026-10-23T15:00:00Z',
    );
  });
});

describe('leadSource', () => {
  it('prefers the ad, then the campaign, then the source', () => {
    expect(leadSource({ tracking: { utm_content: 'ad-7', utm_campaign: 'c' } })).toBe('ad-7');
    expect(leadSource({ tracking: { utm_campaign: 'c', utm_source: 'fb' } })).toBe('c');
    expect(leadSource({ source: 'Founding Install Qualification' })).toBe('Founding Install Qualification');
    expect(leadSource({ origin: 'go_strategy_booking' })).toBe('Strategy session');
    expect(leadSource(null)).toBe('Direct');
  });
});

describe('labels', () => {
  it('reads audit as call for local markets', () => {
    expect(stageLabel('Audit Booked', 'local')).toBe('Call Booked');
    expect(stageLabel('Audit Held', 'local')).toBe('Call Held');
    expect(stageLabel('Audit Booked', 'coaching')).toBe('Audit Booked');
    expect(stageLabel('No Show', 'local')).toBe('No Show');
  });

  it('names the market for local leads', () => {
    expect(leadOfferLabel({ offerLine: 'coaching', market: null }, markets)).toBe('Coaching');
    expect(leadOfferLabel({ offerLine: 'local', market: 'med_spa' }, markets)).toBe('Med spa');
    expect(leadOfferLabel({ offerLine: 'local', market: 'roofing' }, markets)).toBe('roofing');
    expect(leadOfferLabel({ offerLine: 'local', market: null }, markets)).toBe('Local');
  });

  it('slugs market names', () => {
    expect(marketSlug('Med Spa')).toBe('med_spa');
    expect(marketSlug('  Chiropractic & Wellness ')).toBe('chiropractic_wellness');
    expect(marketSlug('24/7 Plumbing')).toBe('plumbing');
    expect(marketSlug('!!')).toBe('');
  });

  it('formats speed to contact', () => {
    expect(formatMinutes(null)).toBe('—');
    expect(formatMinutes(0.4)).toBe('<1 min');
    expect(formatMinutes(14)).toBe('14 min');
    expect(formatMinutes(180)).toBe('3 h');
    expect(formatMinutes(4 * 1440)).toBe('4 days');
  });
});

describe('parsePipelineFilters', () => {
  it('defaults to open leads across both offers', () => {
    expect(parsePipelineFilters({})).toEqual({ line: 'all', market: 'all', view: 'open', stage: 'all', owner: 'all', query: '' });
  });

  it('keeps a market only under local markets', () => {
    expect(parsePipelineFilters({ line: 'local', market: 'med_spa' }).market).toBe('med_spa');
    expect(parsePipelineFilters({ line: 'coaching', market: 'med_spa' }).market).toBe('all');
    expect(parsePipelineFilters({ line: 'local', market: 'Bad Slug' }).market).toBe('all');
  });

  it('drops values it does not know', () => {
    const filters = parsePipelineFilters({ line: 'other', stage: 'Nope', view: 'weird' });
    expect(filters.line).toBe('all');
    expect(filters.stage).toBe('all');
    expect(filters.view).toBe('open');
  });
});

describe('filterLeads', () => {
  const leads = [
    lead({ id: 'coach', offerLine: 'coaching', ownerId: 'me' }),
    lead({ id: 'spa', offerLine: 'local', market: 'med_spa', companyName: 'Glow Spa' }),
    lead({ id: 'clean', offerLine: 'local', market: 'home_services', stage: 'Closed Won' }),
  ];
  const base = parsePipelineFilters({});

  it('toggles between coaching and local markets', () => {
    expect(filterLeads(leads, { ...base, line: 'coaching' }, null).map((row) => row.id)).toEqual(['coach']);
    expect(filterLeads(leads, { ...base, line: 'local', view: 'all' }, null).map((row) => row.id)).toEqual(['spa', 'clean']);
  });

  it('narrows local leads to one market', () => {
    expect(filterLeads(leads, { ...base, line: 'local', market: 'med_spa' }, null).map((row) => row.id)).toEqual(['spa']);
  });

  it('hides closed leads unless asked', () => {
    expect(filterLeads(leads, base, null).map((row) => row.id)).toEqual(['coach', 'spa']);
    expect(filterLeads(leads, { ...base, view: 'closed' }, null).map((row) => row.id)).toEqual(['clean']);
  });

  it('filters by owner and search', () => {
    expect(filterLeads(leads, { ...base, owner: 'mine' }, 'me').map((row) => row.id)).toEqual(['coach']);
    expect(filterLeads(leads, { ...base, owner: 'unassigned' }, 'me').map((row) => row.id)).toEqual(['spa']);
    expect(filterLeads(leads, { ...base, query: 'glow' }, null).map((row) => row.id)).toEqual(['spa']);
  });
});

describe('pipelineMetrics', () => {
  it('measures book, show and close rates from current stages', () => {
    const metrics = pipelineMetrics([
      lead({ stage: 'Step 1 Captured' }),
      lead({ stage: 'Audit Booked' }),
      lead({ stage: 'No Show' }),
      lead({ stage: 'Audit Held' }),
      lead({ stage: 'Closed Won' }),
      lead({ stage: 'Closed Lost' }),
    ]);
    expect(metrics.leads).toBe(6);
    expect(metrics.booked).toBe(5);
    expect(metrics.held).toBe(3);
    expect(metrics.noShows).toBe(1);
    expect(metrics.showRate).toBe(0.75);
    expect(metrics.closeRate).toBeCloseTo(1 / 3);
  });

  it('takes the median minutes to first touch', () => {
    const metrics = pipelineMetrics([
      lead({ createdAt: '2026-10-20T12:00:00Z', firstTouchAt: '2026-10-20T12:05:00Z' }),
      lead({ createdAt: '2026-10-20T12:00:00Z', firstTouchAt: '2026-10-20T12:15:00Z' }),
      lead({ createdAt: '2026-10-20T12:00:00Z', firstTouchAt: '2026-10-20T14:00:00Z' }),
      lead({ createdAt: '2026-10-20T12:00:00Z' }),
    ]);
    expect(metrics.medianMinutesToTouch).toBe(15);
    expect(metrics.touched).toBe(3);
  });

  it('returns no rates for an empty pipeline', () => {
    const metrics = pipelineMetrics([]);
    expect(metrics.bookRate).toBeNull();
    expect(metrics.showRate).toBeNull();
    expect(metrics.closeRate).toBeNull();
    expect(metrics.medianMinutesToTouch).toBeNull();
  });
});

describe('pipelineAttention', () => {
  it('flags past calls without an outcome, untouched ready leads, and unowned leads', () => {
    const attention = pipelineAttention(
      [
        lead({ id: 'past', stage: 'Audit Booked', callAt: '2026-10-21T10:00:00Z', ownerId: 'x' }),
        lead({ id: 'future', stage: 'Audit Booked', callAt: '2026-10-22T10:00:00Z', ownerId: 'x' }),
        lead({ id: 'ready', stage: 'Qualified - Not Booked', ownerId: 'x' }),
        lead({ id: 'touched', stage: 'Qualified - Not Booked', ownerId: 'x', firstTouchAt: '2026-10-20T13:00:00Z' }),
        lead({ id: 'orphan', stage: 'Step 1 Captured' }),
        lead({ id: 'closed', stage: 'Closed Lost' }),
      ],
      NOW,
    );
    expect(attention.needsOutcome.map((row) => row.id)).toEqual(['past']);
    expect(attention.untouchedReady.map((row) => row.id)).toEqual(['ready']);
    expect(attention.unassigned.map((row) => row.id)).toEqual(['orphan']);
  });
});
