import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, DataTable, EmptyState, PageHeader } from '../components/ui';
import { ws } from '../components/tokens';
import { getSessionContext } from '@/lib/supabase/server';
import { formatDate, formatDateTime } from '@/lib/workspace/format';
import {
  OPEN_STAGES,
  PIPELINE_STAGES,
  filterLeads,
  formatMinutes,
  formatPercent,
  inScope,
  leadOfferLabel,
  leadsSince,
  offerLineLabel,
  parsePipelineFilters,
  pipelineAttention,
  pipelineMetrics,
  stageCounts,
  stageLabel,
  stageTone,
  type Market,
  type PipelineFilters,
  type PipelineLead,
} from '@/lib/workspace/pipeline';
import { listPipelineLeads } from '@/lib/workspace/pipeline-queries';
import { MarketsButton, NewLeadButton } from './components/LeadForms';

export const metadata: Metadata = { title: 'Pipeline' };
export const dynamic = 'force-dynamic';

const METRIC_DAYS = 30;

function href(filters: PipelineFilters, change: Partial<PipelineFilters>): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.line !== 'all') params.set('line', next.line);
  if (next.line === 'local' && next.market !== 'all') params.set('market', next.market);
  if (next.view !== 'open') params.set('view', next.view);
  if (next.stage !== 'all') params.set('stage', next.stage);
  if (next.owner !== 'all') params.set('owner', next.owner);
  if (next.query) params.set('q', next.query);
  const query = params.toString();
  return query ? `/workspace/pipeline?${query}` : '/workspace/pipeline';
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${ws.card} p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300">{label}</p>
      <p className={`${ws.heading} mt-2 text-3xl font-semibold tabular-nums`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ws-dim)]">{hint}</p>}
    </div>
  );
}

