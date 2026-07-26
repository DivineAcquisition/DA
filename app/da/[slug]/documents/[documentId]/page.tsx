import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import DocumentView from '@/lib/documents/DocumentView';
import {
  DOCUMENT_STATE_LABEL,
  DOCUMENT_TYPE_LABEL,
  formatPeriod,
  formatShortDate,
} from '@/lib/documents/format';
import {
  archiveDocumentAction,
  correctDocumentAction,
  createCaseStudyAction,
  markCaseStudyReadyAction,
  publishDocumentAction,
  refreshBindingsAction,
  resolveFlagAction,
  setNarrativeAction,
  submitForReviewAction,
} from '@/lib/da/documentActions';
import { getDocument } from '@/lib/da/documents';
import AdminGate from '../../../components/AdminGate';
import AnonymisationPanel from '../../../components/AnonymisationPanel';
import DocumentActions from '../../../components/DocumentActions';
import NarrativeEditor from '../../../components/NarrativeEditor';

export const dynamic = 'force-dynamic';

const STATE_TONE = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'good',
  archived: 'neutral',
} as const;

const STATE_NOTE: Record<string, string> = {
  draft:
    'Generated from live data at a point in time. Narrative sections are yours to write, and the bound figures can be re-read but not overwritten. Only DA can see this.',
  in_review:
    'Locked for a final read. The preview below is exactly what the client receives, branding, pagination and any gaps included.',
  published:
    'Released and frozen, numbers included, even though the tracked record keeps moving. This is a statement of what was true on the day it was sent.',
  archived: 'Superseded or from an ended engagement. Still readable, no longer editable.',
};

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ slug: string; documentId: string }>;
}) {
  const { slug, documentId } = await params;
  const detail = await getDocument(documentId);
  if (!detail || detail.clientSlug !== slug) notFound();

  const { document, sections, prompts, flags, opens, deliveries, payload } = detail;
  const editable = document.state === 'draft';
  const narratives = sections.filter((section) => section.kind === 'narrative');
  const gaps = sections.filter((section) => section.has_gap);
  const openFlags = flags.filter((flag) => !flag.confirmed_at).length;

  return (
    <AdminGate>
      <div className="space-y-9">
        <div className="doc-hide-in-print space-y-9">
          <PageHeader
            eyebrow={`${detail.clientName} · ${DOCUMENT_TYPE_LABEL[document.type] ?? document.type}`}
            title={document.title}
            description={
              [
                formatPeriod(document.period_start, document.period_end),
                `template v${document.template_version}`,
                document.version > 1 ? `version ${document.version}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || undefined
            }
            actions={
              <Link href={`/da/${slug}/documents`} className={`${btnSecondary} ${btnSizeSm}`}>
                All documents
              </Link>
            }
          />

          <Panel className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATE_TONE[document.state as keyof typeof STATE_TONE]}>
                {DOCUMENT_STATE_LABEL[document.state] ?? document.state}
              </Badge>
              {document.is_case_study && <Badge tone="brand">Case study draft, internal only</Badge>}
              {document.superseded_by_id && <Badge tone="neutral">Superseded by a later version</Badge>}
              {gaps.length > 0 && <Badge tone="warning">{gaps.length} section(s) with gaps</Badge>}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-400">
              {STATE_NOTE[document.state]}
            </p>

            <div className="mt-5">
              <DocumentActions
                state={document.state}
                isCaseStudy={document.is_case_study}
                anonymisationConfirmed={Boolean(document.anonymisation_confirmed_at)}
                openFlags={openFlags}
                superseded={Boolean(document.superseded_by_id)}
                submitForReview={submitForReviewAction.bind(null, documentId, slug)}
                publish={publishDocumentAction.bind(null, documentId, slug)}
                archive={archiveDocumentAction.bind(null, documentId, slug)}
                correct={correctDocumentAction.bind(null, documentId, slug)}
                createCaseStudy={createCaseStudyAction.bind(null, documentId, slug)}
                markReady={markCaseStudyReadyAction.bind(null, documentId, slug)}
                refresh={refreshBindingsAction.bind(null, documentId, slug)}
              />
            </div>
          </Panel>

          {/* Rule 2, surfaced before a client sees it. A gap is a decision to make,
              not a defect to hide. */}
          {gaps.length > 0 && (
            <Panel className="border-flag-warning/25 bg-flag-warning/[0.05] px-5 py-4">
              <Badge tone="warning">Missing data</Badge>
              <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
                {gaps.map((section) => section.title).join(', ')} contain figures the tracked record does not have.
                They render as &ldquo;Not captured&rdquo; rather than as a zero, because a missing number and a zero
                mean completely different things. Either capture the data and re-read the figures, or address the gap
                in the narrative.
              </p>
            </Panel>
          )}

          {document.is_case_study && flags.length > 0 && (
            <section>
              <SectionHeader
                title="Identifying references"
                hint="Assisted, not automatic. The scanner over-flags on purpose and each one needs your decision."
              />
              <Panel className="p-5">
                <AnonymisationPanel
                  flags={flags}
                  editable={editable}
                  resolve={resolveFlagAction.bind(null, documentId, slug)}
                />
              </Panel>
            </section>
          )}

          {editable && narratives.length > 0 && (
            <section>
              <SectionHeader
                title="Narrative"
                hint="The system provides the structure and the data. The reading of it is yours, and it is not automated."
              />
              <div className="space-y-4">
                {narratives.map((section) => (
                  <Panel key={section.key} className="p-5">
                    <NarrativeEditor
                      sectionKey={section.key}
                      title={section.title}
                      prompt={prompts[section.key]?.body ?? null}
                      body={section.body}
                      required={prompts[section.key]?.required ?? false}
                      action={setNarrativeAction.bind(null, documentId, slug, section.key)}
                    />
                  </Panel>
                ))}
              </div>
            </section>
          )}

          {document.state === 'published' && (
            <section>
              <SectionHeader
                title="Delivery"
                hint="What happened at publication, and whether anyone read it."
              />
              <Panel className="p-5">
                <ul className="space-y-2">
                  {deliveries.map((delivery, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-2.5 text-sm text-neutral-300">
                      <Badge tone={delivery.status === 'delivered' ? 'good' : 'neutral'}>{delivery.channel}</Badge>
                      <span>{delivery.detail}</span>
                      <span className="text-xs text-neutral-600">{formatShortDate(delivery.delivered_at)}</span>
                    </li>
                  ))}
                  {deliveries.length === 0 && (
                    <li className="text-sm text-neutral-500">No delivery recorded.</li>
                  )}
                </ul>

                <div className="mt-5 border-t border-white/[0.06] pt-4">
                  {opens.length === 0 ? (
                    <p className="text-sm leading-relaxed text-flag-warning">
                      Not opened yet. A client who has not opened three monthly reports is telling you something
                      before they cancel.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-neutral-300">
                      Opened {opens.length} time{opens.length === 1 ? '' : 's'}, most recently{' '}
                      {formatShortDate(opens[0].opened_at)} via {opens[0].via.replace(/_/g, ' ')}.
                    </p>
                  )}
                </div>

                {document.drive_url && (
                  <a
                    href={document.drive_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`${btnSecondary} ${btnSizeSm} mt-4`}
                  >
                    Open the archived copy in Drive
                  </a>
                )}
              </Panel>
            </section>
          )}

          {document.supersedes_id && (
            <Link
              href={`/da/${slug}/documents/${document.supersedes_id}`}
              className="block text-sm text-brand-300 underline"
            >
              See the version this one corrects
            </Link>
          )}
          {document.superseded_by_id && (
            <Link
              href={`/da/${slug}/documents/${document.superseded_by_id}`}
              className="block text-sm text-brand-300 underline"
            >
              See the corrected version
            </Link>
          )}

          <SectionHeader
            title={document.state === 'draft' ? 'Preview' : 'As the client received it'}
            hint="The same renderer the client's copy uses. Print to see the running header and footer on every page."
          />
        </div>

        {payload ? (
          <div className="overflow-x-auto">
            <DocumentView payload={payload} />
          </div>
        ) : (
          <EmptyState title="Nothing to render" />
        )}
      </div>
    </AdminGate>
  );
}
