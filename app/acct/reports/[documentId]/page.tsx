import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import DocumentView from '@/lib/documents/DocumentView';
import { asPayload } from '@/lib/documents/payload';
import { recordDocumentOpenAction } from '@/lib/acct/actions';
import { getPublishedDocument } from '@/lib/acct/queries';
import DocumentReader from '../../components/DocumentReader';

export const dynamic = 'force-dynamic';

export default async function ClientDocument({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;

  // RLS decides this, not the route: a client reaches only their own engagement's
  // published documents, and never a case study draft.
  const document = await getPublishedDocument(documentId);
  if (!document) notFound();

  const payload = asPayload(document.frozen_payload);
  if (!payload) notFound();

  return (
    <div className="space-y-6">
      <div className="doc-hide-in-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/acct/reports" className={`${btnSecondary} ${btnSizeSm}`}>
          All reports
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {document.drive_url && (
            <a
              href={document.drive_url}
              target="_blank"
              rel="noreferrer"
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              Open in Google Drive
            </a>
          )}
          <DocumentReader recordOpen={recordDocumentOpenAction.bind(null, documentId)} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <DocumentView payload={payload} />
      </div>

      <p className="doc-hide-in-print text-xs leading-relaxed text-neutral-600">
        This report is a fixed record of the figures as they stood when it was produced, which is why they may differ
        from your live dashboard. Divine Acquisition can see that you opened it.
      </p>
    </div>
  );
}
