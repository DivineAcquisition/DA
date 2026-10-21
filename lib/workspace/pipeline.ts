import { CLOSED_STAGES, LEAD_STAGES, isLeadStage, type LeadStage } from '@/lib/acq/stages';

/**
 * One pipeline for every prospect, in two offer lines: coaching (acq.
 * applications) and local markets (home services, med spa, dental, and any
 * market added in the workspace). Stage values are the coaching pipeline's
 * (they mirror the GHL and Airtable stages); local markets read "audit" as
 * "call".
 */

export const OFFER_LINES = ['coaching', 'local'] as const;
export type OfferLine = (typeof OFFER_LINES)[number];

export function isOfferLine(value: string): value is OfferLine {
  return (OFFER_LINES as readonly string[]).includes(value);
}

export function offerLineLabel(line: OfferLine): string {
  return line === 'coaching' ? 'Coaching' : 'Local markets';
}

export type Market = { slug: string; label: string; active: boolean; sortOrder: number };

export const MARKET_SLUG = /^[a-z][a-z0-9_]{1,39}$/;

/** "Med Spa" -> "med_spa". Empty when nothing usable is left. */
export function marketSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[0-9_]+/, '')
    .slice(0, 40);
  return MARKET_SLUG.test(slug) ? slug : '';
}

export function marketLabel(slug: string | null, markets: Market[]): string {
  if (!slug) return '';
  return markets.find((market) => market.slug === slug)?.label ?? slug.replace(/_/g, ' ');
}

/** "Coaching", or the market for a local lead ("Med spa"). */
export function leadOfferLabel(lead: Pick<PipelineLead, 'offerLine' | 'market'>, markets: Market[]): string {
  if (lead.offerLine === 'coaching') return 'Coaching';
  return marketLabel(lead.market, markets) || 'Local';
}

export const PIPELINE_STAGES = LEAD_STAGES;
export type PipelineStage = LeadStage;

export const OPEN_STAGES = LEAD_STAGES.filter(
  (stage) => !(CLOSED_STAGES as readonly string[]).includes(stage),
) as PipelineStage[];

export function isPipelineStage(value: string): value is PipelineStage {
  return isLeadStage(value);
}

export function isOpenStage(stage: string): boolean {
  return (OPEN_STAGES as readonly string[]).includes(stage);
}

export function stageLabel(stage: string, line: OfferLine | 'all' = 'coaching'): string {
  if (line !== 'local') return stage;
  if (stage === 'Audit Booked') return 'Call Booked';
  if (stage === 'Audit Held') return 'Call Held';
  return stage;
}

export type StageTone = 'neutral' | 'accent' | 'success' | 'error' | 'pending';

export function stageTone(stage: string): StageTone {
  switch (stage) {
    case 'Closed Won':
      return 'success';
    case 'Closed Lost':
    case 'Disqualified':
    case 'No Show':
      return 'error';
    case 'Audit Booked':
    case 'Audit Held':
      return 'accent';
    case 'Manual Review':
    case 'Qualified - Not Booked':
      return 'pending';
    default:
      return 'neutral';
  }
}

/** Stages at or past a held call. */
const HELD_OR_LATER = new Set<string>(['Audit Held', 'Closed Won', 'Closed Lost']);
/** Stages at or past a booked call, a no-show included. */
const BOOKED_OR_LATER = new Set<string>(['Audit Booked', 'No Show', ...HELD_OR_LATER]);
/** Leads someone should be calling now. */
const READY_STAGES = new Set<string>(['Manual Review', 'Qualified - Not Booked']);

export const EVENT_KINDS = ['created', 'stage', 'owner', 'note', 'touch', 'booking'] as const;
export type LeadEventKind = (typeof EVENT_KINDS)[number];

export const TOUCH_CHANNELS = ['call', 'sms', 'email', 'dm', 'meeting', 'other'] as const;
export type TouchChannel = (typeof TOUCH_CHANNELS)[number];

export function isTouchChannel(value: string): value is TouchChannel {
  return (TOUCH_CHANNELS as readonly string[]).includes(value);
}

export function touchChannelLabel(channel: string): string {
  switch (channel) {
    case 'call':
      return 'Call';
    case 'sms':
      return 'Text';
    case 'email':
      return 'Email';
    case 'dm':
      return 'DM';
    case 'meeting':
      return 'Meeting';
    default:
      return 'Other';
  }
}

