import Link from 'next/link';
import type { BoardRow } from '@/lib/team/types';
import { Badge } from '../components/ui';
import { CONTROL_LABEL, formatStandard, STATUS_LABEL } from '@/lib/portal/standards';

const STAGE: Record<BoardRow['stage'], string> = {
  placed: 'Placed',
  waiting: 'Certified, waiting',
  training: 'In training',
  applicant: 'Applicant',
  inactive: 'Inactive',
};

/** Every VA in scope, placed first, with the same numbers they see. */
export default function BoardView({ rows }: { rows: BoardRow[] }) {
  const placed = rows.filter((r) => r.stage === 'placed');
  const others = rows.filter((r) => r.stage !== 'placed');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Team board</h1>
        <p className="mt-1 text-sm text-neutral-400">Standards this month, calculated exactly as each VA sees them.</p>
      </div>
      {placed.length === 0 ? <p className="text-sm text-neutral-500">No placed VAs in your scope.</p> : null}
      <ul className="space-y-3">
        {placed.map((row) => (
          <li key={row.id} className="panel rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/vistrial/team/operator/${row.id}`} className="text-sm font-semibold text-white hover:underline">
                  {row.name}
                </Link>
                <p className="text-xs text-neutral-500">
                  {row.placements.filter((p) => p.live).map((p) => p.client_name).join(', ') || 'No live placement'}
                  {row.tier ? ` · Tier ${row.tier}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.feedback_owed ? <Badge tone="brand">Feedback owed</Badge> : null}
                {row.reviews_unconfirmed > 0 ? <Badge tone="neutral">{row.reviews_unconfirmed} unconfirmed</Badge> : null}
                {row.disputes_open > 0 ? <Badge tone="brand">{row.disputes_open} disputes</Badge> : null}
                {row.flagged_shifts > 0 ? <Badge tone="warning">{row.flagged_shifts} shifts to decide</Badge> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(row.standards ?? []).map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="truncate text-neutral-300">{s.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-white">{s.value === null ? '–' : formatStandard(s.value, s.unit)}</span>
                    <Badge tone={STATUS_LABEL[s.status].tone}>{STATUS_LABEL[s.status].label}</Badge>
                  </span>
                </div>
              ))}
            </div>
            {Object.values(row.blockers).some((n) => n > 0) ? (
              <p className="mt-2 text-xs text-neutral-400">
                Open blockers:{' '}
                {(Object.keys(row.blockers) as (keyof BoardRow['blockers'])[])
                  .filter((k) => row.blockers[k] > 0)
                  .map((k) => `${CONTROL_LABEL[k]} ${row.blockers[k]}`)
                  .join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <section>
          <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Not placed</h2>
          <ul className="space-y-2">
            {others.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                <Link href={`/vistrial/team/operator/${row.id}`} className="text-neutral-200 hover:underline">
                  {row.name}
                </Link>
                <span className="text-xs text-neutral-500">
                  {STAGE[row.stage]}
                  {row.stage === 'waiting' ? ` · ${row.availability ? `${row.availability} availability windows` : 'no availability set'}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
