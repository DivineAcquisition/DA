import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  inputClass,
  labelClass,
} from '@/app/vistrial/components/ui';
import { takeSnapshotAction } from '@/lib/da/actions';
import {
  getBaseline,
  getCaseFileBySlug,
  getGrowth,
  getMetricDefinitions,
  getSeries,
  listSnapshots,
} from '@/lib/da/queries';
import { ActionForm, Disclosure } from '../../components/ActionForm';
import AnnotateForm from '../../components/AnnotateForm';
import PeriodInputs from '../../components/PeriodInputs';
import { GrowthTable, SeriesBars, formatMetric } from '../../components/growth';

export const dynamic = 'force-dynamic';

export default async function ProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [baseline, snapshots, growth, definitions] = await Promise.all([
    getBaseline(caseFile.id),
    listSnapshots(caseFile.id),
    getGrowth(caseFile.id),
    getMetricDefinitions(),
  ]);

  const locked = Boolean(baseline?.snapshot.locked_at);

  // Direction of travel for the three metrics that carry the argument.
  const seriesKeys = ['monthly_revenue', 'avg_lead_response_minutes', 'booking_rate'];
  const series = locked
    ? await Promise.all(
        seriesKeys.map(async (key) => ({
          key,
          definition: definitions.find((d) => d.key === key)!,
          points: await getSeries(caseFile.id, key),
        })),
      )
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Progress"
        description="The same metrics as the baseline, measured again so every snapshot is directly comparable. Taken automatically each week; immutable once taken."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      {!locked ? (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
          <Badge tone="critical">Baseline not locked</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            Progress cannot be measured until the baseline is locked, because there would be nothing fixed to
            measure against.
          </p>
          <Link href={`/da/${slug}/baseline`} className={`${btnSecondary} ${btnSizeSm} mt-4`}>
            Go to the baseline
          </Link>
        </Panel>
      ) : (
        <>
          <section>
            <SectionHeader title="Against baseline" />
            <GrowthTable rows={growth} />
          </section>

          <section>
            <SectionHeader title="Direction of travel" hint="Baseline first, then every snapshot in order." />
            <div className="grid gap-3 lg:grid-cols-3">
              {series.map((item) => (
                <Panel key={item.key} className="p-5">
                  <p className="text-[13px] font-medium text-white">{item.definition.label}</p>
                  <p className="mt-0.5 mb-3 text-xs text-neutral-600">
                    {item.points.length} readings ·{' '}
                    {formatMetric(
                      item.points.length ? Number(item.points[item.points.length - 1].value) : null,
                      item.definition.unit,
                    )}{' '}
                    now
                  </p>
                  <SeriesBars
                    points={item.points.map((point) => ({
                      value: point.value === null ? null : Number(point.value),
                      period_end: point.period_end,
                      kind: point.kind,
                    }))}
                    unit={item.definition.unit}
                    direction={item.definition.direction}
                  />
                </Panel>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader
              title="Take a snapshot"
              hint="Prompted at month end. Values are pulled from the ingested tracking data for the period."
            />
            <Disclosure label="Take a manual snapshot">
              <Panel className="p-5">
                <ActionForm
                  action={takeSnapshotAction.bind(null, caseFile.id, slug)}
                  submitLabel="Take snapshot and lock it"
                >
                  <PeriodInputs preset="week" idPrefix="snapshot-" />
                  <div>
                    <label className={labelClass} htmlFor="notes">
                      Notes
                    </label>
                    <input id="notes" name="notes" className={inputClass} placeholder="Optional context" />
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    The snapshot locks the moment it is taken. If it turns out to cover an anomaly, annotate it
                    afterwards — the numbers themselves never change.
                  </p>
                </ActionForm>
              </Panel>
            </Disclosure>
          </section>

          <section>
            <SectionHeader title="Snapshot history" hint={`${snapshots.length} taken.`} />
            {snapshots.length === 0 ? (
              <EmptyState title="No snapshots yet" />
            ) : (
              <ul className="space-y-2.5">
                {snapshots.map((snapshot) => {
                  const annotations = (snapshot.snapshot_annotation ?? []) as {
                    id: string;
                    body: string;
                    created_at: string;
                  }[];

                  return (
                    <li key={snapshot.id}>
                      <Panel className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                              {snapshot.period_start} → {snapshot.period_end}
                            </p>
                            <Badge tone={snapshot.trigger === 'automatic' ? 'neutral' : 'brand'}>
                              {snapshot.trigger}
                            </Badge>
                            <Badge tone="neutral">locked</Badge>
                          </div>
                          <span className="text-[11px] tabular-nums text-neutral-600">
                            taken {snapshot.taken_at.slice(0, 10)}
                          </span>
                        </div>

                        {snapshot.notes && (
                          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{snapshot.notes}</p>
                        )}

                        {annotations.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {annotations.map((note) => (
                              <li
                                key={note.id}
                                className="rounded-xl border border-flag-warning/20 bg-flag-warning/[0.06] px-3.5 py-2.5"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-flag-warning">
                                  Annotation
                                </p>
                                <p className="mt-1 text-[13px] leading-relaxed text-neutral-200">{note.body}</p>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-3.5">
                          <Disclosure label="Annotate" tone="neutral">
                            <AnnotateForm snapshotId={snapshot.id} slug={slug} />
                          </Disclosure>
                        </div>
                      </Panel>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
