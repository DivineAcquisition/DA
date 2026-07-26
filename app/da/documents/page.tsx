import Link from 'next/link';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { DOCUMENT_STATE_LABEL, DOCUMENT_TYPE_LABEL, formatShortDate } from '@/lib/documents/format';
import { listAllDocuments, listDocumentAttention } from '@/lib/da/documents';
import AdminGate from '../components/AdminGate';

export const dynamic = 'force-dynamic';

const STATE_TONE = {
  draft: 'neutral',
  in_review: 'warning',
  published: 'good',
  archived: 'neutral',
} as const;

/**
 * The register. The admin can always see, for any client, exactly which documents
 * were sent and when, and this is where that question is answered across every
 * engagement at once.
 */
export default async function DocumentRegister() {
  const [documents, attention] = await Promise.all([listAllDocuments(), listDocumentAttention()]);

  // Whether a monthly report is overdue is decided by the view, so this page stays
  // a pure function of its data.
  const needsWork = attention
    .map((row) => {
      const reasons: string[] = [];
      if (!row.has_baseline) reasons.push('no baseline, so growth reporting is disabled');
      if (row.monthly_overdue) {
        reasons.push(
          row.last_monthly_at
            ? `last monthly report was ${formatShortDate(row.last_monthly_at)}`
            : 'no monthly report has ever been produced',
        );
      }
      if ((row.awaiting_review ?? 0) > 0) reasons.push(`${row.awaiting_review} waiting on a final read`);
      if ((row.unopened_published ?? 0) > 0)
        reasons.push(`${row.unopened_published} published but never opened`);
      if ((row.unconfirmed_case_studies ?? 0) > 0)
        reasons.push(`${row.unconfirmed_case_studies} case study draft with unconfirmed identifiers`);

      return { ...row, reasons };
    })
    .filter((row) => row.reasons.length > 0);

  return (
    <AdminGate>
      <div className="space-y-9">
        <PageHeader
          eyebrow="Documents"
          title="What was sent, and when"
          description="Every document produced across every engagement. Producing a monthly report should take minutes of review rather than an afternoon of assembly, because the month it does not happen is exactly the month it matters."
        />

        <section>
          <SectionHeader
            title="Needs a look"
            hint="Ordered by what a client is waiting on, or telling you by not reading."
          />
          {needsWork.length === 0 ? (
            <Panel className="px-5 py-6">
              <p className="text-sm text-neutral-400">
                Nothing outstanding. Every active engagement has a baseline and a recent monthly report, and every
                published document has been opened.
              </p>
            </Panel>
          ) : (
            <ul className="space-y-2.5">
              {needsWork.map((row) => (
                <li key={row.case_file_id}>
                  <Link href={`/da/${row.client_slug}/documents`}>
                    <Panel className="panel-hover px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{row.client_name}</p>
                          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-neutral-400">
                            {row.reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                        <Badge tone={row.has_baseline ? 'warning' : 'critical'}>
                          {row.status === 'active' ? 'Active' : row.status}
                        </Badge>
                      </div>
                    </Panel>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionHeader title="Everything produced" hint={`${documents.length} document(s).`} />
          {documents.length === 0 ? (
            <EmptyState
              title="No documents yet"
              detail="Open a case file and generate one. An audit findings report works before an engagement exists."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                    <th className="py-2.5 pr-4 font-semibold">Client</th>
                    <th className="py-2.5 pr-4 font-semibold">Document</th>
                    <th className="py-2.5 pr-4 font-semibold">Sent</th>
                    <th className="py-2.5 pr-4 font-semibold">Opened</th>
                    <th className="py-2.5 font-semibold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-b border-white/[0.04]">
                      <td className="py-3 pr-4">
                        <Link href={`/da/${document.client_slug}/documents`} className="hover:text-brand-300">
                          {document.client_name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/da/${document.client_slug}/documents/${document.id}`}
                          className="text-white hover:text-brand-300"
                        >
                          {DOCUMENT_TYPE_LABEL[document.type ?? ''] ?? document.type}
                          {(document.version ?? 1) > 1 && ` v${document.version}`}
                        </Link>
                        {document.is_case_study && (
                          <span className="ml-2 text-xs text-brand-300">case study</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-neutral-400">
                        {document.published_at ? formatShortDate(document.published_at) : '—'}
                      </td>
                      <td className="py-3 pr-4 text-neutral-400">
                        {document.state !== 'published' || document.is_case_study
                          ? '—'
                          : (document.open_count ?? 0) > 0
                            ? `${document.open_count}× · ${formatShortDate(document.last_opened_at)}`
                            : 'Never'}
                      </td>
                      <td className="py-3">
                        <Badge tone={STATE_TONE[(document.state ?? 'draft') as keyof typeof STATE_TONE]}>
                          {DOCUMENT_STATE_LABEL[document.state ?? ''] ?? document.state}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminGate>
  );
}
