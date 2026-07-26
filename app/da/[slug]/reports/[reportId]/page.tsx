import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { getReport } from '@/lib/da/queries';
import { changeLabel, formatMetric } from '../../../components/growth';

export const dynamic = 'force-dynamic';

type Payload = {
  mode: string;
  generated_at: string;
  period: { start: string; end: string };
  client: { name: string; anonymised: boolean; vertical: string | null; contact_name?: string | null };
  baseline: { taken_at: string; locked_at: string | null; tooling: string[] };
  metrics: {
    metric_key: string;
    label: string;
    unit: string;
    baseline_value: number | null;
    current_value: number | null;
    percent_change: number | null;
    improved: boolean | null;
    baseline_source: string;
  }[];
  milestones: { occurred_on: string; title: string; description: string | null; auto_generated: boolean }[];
  snapshots: { taken_at: string; period_start: string; period_end: string; annotations: string[] }[];
  evidence: { id: string; filename: string; what_it_proves: string; happened_on: string; drive_url: string | null }[];
  effort: { performed_on: string; phase: string; description: string; hours: number | null }[] | null;
  scope: { requested_on: string; summary: string; verdict: string; reason: string }[] | null;
  decisions: {
    decided_on: string;
    decided_by: string;
    what_was_decided: string;
    reasoning: string;
    against_recommendation: boolean;
  }[] | null;
  internal_notes: string | null;
};

