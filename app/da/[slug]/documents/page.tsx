import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  labelClass,
  selectClass,
} from '@/app/vistrial/components/ui';
import { DOCUMENT_STATE_LABEL, DOCUMENT_TYPE_LABEL, formatPeriod, formatShortDate } from '@/lib/documents/format';
import { generateDocumentAction } from '@/lib/da/documentActions';
import { listDocuments, listTemplates } from '@/lib/da/documents';
import { getBaseline, getCaseFileBySlug } from '@/lib/da/queries';
import AdminGate from '../../components/AdminGate';
import { ActionForm, Disclosure } from '../../components/ActionForm';
import PeriodInputs from '../../components/PeriodInputs';

export const dynamic = 'force-dynamic';

const TYPE_NOTES: Record<string, string> = {
  audit_findings:
    'Pre-sale. Shows a prospect where their operation is leaking and what it costs. Reads the baseline capture, so it works before an engagement exists.',
  install_completion:
    'Delivered at handover. What was built, what is running, and where to look. Doubles as the client reference document.',
  monthly_performance:
    'The recurring deliverable. Period figures, movement against the baseline, and the milestones reached.',
  quarterly_review:
    'Deeper than monthly, aimed at the renewal. The full arc from baseline with the milestone timeline and selected evidence.',
  proposal_scope: 'Sent when an engagement is being scoped or extended, or an out of scope request is quoted.',
};

const STATE_TONE = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'good',
  archived: 'neutral',
} as const;