export type PipelineLead = {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  niche: string;
  offerLine: OfferLine;
  /** Local leads only: the market slug. */
  market: string | null;
  /** Local leads only: the trade or specialty, when known (cleaning, roofing). */
  trade: string;
  stage: string;
  stageChangedAt: string | null;
  qualificationResult: string | null;
  readinessScore: number | null;
  monthlyAdSpend: string;
  ownerId: string | null;
  nextAction: string;
  firstTouchAt: string | null;
  /** Coaching audit time, or the latest go. strategy session. */
  callAt: string | null;
  meetUrl: string;
  source: string;
};

export type Assignee = { id: string; name: string; role: string };

export type LeadEvent = {
  id: string;
  createdAt: string;
  actorId: string | null;
  kind: LeadEventKind;
  fromStage: string | null;
  toStage: string | null;
  channel: string | null;
  body: string;
  meta: Record<string, unknown>;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Where the lead came from, most specific first: the ad, the campaign, the source. */
export function leadSource(payload: unknown): string {
  const body = record(payload);
  const tracking = record(body.tracking);
  if (text(body.origin) === 'go_strategy_booking') {
    return text(tracking.utm_content) || text(tracking.utm_campaign) || 'Strategy session';
  }
  return (
    text(tracking.utm_content) ||
    text(tracking.utm_campaign) ||
    text(tracking.utm_source) ||
    text(body.source) ||
    'Direct'
  );
}

export function mapPipelineLead(raw: Record<string, unknown>, sessionAt?: string | null): PipelineLead {
  const line = text(raw.offer_line);
  const score = raw.readiness_score;
  const offerLine: OfferLine = isOfferLine(line) ? line : 'coaching';
  return {
    id: String(raw.id),
    createdAt: String(raw.created_at),
    fullName: text(raw.full_name) || text(raw.email) || 'Unnamed lead',
    email: text(raw.email),
    phone: text(raw.phone),
    companyName: text(raw.company_name),
    niche: text(raw.coaching_niche),
    offerLine,
    market: offerLine === 'local' ? text(raw.market) || null : null,
    trade: text(record(raw.payload).trade),
    stage: text(raw.stage) || 'Step 1 Captured',
    stageChangedAt: text(raw.stage_changed_at) || null,
    qualificationResult: text(raw.qualification_result) || null,
    readinessScore: typeof score === 'number' ? score : null,
    monthlyAdSpend: text(raw.monthly_ad_spend),
    ownerId: text(raw.owner_id) || null,
    nextAction: text(raw.next_action),
    firstTouchAt: text(raw.first_touch_at) || null,
    callAt: text(raw.scheduled_for) || sessionAt || null,
    meetUrl: text(raw.meet_url),
    source: leadSource(raw.payload),
  };
}

export function mapLeadEvent(raw: Record<string, unknown>): LeadEvent {
  const kind = text(raw.kind);
  return {
    id: String(raw.id),
    createdAt: String(raw.created_at),
    actorId: text(raw.actor_id) || null,
    kind: (EVENT_KINDS as readonly string[]).includes(kind) ? (kind as LeadEventKind) : 'note',
    fromStage: text(raw.from_stage) || null,
    toStage: text(raw.to_stage) || null,
    channel: text(raw.channel) || null,
    body: typeof raw.body === 'string' ? raw.body : '',
    meta: record(raw.meta),
  };
}

// Filters ------------------------------------------------------------------

export type PipelineView = 'open' | 'closed' | 'all';
export type OwnerFilter = 'all' | 'mine' | 'unassigned' | string;

export type PipelineFilters = {
  line: OfferLine | 'all';
  /** Local markets only. */
  market: string | 'all';
  view: PipelineView;
  stage: PipelineStage | 'all';
  owner: OwnerFilter;
  query: string;
};

export function parsePipelineFilters(params: Record<string, string | string[] | undefined>): PipelineFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
  };
  const line = one('line');
  const market = one('market');
  const view = one('view');
  const stage = one('stage');
  const owner = one('owner');
  return {
    line: isOfferLine(line) ? line : 'all',
    market: line === 'local' && MARKET_SLUG.test(market) ? market : 'all',
    view: view === 'closed' || view === 'all' ? view : 'open',
    stage: isPipelineStage(stage) ? stage : 'all',
    owner: owner || 'all',
    query: one('q').slice(0, 120),
  };
}

/** The offer toggle and market chips: what the metrics, counts and list cover. */
export function inScope(lead: PipelineLead, filters: Pick<PipelineFilters, 'line' | 'market'>): boolean {
  if (filters.line !== 'all' && lead.offerLine !== filters.line) return false;
  if (filters.line === 'local' && filters.market !== 'all' && lead.market !== filters.market) return false;
  return true;
}