/**
 * Renders the archived payload rather than re-querying. Rule 7: this is exactly
 * what was shown at the time, and it does not drift as the underlying data moves.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ slug: string; reportId: string }>;
}) {
  const { slug, reportId } = await params;
  const report = await getReport(reportId);
  if (!report) notFound();

  const payload = report.payload as unknown as Payload;
  const improved = payload.metrics.filter((metric) => metric.improved === true);
  const worsened = payload.metrics.filter((metric) => metric.improved === false);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${payload.mode.replace(/_/g, ' ')} report`}
        title={payload.client.name}
        description={`${payload.period.start} to ${payload.period.end} · generated ${payload.generated_at.slice(0, 16).replace('T', ' ')}`}
        actions={
          <>
            {report.drive_url && (
              <a
                href={report.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnSecondary} ${btnSizeSm}`}
              >
                Open in Drive
              </a>
            )}
            <Link href={`/da/${slug}/reports`} className={`${btnSecondary} ${btnSizeSm}`}>
              All reports
            </Link>
          </>
        }
      />

      <Panel className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Archived exactly as sent</Badge>
          {payload.client.anonymised && <Badge tone="good">client anonymised</Badge>}
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">
          This page renders the payload stored at generation time, not a fresh query. The numbers here are what
          the client saw on {payload.generated_at.slice(0, 10)}, and they will not change as the underlying data
          moves on. Baseline locked {payload.baseline.locked_at?.slice(0, 10) ?? 'not locked'}.
        </p>
      </Panel>

      <section>
        <SectionHeader
          title="Growth against baseline"
          hint={`${improved.length} improved, ${worsened.length} moved the wrong way.`}
        />
        <Panel className="px-5 py-2">
          {payload.metrics.map((metric) => (
            <div
              key={metric.metric_key}
              className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/[0.05] py-3.5 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-white">{metric.label}</p>
                {metric.baseline_source === 'client_estimate' && (
                  <p className="mt-0.5 text-[11px] text-flag-warning">
                    baseline was the client&apos;s estimate
                  </p>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-[13px] tabular-nums text-neutral-500">
                  {formatMetric(metric.baseline_value, metric.unit)}
                </span>
                <span className="text-neutral-700">→</span>
                <span className="text-[13px] font-semibold tabular-nums text-white">
                  {formatMetric(metric.current_value, metric.unit)}
                </span>
                {metric.improved !== null && (
                  <Badge tone={metric.improved ? 'good' : 'critical'}>
                    {changeLabel({ percent_change: metric.percent_change } as never)}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </Panel>
      </section>

      {payload.milestones.length > 0 && (
        <section>
          <SectionHeader title="What happened in the period" />
          <ol className="space-y-2">
            {payload.milestones.map((milestone, index) => (
              <li key={index}>
                <Panel className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{milestone.title}</p>
                    <span className="text-[11px] tabular-nums text-neutral-600">{milestone.occurred_on}</span>
                  </div>
                  {milestone.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{milestone.description}</p>
                  )}
                </Panel>
              </li>
            ))}
          </ol>
        </section>
      )}

      {payload.evidence.length > 0 && (
        <section>
          <SectionHeader title="Evidence" />
          <ul className="space-y-2">
            {payload.evidence.map((item) => (
              <li key={item.id}>
                <Panel className="px-5 py-3.5">
                  <p className="text-[13px] leading-relaxed text-neutral-200">{item.what_it_proves}</p>
                  <p className="mt-1 text-[11px] text-neutral-600">
                    {item.filename} · {item.happened_on}
                  </p>
                  {item.drive_url && (
                    <a
                      href={item.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-semibold text-brand-300 hover:text-brand-200"
                    >
                      Open in Drive
                    </a>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.snapshots.some((snapshot) => snapshot.annotations.length > 0) && (
        <section>
          <SectionHeader title="Notes on the measurements" />
          <ul className="space-y-2">
            {payload.snapshots
              .filter((snapshot) => snapshot.annotations.length > 0)
              .map((snapshot, index) => (
                <li key={index}>
                  <Panel className="px-5 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                      {snapshot.period_start} → {snapshot.period_end}
                    </p>
                    {snapshot.annotations.map((note, noteIndex) => (
                      <p key={noteIndex} className="mt-1.5 text-[13px] leading-relaxed text-neutral-300">
                        {note}
                      </p>
                    ))}
                  </Panel>
                </li>
              ))}
          </ul>
        </section>
      )}

      {/* Internal-only blocks. Absent from a client-facing payload entirely. */}
      {payload.effort && (
        <section>
          <SectionHeader title="Effort delivered" hint="Internal only." />
          <Panel className="px-5 py-2">
            {payload.effort.map((entry, index) => (
              <div key={index} className="border-t border-white/[0.05] py-3 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="brand">{entry.phase}</Badge>
                  <span className="text-[11px] tabular-nums text-neutral-600">
                    {entry.performed_on}
                    {entry.hours ? ` · ${entry.hours}h` : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-300">{entry.description}</p>
              </div>
            ))}
          </Panel>
        </section>
      )}

      {payload.scope && payload.scope.length > 0 && (
        <section>
          <SectionHeader title="Scope requests" hint="Internal only." />
          <Panel className="px-5 py-2">
            {payload.scope.map((request, index) => (
              <div key={index} className="border-t border-white/[0.05] py-3 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={request.verdict === 'in_scope' ? 'good' : 'warning'}>
                    {request.verdict.replace('_', ' ')}
                  </Badge>
                  <span className="text-[11px] tabular-nums text-neutral-600">{request.requested_on}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-neutral-200">{request.summary}</p>
                <p className="mt-1 text-xs text-neutral-500">{request.reason}</p>
              </div>
            ))}
          </Panel>
        </section>
      )}

      {payload.decisions && payload.decisions.length > 0 && (
        <section>
          <SectionHeader title="Decisions" hint="Internal only." />
          <Panel className="px-5 py-2">
            {payload.decisions.map((decision, index) => (
              <div key={index} className="border-t border-white/[0.05] py-3 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{decision.decided_by}</Badge>
                    {decision.against_recommendation && (
                      <Badge tone="critical">against our recommendation</Badge>
                    )}
                  </div>
                  <span className="text-[11px] tabular-nums text-neutral-600">{decision.decided_on}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-neutral-200">{decision.what_was_decided}</p>
                <p className="mt-1 text-xs text-neutral-500">{decision.reasoning}</p>
              </div>
            ))}
          </Panel>
        </section>
      )}

      {payload.internal_notes && (
        <section>
          <SectionHeader title="Internal notes" />
          <Panel className="p-5 text-sm leading-relaxed text-neutral-300">{payload.internal_notes}</Panel>
        </section>
      )}

      {payload.mode === 'client_facing' && (
        <Panel className="p-5">
          <p className="text-xs leading-relaxed text-neutral-500">
            The effort log, the scope requests, the decisions log and the internal notes are not in this
            payload at all — a client-facing report is the growth story, and the rest is for preparing the
            conversation, not for having it.
          </p>
        </Panel>
      )}
    </div>
  );
}