export default async function DocumentsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [documents, templates, baseline] = await Promise.all([
    listDocuments(caseFile.id),
    listTemplates(),
    getBaseline(caseFile.id),
  ]);

  const hasBaseline = Boolean(baseline);
  const live = documents.filter((document) => !document.is_case_study);
  const caseStudies = documents.filter((document) => document.is_case_study);

  return (
    <AdminGate>
      <div className="space-y-9">
        <PageHeader
          eyebrow={caseFile.name}
          title="Documents"
          description="Every document this client is sent, generated from the tracked record rather than assembled by hand. Numbers come from the same figures their dashboard reads, so the two cannot disagree."
          actions={
            <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
              Back to case file
            </Link>
          }
        />

        {!hasBaseline && (
          <Panel className="border-flag-warning/25 bg-flag-warning/[0.05] px-5 py-4">
            <Badge tone="warning">No baseline captured</Badge>
            <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
              A monthly or quarterly report will refuse to generate until the baseline exists, because growth
              against nothing is not a number.{' '}
              <Link href={`/da/${slug}/baseline`} className="text-brand-300 underline">
                Capture the baseline
              </Link>
              . An audit findings report reads the baseline too, so start there either way.
            </p>
          </Panel>
        )}

        <section>
          <SectionHeader
            title="Generate"
            hint="Bound figures resolve at generation. Narrative sections are yours to write, because the reading of the numbers is DA's judgment."
          />
          <Panel className="p-5">
            <Disclosure label="New document">
              <ActionForm
                action={generateDocumentAction.bind(null, caseFile.id, slug)}
                submitLabel="Generate draft"
              >
                <div>
                  <label className={labelClass} htmlFor="type">
                    Document type
                  </label>
                  <select id="type" name="type" required className={selectClass} defaultValue="monthly_performance">
                    {templates.map((template) => (
                      <option key={template.id} value={template.type}>
                        {DOCUMENT_TYPE_LABEL[template.type] ?? template.type} (template v{template.version})
                      </option>
                    ))}
                  </select>
                  <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-neutral-500">
                    {templates.map((template) => (
                      <li key={template.id}>
                        <span className="font-semibold text-neutral-400">
                          {DOCUMENT_TYPE_LABEL[template.type] ?? template.type}:
                        </span>{' '}
                        {TYPE_NOTES[template.type]}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label className={labelClass} htmlFor="title">
                    Title on the cover
                  </label>
                  <input
                    id="title"
                    name="title"
                    placeholder="Leave blank to use the template name"
                    className={selectClass}
                  />
                </div>

                <PeriodInputs preset="month" />

                <label className="flex items-start gap-2.5 text-sm text-neutral-300">
                  <input type="checkbox" name="include_effort" className="mt-1 accent-brand-500" />
                  <span>
                    Include the work delivered
                    <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                      Adds the effort log for the period, which justifies the retainer in a quiet month. Left off,
                      the report says the work log was not included rather than showing an empty section.
                    </span>
                  </span>
                </label>
              </ActionForm>
            </Disclosure>
          </Panel>
        </section>

        <section>
          <SectionHeader
            title="On record"
            hint="What was sent and when, including every corrected version. Published documents are frozen."
          />
          {live.length === 0 ? (
            <EmptyState
              title="No documents produced yet"
              detail="Start with the audit findings report if this is a prospect, or a monthly performance report once a month of tracking exists."
            />
          ) : (
            <ul className="space-y-2.5">
              {live.map((document) => (
                <li key={document.id}>
                  <Link href={`/da/${slug}/documents/${document.id}`}>
                    <Panel className="panel-hover px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">
                            {document.title}
                            {(document.version ?? 1) > 1 && (
                              <span className="ml-2 text-xs font-normal text-brand-300">
                                version {document.version}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-neutral-500">
                            {DOCUMENT_TYPE_LABEL[document.type ?? ''] ?? document.type}
                            {formatPeriod(document.period_start, document.period_end) &&
                              ` · ${formatPeriod(document.period_start, document.period_end)}`}
                            {document.published_at
                              ? ` · sent ${formatShortDate(document.published_at)}`
                              : ` · generated ${formatShortDate(document.generated_at)}`}
                          </p>
                          {document.correction_note && (
                            <p className="mt-1.5 text-xs leading-relaxed text-brand-300">
                              Correction: {document.correction_note}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {(document.sections_with_gaps ?? 0) > 0 && (
                            <Badge tone="warning">{document.sections_with_gaps} with gaps</Badge>
                          )}
                          {document.state === 'published' &&
                            ((document.open_count ?? 0) > 0 ? (
                              <Badge tone="good">Opened {document.open_count}×</Badge>
                            ) : (
                              <Badge tone="critical">Not opened</Badge>
                            ))}
                          {document.superseded_by_id && <Badge tone="neutral">Superseded</Badge>}
                          <Badge tone={STATE_TONE[(document.state ?? 'draft') as keyof typeof STATE_TONE]}>
                            {DOCUMENT_STATE_LABEL[document.state ?? ''] ?? document.state}
                          </Badge>
                        </div>
                      </div>
                    </Panel>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {caseStudies.length > 0 && (
          <section>
            <SectionHeader
              title="Case study drafts"
              hint="Internal only. These never publish to a client account, and cannot be marked ready until every flagged identifier has a decision."
            />
            <ul className="space-y-2.5">
              {caseStudies.map((document) => (
                <li key={document.id}>
                  <Link href={`/da/${slug}/documents/${document.id}`}>
                    <Panel className="panel-hover px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{document.title}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            Generated {formatShortDate(document.generated_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {(document.open_flags ?? 0) > 0 ? (
                            <Badge tone="warning">{document.open_flags} to confirm</Badge>
                          ) : (
                            <Badge tone="good">Anonymisation confirmed</Badge>
                          )}
                          <Badge tone="brand">Case study</Badge>
                        </div>
                      </div>
                    </Panel>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs leading-relaxed text-neutral-600">
          A published document is a statement of what was true on a date, not a live view. Its figures freeze at
          publication even though the tracked record keeps moving, and a document that turns out to be wrong is
          corrected by publishing a new version with a visible note rather than by editing the original.
        </p>

        <Link href={`/da/${slug}/reports`} className={`${btnPrimary} ${btnSizeSm}`}>
          Internal growth payloads
        </Link>
      </div>
    </AdminGate>
  );
}
