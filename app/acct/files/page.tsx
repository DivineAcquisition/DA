import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { getMyAccount, getMyUploads } from '@/lib/acct/queries';
import UploadForm from '../components/UploadForm';

export const dynamic = 'force-dynamic';

export default async function ClientFiles() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const files = await getMyUploads(account.case_file_id);
  const readOnly = account.state === 'archived';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Files"
        title="What you have sent us"
        description="Customer lists for reactivation, brand assets, existing marketing material. Anything you send lands with DA for review."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {!readOnly && <UploadForm caseFileId={account.case_file_id} />}

      {files.length === 0 ? (
        <EmptyState title="Nothing uploaded yet" />
      ) : (
        <section>
          <SectionHeader title="Your files" hint={`${files.length} items.`} />
          <ul className="space-y-2.5">
            {files.map((file) => (
              <li key={file.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">{file.filename}</p>
                        {file.uploaded_by_client && <Badge tone="brand">you sent this</Badge>}
                        {file.reviewed_by_admin_at ? (
                          <Badge tone="good">reviewed</Badge>
                        ) : (
                          <Badge tone="warning">with DA</Badge>
                        )}
                      </div>
                      {file.what_it_proves && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                          {file.what_it_proves}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-neutral-600">
                        {file.happened_on && `Dated ${file.happened_on} · `}
                        uploaded {file.uploaded_at.slice(0, 10)}
                      </p>
                    </div>
                    {file.drive_url && (
                      <a
                        href={file.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${btnSecondary} ${btnSizeSm} shrink-0`}
                      >
                        Open
                      </a>
                    )}
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
