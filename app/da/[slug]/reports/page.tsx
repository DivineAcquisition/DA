import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  labelClass,
  selectClass,
} from '@/app/vistrial/components/ui';
import { generateReportAction } from '@/lib/da/actions';
import { getBaseline, getCaseFileBySlug, listEvidence, listReports } from '@/lib/da/queries';
import { ActionForm } from '../../components/ActionForm';
import PeriodInputs from '../../components/PeriodInputs';

export const dynamic = 'force-dynamic';

const MODES = [
  {
    value: 'client_facing',
    label: 'Client-facing',
    detail: 'The growth story, for a review or renewal. Effort log, scope disputes and internal notes excluded.',
  },
  {
    value: 'internal',
    label: 'Internal',
    detail: 'Everything, for preparing a difficult conversation or a renewal.',
  },
  {
    value: 'case_study_draft',
    label: 'Case study draft',
    detail: "The numbers and evidence with the client's identifying details replaced, so a result becomes a sales asset.",
  },
];

export default async function ReportsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [reports, evidence, baseline] = await Promise.all([
    listReports(caseFile.id),
    listEvidence(caseFile.id),
    getBaseline(caseFile.id),
  ]);

  const locked = Boolean(baseline?.snapshot.locked_at);
  const usable = evidence.filter((item) => !item.needs_metadata);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Growth report"
        description="The system's output. The baseline, the current numbers, the change for each metric, the milestones in the period, the effort delivered, and whichever evidence you include."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      {!locked ? (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
          <Badge tone="critical">No locked baseline</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            Reporting is disabled until the baseline is locked, because there is nothing fixed to measure the
            change against.
          </p>
        </Panel>
      ) : (
        <section>
          <SectionHeader title="Generate" />
          <Panel className="p-5">
            <ActionForm action={generateReportAction.bind(null, caseFile.id, slug)} submitLabel="Generate report">
              <div>
                <label className={labelClass} htmlFor="mode">
                  Mode *
                </label>
                <select id="mode" name="mode" defaultValue="client_facing" className={selectClass}>
                  {MODES.map((mode) => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label}
                    </option>
                  ))}
                </select>
                <ul className="mt-3 space-y-1.5">
                  {MODES.map((mode) => (
                    <li key={mode.value} className="text-xs leading-relaxed text-neutral-500">
                      <span className="font-medium text-neutral-300">{mode.label}:</span> {mode.detail}
                    </li>
                  ))}
                </ul>
              </div>

              <PeriodInputs preset="month" idPrefix="report-" />

              <div>
                <p className={labelClass}>Evidence to include</p>
                {usable.length === 0 ? (
                  <p className="text-xs text-neutral-600">
                    No tagged evidence yet. Items need what they prove and the date it happened first.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {usable.map((item) => (
                      <li key={item.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.07] px-3.5 py-2.5 hover:bg-white/[0.03]">
                          <input
                            type="checkbox"
                            name="evidence_ids"
                            value={item.id}
                            className="mt-0.5 h-4 w-4 accent-[#9a88fc]"
                          />
                          <span className="min-w-0">
                            <span className="block text-[13px] text-neutral-200">{item.what_it_proves}</span>
                            <span className="block text-[11px] text-neutral-600">
                              {item.filename} · {item.happened_on}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-xs leading-relaxed text-neutral-500">
                The report is archived exactly as generated, so there is a permanent record of precisely what a
                client was shown and when. Regenerating creates a new one rather than altering this.
              </p>
            </ActionForm>
          </Panel>
        </section>
      )}

      <section>
        <SectionHeader title="Archive" hint={`${reports.length} generated.`} />
        {reports.length === 0 ? (
          <EmptyState title="Nothing generated yet" />
        ) : (
          <ul className="space-y-2.5">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/da/${slug}/reports/${report.id}`}
                  className="panel panel-hover block rounded-2xl px-5 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={report.mode === 'client_facing' ? 'brand' : report.mode === 'internal' ? 'neutral' : 'good'}>
                        {report.mode.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-[13px] text-neutral-300">
                        {report.period_start} → {report.period_end}
                      </span>
                      {report.included_evidence_ids.length > 0 && (
                        <span className="text-[11px] text-neutral-600">
                          {report.included_evidence_ids.length} evidence items
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums text-neutral-600">
                      generated {report.generated_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