export function filterLeads(leads: PipelineLead[], filters: PipelineFilters, viewerId: string | null): PipelineLead[] {
  const needle = filters.query.toLowerCase();
  return leads.filter((lead) => {
    if (!inScope(lead, filters)) return false;
    if (filters.stage !== 'all') {
      if (lead.stage !== filters.stage) return false;
    } else if (filters.view === 'open' && !isOpenStage(lead.stage)) {
      return false;
    } else if (filters.view === 'closed' && isOpenStage(lead.stage)) {
      return false;
    }
    if (filters.owner === 'mine' && lead.ownerId !== viewerId) return false;
    if (filters.owner === 'unassigned' && lead.ownerId) return false;
    if (!['all', 'mine', 'unassigned'].includes(filters.owner) && lead.ownerId !== filters.owner) return false;
    if (needle) {
      const haystack = `${lead.fullName} ${lead.email} ${lead.phone} ${lead.companyName} ${lead.niche} ${lead.trade} ${lead.source}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

// Metrics ------------------------------------------------------------------

export type PipelineMetrics = {
  leads: number;
  booked: number;
  held: number;
  noShows: number;
  won: number;
  /** Booked calls / leads. */
  bookRate: number | null;
  /** Held / (held + no-shows). */
  showRate: number | null;
  /** Won / held. */
  closeRate: number | null;
  /** Median minutes from lead to first logged touch. */
  medianMinutesToTouch: number | null;
  touched: number;
};

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Funnel figures from each lead's current stage. A lead that no-showed and
 * then held a rebooked call counts as held, which is what the client sees too.
 */
export function pipelineMetrics(leads: PipelineLead[]): PipelineMetrics {
  let booked = 0;
  let held = 0;
  let noShows = 0;
  let won = 0;
  const touchMinutes: number[] = [];
  for (const lead of leads) {
    if (BOOKED_OR_LATER.has(lead.stage)) booked += 1;
    if (HELD_OR_LATER.has(lead.stage)) held += 1;
    if (lead.stage === 'No Show') noShows += 1;
    if (lead.stage === 'Closed Won') won += 1;
    if (lead.firstTouchAt) {
      const minutes = (Date.parse(lead.firstTouchAt) - Date.parse(lead.createdAt)) / 60_000;
      if (Number.isFinite(minutes)) touchMinutes.push(Math.max(0, minutes));
    }
  }
  return {
    leads: leads.length,
    booked,
    held,
    noShows,
    won,
    bookRate: ratio(booked, leads.length),
    showRate: ratio(held, held + noShows),
    closeRate: ratio(won, held),
    medianMinutesToTouch: median(touchMinutes),
    touched: touchMinutes.length,
  };
}

export function leadsSince(leads: PipelineLead[], days: number, now = Date.now()): PipelineLead[] {
  const cutoff = now - days * 86_400_000;
  return leads.filter((lead) => Date.parse(lead.createdAt) >= cutoff);
}

export type PipelineAttention = {
  /** Booked call time has passed and nobody recorded held, no-show, or an outcome. */
  needsOutcome: PipelineLead[];
  /** Ready to call and never touched. */
  untouchedReady: PipelineLead[];
  /** Open and nobody owns it. */
  unassigned: PipelineLead[];
};

export function pipelineAttention(leads: PipelineLead[], now = Date.now()): PipelineAttention {
  return {
    needsOutcome: leads.filter(
      (lead) => lead.stage === 'Audit Booked' && lead.callAt !== null && Date.parse(lead.callAt) < now,
    ),
    untouchedReady: leads.filter((lead) => READY_STAGES.has(lead.stage) && !lead.firstTouchAt),
    unassigned: leads.filter((lead) => isOpenStage(lead.stage) && !lead.ownerId),
  };
}

export function stageCounts(leads: PipelineLead[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stage of PIPELINE_STAGES) counts[stage] = 0;
  for (const lead of leads) counts[lead.stage] = (counts[lead.stage] ?? 0) + 1;
  return counts;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function formatMinutes(value: number | null): string {
  if (value === null) return '—';
  if (value < 1) return '<1 min';
  if (value < 60) return `${Math.round(value)} min`;
  if (value < 48 * 60) return `${Math.round(value / 60)} h`;
  return `${Math.round(value / 1440)} days`;
}
