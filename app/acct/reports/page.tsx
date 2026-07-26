import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { DOCUMENT_TYPE_LABEL, formatDate, formatPeriod } from '@/lib/documents/format';
import { getMyAccount, getPublishedDocuments } from '@/lib/acct/queries';

export const dynamic = 'force-dynamic';

export default async function ClientReports() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const documents = await getPublishedDocuments(account.case_file_id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="What DA has sent you"
        description="Each of these is a fixed record of the numbers as they stood on the day it was produced, not a live view. Your current figures are always on the overview."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          title="Nothing published yet"
          detail="Reports arrive here ahead of a review, and you will be notified when one does. Your live numbers are on the overview in the meantime."
        />
      ) : (
        <section>
          <SectionHeader title="Published" hint={`${documents.length} document(s).`} />
          <ul className="space-y-2.5">
            {documents.map((document) => (
              <li key={document.id}>
                <Link href={`/acct/reports/${document.id}`}>
                  <Panel className="panel-hover px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {document.title}
                          {document.version > 1 && (
                            <span className="ml-2 text-xs font-normal text-brand-300">
                              version {document.version}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {formatPeriod(document.period_start, document.period_end) ??
                            DOCUMENT_TYPE_LABEL[document.type] ??
                            document.type}
                          {document.published_at && ` · sent ${formatDate(document.published_at)}`}
                        </p>
                        {document.correction_note && (
                          <p className="mt-1.5 text-xs leading-relaxed text-brand-300">
                            Correction: {document.correction_note}
                          </p>
                        )}
                      </div>
                      <Badge tone="brand">{DOCUMENT_TYPE_LABEL[document.type] ?? document.type}</Badge>
                    </div>
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
