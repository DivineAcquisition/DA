import Link from 'next/link';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '@/app/vistrial/components/ui';
import { listCaseFiles } from '@/lib/da/queries';
import RunSnapshotsButton from './components/RunSnapshotsButton';

export const dynamic = 'force-dynamic';

/**
 * Cross-client view: which engagements are performing, which are flat, and which
 * are missing a baseline or overdue a snapshot.
 */
export default async function AdminHome() {
  const caseFiles = await listCaseFiles();

  const missingBaseline = caseFiles.filter((row) => !row.has_baseline);
  const overdue = caseFiles.filter((row) => row.snapshot_overdue);
  const untagged = caseFiles.reduce((sum, row) => sum + Number(row.evidence_needing_metadata ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Engagements"
        title="Every client, and whether the work is showing"
        description="Growth against a locked baseline, the last time each was measured, and anything that needs attention before the next review."
        actions={
          <>
            <RunSnapshotsButton />
            <Link href="/da/new" className={`${btnPrimary} ${btnSizeSm}`}>
              New case file
            </Link>
          </>
        }
      />

      <StatGrid>
        <StatTile label="Engagements" value={String(caseFiles.length)} />
        <StatTile
          label="Missing a baseline"
          value={String(missingBaseline.length)}
          hint="Growth reporting is disabled without one"
          tone={missingBaseline.length > 0 ? 'critical' : 'good'}
        />
        <StatTile
          label="Snapshot overdue"
          value={String(overdue.length)}
          hint="Measured weekly"
          tone={overdue.length > 0 ? 'warning' : 'good'}
        />
        <StatTile
          label="Evidence untagged"
          value={String(untagged)}
          hint="Found in Drive, awaiting metadata"
          tone={untagged > 0 ? 'warning' : 'good'}
        />
      </StatGrid>

      {missingBaseline.length > 0 && (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
          <Badge tone="critical">No baseline</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            {missingBaseline.map((row) => row.name).join(', ')}{' '}
            {missingBaseline.length === 1 ? 'has' : 'have'} no baseline. Capture it during the audit, before
            anything is installed — every number reported later is a delta from it, so without one there is
            nothing to measure against.
          </p>
        </Panel>
      )}

      <section>
        <SectionHeader title="Case files" hint="Headline figure is monthly revenue against baseline." />

        {caseFiles.length === 0 ? (
          <EmptyState
            title="No engagements yet"
            detail="Create a case file to start recording an engagement."
            action={
              <Link href="/da/new" className={`${btnPrimary} ${btnSizeSm}`}>
                New case file
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {caseFiles.map((row) => {
              const change = row.headline_revenue_change_pct === null ? null : Number(row.headline_revenue_change_pct);
              const flat = change !== null && Math.abs(change) < 5;

              return (
                <li key={row.id}>
                  <Link href={`/da/${row.slug}`} className="panel panel-hover block rounded-2xl px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[15px] font-semibold text-white">{row.name}</h2>
                          <Badge tone={row.status === 'active' ? 'good' : row.status === 'audit' ? 'warning' : 'neutral'}>
                            {row.status}
                          </Badge>
                          {!row.has_baseline && <Badge tone="critical">No baseline</Badge>}
                          {row.snapshot_overdue && <Badge tone="warning">Snapshot overdue</Badge>}
                          {Number(row.evidence_needing_metadata ?? 0) > 0 && (
                            <Badge tone="warning">
                              {row.evidence_needing_metadata} untagged
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 text-sm text-neutral-500">{row.vertical}</p>
                        <p className="mt-2 text-xs text-neutral-600">
                          {row.last_period_end
                            ? `Last measured to ${row.last_period_end} · ${row.days_since_snapshot} days ago`
                            : 'Never measured'}
                          {' · '}
                          {row.effort_entry_count} effort entries · {row.milestone_count} milestones ·{' '}
                          {row.evidence_count} evidence items
                        </p>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        {change === null ? (
                          <p className="text-sm text-neutral-600">No growth figure yet</p>
                        ) : (
                          <>
                            <p
                              className={`text-xl font-semibold tabular-nums ${
                                flat ? 'text-flag-warning' : change > 0 ? 'text-flag-good' : 'text-flag-critical'
                              }`}
                            >
                              {change > 0 ? '+' : ''}
                              {change.toFixed(1)}%
                            </p>
                            <p className="text-[11px] text-neutral-600">
                              monthly revenue{flat ? ' · flat' : ''}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-white">What this system is for</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-neutral-400">
          <li>
            <span className="font-medium text-white">Proof the work produced growth.</span> A measured delta
            from a fixed starting point, which is what justifies the retainer at month three.
          </li>
          <li>
            <span className="font-medium text-white">A defensible record of what was done.</span> Timestamped,
            unedited, with evidence attached, so a dispute is answered from the log rather than from memory.
          </li>
          <li>
            <span className="font-medium text-white">Raw material for case studies.</span> Captured while the
            work is happening instead of reconstructed months later.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
