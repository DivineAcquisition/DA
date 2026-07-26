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
import { correctEffortAction, logEffortAction } from '@/lib/da/actions';
import { getCaseFileBySlug, listEffort, listSnapshots } from '@/lib/da/queries';
import { ActionForm, Disclosure, ImmutableNotice } from '../../components/ActionForm';

export const dynamic = 'force-dynamic';

export default async function EffortPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [effort, snapshots] = await Promise.all([listEffort(caseFile.id), listSnapshots(caseFile.id)]);

  const current = effort.filter((entry) => !entry.superseded_by_id);
  const superseded = new Map(effort.filter((entry) => entry.superseded_by_id).map((e) => [e.id, e]));

  // Work and result side by side: the effort for a month next to that month's
  // measurement, which is what answers "what am I paying for in a quiet month".
  const months = [...new Set(current.map((entry) => entry.performed_on.slice(0, 7)))].sort().reverse();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Effort log"
        description="Every piece of work performed, with the month's growth numbers beside it. This justifies the retainer in a quiet month and answers a dispute about whether work was delivered."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      <Disclosure label="Log work">
        <Panel className="p-5">
          <ActionForm action={logEffortAction.bind(null, caseFile.id, slug)} submitLabel="Log this work">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="performed_on">
                  Date *
                </label>
                <input id="performed_on" name="performed_on" type="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="phase">
                  Phase *
                </label>
                <input
                  id="phase"
                  name="phase"
                  required
                  className={inputClass}
                  placeholder="Audit, Install, Optimisation, Reporting"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="hours">
                  Hours
                </label>
                <input id="hours" name="hours" type="number" step="0.25" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="description">
                What was done *
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                required
                className={`${inputClass} resize-none`}
                placeholder="Specific enough to be useful six months from now."
              />
            </div>
            <ImmutableNotice>
              Saved entries cannot be edited. A change files a correction, and both versions stay visible.
            </ImmutableNotice>
          </ActionForm>
        </Panel>
      </Disclosure>

      {current.length === 0 ? (
        <EmptyState title="No work logged yet" />
      ) : (
        months.map((month) => {
          const entries = current.filter((entry) => entry.performed_on.startsWith(month));
          const measurement = snapshots.find((snapshot) => snapshot.period_end?.startsWith(month));
          const hours = entries.reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0);

          return (
            <section key={month}>
              <SectionHeader
                title={new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
                hint={`${entries.length} entries · ${hours} hours${
                  measurement ? ` · measured to ${measurement.period_end}` : ' · not measured this month'
                }`}
              />
              <ul className="space-y-2.5">
                {entries.map((entry) => {
                  const previous = entry.supersedes_id ? superseded.get(entry.supersedes_id) : undefined;
                  return (
                    <li key={entry.id}>
                      <Panel className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="brand">{entry.phase}</Badge>
                            {entry.version > 1 && <Badge tone="neutral">v{entry.version}</Badge>}
                            {entry.hours && (
                              <span className="text-[11px] text-neutral-600">{Number(entry.hours)}h</span>
                            )}
                          </div>
                          <span className="text-[11px] tabular-nums text-neutral-600">{entry.performed_on}</span>
                        </div>

                        <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{entry.description}</p>

                        {entry.correction_reason && (
                          <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                              Correction reason
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-brand-50">
                              {entry.correction_reason}
                            </p>
                          </div>
                        )}

                        {previous && (
                          <div className="mt-3 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-600">
                              Version {previous.version}, superseded
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500 line-through decoration-neutral-700">
                              {previous.description}
                            </p>
                          </div>
                        )}

                        <div className="mt-3.5">
                          <Disclosure label="File a correction" tone="neutral">
                            <ActionForm
                              variant="secondary"
                              submitLabel="File correction"
                              action={correctEffortAction.bind(null, entry.id, slug)}
                            >
                              <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                  <label className={labelClass} htmlFor={`d-${entry.id}`}>
                                    Date
                                  </label>
                                  <input
                                    id={`d-${entry.id}`}
                                    name="performed_on"
                                    type="date"
                                    defaultValue={entry.performed_on}
                                    required
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className={labelClass} htmlFor={`p-${entry.id}`}>
                                    Phase
                                  </label>
                                  <input
                                    id={`p-${entry.id}`}
                                    name="phase"
                                    defaultValue={entry.phase}
                                    required
                                    className={inputClass}
                                  />
                                </div>
                                <div>
                                  <label className={labelClass} htmlFor={`h-${entry.id}`}>
                                    Hours
                                  </label>
                                  <input
                                    id={`h-${entry.id}`}
                                    name="hours"
                                    type="number"
                                    step="0.25"
                                    defaultValue={entry.hours ?? ''}
                                    className={inputClass}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={labelClass} htmlFor={`desc-${entry.id}`}>
                                  Corrected description
                                </label>
                                <textarea
                                  id={`desc-${entry.id}`}
                                  name="description"
                                  rows={3}
                                  defaultValue={entry.description}
                                  required
                                  className={`${inputClass} resize-none`}
                                />
                              </div>
                              <div>
                                <label className={labelClass} htmlFor={`r-${entry.id}`}>
                                  Why the correction *
                                </label>
                                <input
                                  id={`r-${entry.id}`}
                                  name="reason"
                                  required
                                  className={inputClass}
                                  placeholder="Required. Without it the version history proves nothing."
                                />
                              </div>
                            </ActionForm>
                          </Disclosure>
                        </div>
                      </Panel>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