function Chip({ href: to, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active ? 'border-brand-500/50 bg-brand-500/15 text-white' : 'border-white/10 text-neutral-400 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

function AttentionList({
  title,
  hint,
  leads,
  markets,
}: {
  title: string;
  hint: string;
  leads: PipelineLead[];
  markets: Market[];
}) {
  return (
    <div className={`${ws.card} p-5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${
            leads.length > 0 ? 'bg-amber-400/10 text-amber-300' : 'bg-white/[0.04] text-neutral-400'
          }`}
        >
          {leads.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--ws-dim)]">{hint}</p>
      {leads.length > 0 && (
        <ul className="mt-3 space-y-1">
          {leads.slice(0, 5).map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/workspace/pipeline/${lead.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-neutral-200 hover:bg-white/[0.04]"
              >
                <span className="truncate">{lead.fullName}</span>
                <span className="shrink-0 text-xs text-[var(--ws-dim)]">{leadOfferLabel(lead, markets)}</span>
              </Link>
            </li>
          ))}
          {leads.length > 5 && <li className="px-2 pt-1 text-xs text-[var(--ws-dim)]">and {leads.length - 5} more</li>}
        </ul>
      )}
    </div>
  );
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parsePipelineFilters(await searchParams);
  const [{ leads, assignees, markets, truncated, error }, session] = await Promise.all([
    listPipelineLeads(),
    getSessionContext(),
  ]);
  const viewerId = session?.userId ?? null;
  const ownerName = new Map(assignees.map((person) => [person.id, person.name]));

  const inLine = leads.filter((lead) => inScope(lead, filters));
  const localLeads = leads.filter((lead) => lead.offerLine === 'local');
  // Hidden markets still get a chip while they have leads.
  const marketChips = markets.filter(
    (market) => market.active || localLeads.some((lead) => lead.market === market.slug),
  );
  const metrics = pipelineMetrics(leadsSince(inLine, METRIC_DAYS));
  const attention = pipelineAttention(inLine);
  const counts = stageCounts(inLine);
  const visible = filterLeads(leads, filters, viewerId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pipeline"
        description="Every prospect in one place, coaching and local markets. Work the lead here; stage changes, owners, notes and touches build its timeline."
        actions={
          <>
            <MarketsButton markets={markets} />
            <NewLeadButton
              assignees={assignees}
              markets={markets}
              defaultLine={filters.line === 'coaching' ? 'coaching' : 'local'}
              defaultMarket={filters.market === 'all' ? null : filters.market}
            />
          </>
        }
      />

      {error && (
        <p className="rounded-xl border border-[var(--ws-error)]/40 bg-[var(--ws-error)]/10 px-4 py-3 text-sm text-[var(--ws-error)]">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <nav className="flex flex-wrap gap-2" aria-label="Offer">
          {(['all', 'coaching', 'local'] as const).map((line) => (
            <Chip key={line} href={href(filters, { line, market: 'all', stage: 'all' })} active={filters.line === line}>
              {line === 'all' ? 'All offers' : offerLineLabel(line)}
              <span className="tabular-nums text-[var(--ws-dim)]">
                {line === 'all' ? leads.length : leads.filter((lead) => lead.offerLine === line).length}
              </span>
            </Chip>
          ))}
        </nav>
        {filters.line === 'local' && (
          <nav className="flex flex-wrap gap-2 border-l border-white/10 pl-3" aria-label="Market">
            <Chip href={href(filters, { market: 'all', stage: 'all' })} active={filters.market === 'all'}>
              All markets
            </Chip>
            {marketChips.map((market) => (
              <Chip
                key={market.slug}
                href={href(filters, { market: market.slug, stage: 'all' })}
                active={filters.market === market.slug}
              >
                {market.label}
                <span className="tabular-nums text-[var(--ws-dim)]">
                  {localLeads.filter((lead) => lead.market === market.slug).length}
                </span>
              </Chip>
            ))}
          </nav>
        )}
      </div>

      <section>
        <h2 className={`${ws.heading} mb-3.5 text-lg font-semibold`}>Last {METRIC_DAYS} days</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="New leads" value={metrics.leads} />
          <Stat label="Booked" value={formatPercent(metrics.bookRate)} hint={`${metrics.booked} booked a call`} />
          <Stat
            label="Show rate"
            value={formatPercent(metrics.showRate)}
            hint={`${metrics.held} held · ${metrics.noShows} no-show`}
          />
          <Stat label="Close rate" value={formatPercent(metrics.closeRate)} hint={`${metrics.won} won of ${metrics.held} held`} />
          <Stat
            label="Speed to contact"
            value={formatMinutes(metrics.medianMinutesToTouch)}
            hint={metrics.touched > 0 ? `Median of ${metrics.touched} contacted` : 'Log touches to measure this'}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AttentionList
          title="Calls missing an outcome"
          hint="The booked time has passed. Mark held, no-show, or the result."
          leads={attention.needsOutcome}
          markets={markets}
        />
        <AttentionList
          title="Ready and never contacted"
          hint="Qualified or in manual review with no touch logged."
          leads={attention.untouchedReady}
          markets={markets}
        />
        <AttentionList title="Unassigned" hint="Open leads nobody owns." leads={attention.unassigned} markets={markets} />
      </section>

      <section className="flex flex-wrap gap-2" aria-label="Stages">
        {OPEN_STAGES.map((stage) => (
          <Link
            key={stage}
            href={href(filters, { stage: filters.stage === stage ? 'all' : stage })}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              filters.stage === stage
                ? 'border-brand-500/50 bg-brand-500/15 text-white'
                : 'border-white/[0.08] text-neutral-300 hover:border-white/20'
            }`}
          >
            {stageLabel(stage, filters.line)}
            <span className="tabular-nums text-[var(--ws-dim)]">{counts[stage] ?? 0}</span>
          </Link>
        ))}
      </section>

      <form method="get" action="/workspace/pipeline" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        {filters.line !== 'all' && <input type="hidden" name="line" value={filters.line} />}
        {filters.line === 'local' && filters.market !== 'all' && <input type="hidden" name="market" value={filters.market} />}
        <input
          name="q"
          defaultValue={filters.query}
          placeholder="Search name, email, company, source"
          className={ws.input}
          aria-label="Search"
        />
        <select name="stage" defaultValue={filters.stage} className={ws.select} aria-label="Stage">
          <option value="all">Any stage</option>
          {PIPELINE_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabel(stage, filters.line)}
            </option>
          ))}
        </select>
        <select name="owner" defaultValue={filters.owner} className={ws.select} aria-label="Owner">
          <option value="all">Any owner</option>
          <option value="mine">Mine</option>
          <option value="unassigned">Unassigned</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <select name="view" defaultValue={filters.view} className={ws.select} aria-label="Open or closed">
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="all">Open and closed</option>
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-ink-950 hover:bg-brand-400 sm:h-9"
        >
          Filter
        </button>
      </form>

      <section>
        {visible.length === 0 ? (
          <EmptyState
            title={leads.length === 0 ? 'No leads yet' : 'No leads match'}
            description={
              leads.length === 0
                ? 'Coaching applications and go. strategy sessions land here on their own. Add local-market leads with New lead.'
                : 'Change the filters above to widen the list.'
            }
          />
        ) : (
          <DataTable headers={['Lead', 'Offer', 'Stage', 'Owner', 'Source', 'Call', 'First touch', 'Added']}>
            {visible.map((lead) => (
              <tr key={lead.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/workspace/pipeline/${lead.id}`} className="font-medium text-white hover:text-brand-200">
                    {lead.fullName}
                  </Link>
                  <p className="text-xs text-[var(--ws-dim)]">{lead.companyName || lead.email}</p>
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">
                  {leadOfferLabel(lead, markets)}
                  {lead.trade && <p className="text-xs capitalize">{lead.trade}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stageTone(lead.stage)}>{stageLabel(lead.stage, lead.offerLine)}</Badge>
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">
                  {lead.ownerId ? ownerName.get(lead.ownerId) ?? 'Former staff' : '—'}
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 text-[var(--ws-dim)]">{lead.source}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(lead.callAt)}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{lead.firstTouchAt ? formatDateTime(lead.firstTouchAt) : 'Never'}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(lead.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        )}
        {truncated && (
          <p className="mt-3 text-xs text-[var(--ws-dim)]">Showing the newest 2,000 leads. Older leads are not in this list or its figures.</p>
        )}
      </section>
    </div>
  );
}
