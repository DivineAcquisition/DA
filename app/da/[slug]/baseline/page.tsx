import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  PageHeader,
  Panel,
  SectionHeader,
  inputClass,
  labelClass,
  selectClass,
} from '@/app/vistrial/components/ui';
import { captureBaselineAction } from '@/lib/da/actions';
import { getBaseline, getCaseFileBySlug, getMetricDefinitions } from '@/lib/da/queries';
import { ActionForm } from '../../components/ActionForm';
import AnnotateForm from '../../components/AnnotateForm';
import { formatMetric } from '../../components/growth';

export const dynamic = 'force-dynamic';

const LEAD_SOURCES = ['Meta Ads', 'Google Ads', 'Organic / referral', 'Walk-in', 'Other'];

export default async function BaselinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [baseline, definitions] = await Promise.all([getBaseline(caseFile.id), getMetricDefinitions()]);
  const locked = Boolean(baseline?.snapshot.locked_at);
  const existing = new Map((baseline?.metrics ?? []).map((metric) => [metric.metric_key, metric]));
  const existingSources = new Map((baseline?.leadSources ?? []).map((row) => [row.source, row]));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Baseline"
        description="The client's starting position across every metric the engagement will be judged on, captured during the audit before anything is installed."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      {locked ? (
        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">Locked</Badge>
            <span className="text-xs text-neutral-500">
              Captured {baseline!.snapshot.taken_at.slice(0, 10)} · locked{' '}
              {baseline!.snapshot.locked_at!.slice(0, 10)}
            </span>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-400">
            The install has begun, so this is frozen. It cannot be edited by anyone, including directly in the
            database — the triggers refuse it. A baseline that can be adjusted after the fact is worthless as
            proof, so annotation is the only thing left.
          </p>
        </Panel>
      ) : (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">Open for editing</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            Still editable because the install has not begun. Get it right now: the moment you begin the
            install it locks permanently, and progress snapshots cannot be taken until it does.
          </p>
        </Panel>
      )}

      {locked ? (
        <section>
          <SectionHeader title="Starting position" hint="What we measured, and what the client estimated." />
          <Panel className="px-5 py-2">
            {definitions.map((definition) => {
              const metric = existing.get(definition.key);
              return (
                <div
                  key={definition.key}
                  className="flex flex-col gap-1 border-t border-white/[0.05] py-3.5 first:border-t-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white">{definition.label}</p>
                    {metric?.measurement_note && (
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">{metric.measurement_note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {metric?.source === 'client_estimate' && (
                      <Badge tone="warning">client&apos;s estimate</Badge>
                    )}
                    <span className="text-[15px] font-semibold tabular-nums text-white">
                      {formatMetric(metric?.value === undefined || metric.value === null ? null : Number(metric.value), definition.unit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </Panel>

          {baseline!.leadSources.length > 0 && (
            <div className="mt-5">
              <SectionHeader title="Leads by source" />
              <Panel className="px-5 py-2">
                {baseline!.leadSources.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-baseline justify-between border-t border-white/[0.05] py-3 first:border-t-0"
                  >
                    <span className="text-[13px] text-neutral-300">{row.source}</span>
                    <span className="text-[13px] tabular-nums text-white">
                      {row.leads_per_month === null ? '—' : Number(row.leads_per_month).toLocaleString()} / mo
                    </span>
                  </div>
                ))}
              </Panel>
            </div>
          )}

          {baseline!.snapshot.tooling.length > 0 && (
            <div className="mt-5">
              <SectionHeader title="Tools they were running" />
              <div className="flex flex-wrap gap-2">
                {baseline!.snapshot.tooling.map((tool) => (
                  <Badge key={tool} tone="neutral">
                    {tool}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {baseline!.snapshot.notes && (
            <div className="mt-5">
              <SectionHeader title="Audit notes" />
              <Panel className="p-5 text-sm leading-relaxed text-neutral-300">{baseline!.snapshot.notes}</Panel>
            </div>
          )}

          <div className="mt-6">
            <SectionHeader
              title="Annotations"
              hint="The only permitted change to a locked baseline. Numbers stay as measured."
            />
            {baseline!.annotations.length > 0 && (
              <ul className="mb-4 space-y-2">
                {baseline!.annotations.map((note) => (
                  <li key={note.id}>
                    <Panel className="px-5 py-3.5">
                      <p className="text-[13px] leading-relaxed text-neutral-300">{note.body}</p>
                      <p className="mt-1.5 text-[11px] text-neutral-600">{note.created_at.slice(0, 16).replace('T', ' ')}</p>
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
            <AnnotateForm snapshotId={baseline!.snapshot.id} slug={slug} />
          </div>
        </section>
      ) : (
        <Panel className="p-6">
          <ActionForm
            action={captureBaselineAction.bind(null, caseFile.id, slug)}
            submitLabel="Save baseline"
          >
            <p className="text-xs leading-relaxed text-neutral-500">
              For each metric, record the value and whether it is a number you measured or the client&apos;s
              estimate. That distinction matters later: a client&apos;s guess at their own response time is
              usually wrong by a wide margin, and you need to know which figures you can defend.
            </p>

            {definitions.map((definition) => {
              const metric = existing.get(definition.key);
              return (
                <div key={definition.key} className="border-t border-white/[0.05] pt-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                      <label className={labelClass} htmlFor={`metric.${definition.key}`}>
                        {definition.label} <span className="text-neutral-600">({definition.unit})</span>
                      </label>
                      <input
                        id={`metric.${definition.key}`}
                        name={`metric.${definition.key}`}
                        type="number"
                        step="0.01"
                        defaultValue={metric?.value ?? ''}
                        className={inputClass}
                      />
                      {definition.help && (
                        <p className="mt-1 text-xs leading-relaxed text-neutral-600">{definition.help}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`source.${definition.key}`}>
                        How measured
                      </label>
                      <select
                        id={`source.${definition.key}`}
                        name={`source.${definition.key}`}
                        defaultValue={metric?.source ?? 'measured'}
                        className={selectClass}
                      >
                        <option value="measured">Measured</option>
                        <option value="client_estimate">Client&apos;s estimate</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`note.${definition.key}`}>
                        Note
                      </label>
                      <input
                        id={`note.${definition.key}`}
                        name={`note.${definition.key}`}
                        defaultValue={metric?.measurement_note ?? ''}
                        className={inputClass}
                        placeholder="How this was arrived at"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="border-t border-white/[0.05] pt-4">
              <p className={labelClass}>Leads per month by source, where known</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {LEAD_SOURCES.map((source) => (
                  <div key={source}>
                    <label className="mb-1 block text-xs text-neutral-500" htmlFor={`leadsource.${source}`}>
                      {source}
                    </label>
                    <input
                      id={`leadsource.${source}`}
                      name={`leadsource.${source}`}
                      type="number"
                      step="1"
                      defaultValue={existingSources.get(source)?.leads_per_month ?? ''}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.05] pt-4">
              <label className={labelClass} htmlFor="tooling">
                Tools they currently run
              </label>
              <input
                id="tooling"
                name="tooling"
                defaultValue={(baseline?.snapshot.tooling ?? []).join(', ')}
                className={inputClass}
                placeholder="GoHighLevel, Square Appointments, Mailchimp"
              />
              <p className="mt-1 text-xs text-neutral-600">Comma separated.</p>
            </div>

            <div>
              <label className={labelClass} htmlFor="notes">
                Audit notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={baseline?.snapshot.notes ?? ''}
                className={`${inputClass} resize-none`}
                placeholder="What the audit found, and which numbers make the case."
              />
            </div>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
