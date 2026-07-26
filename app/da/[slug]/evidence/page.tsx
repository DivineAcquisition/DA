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
  selectClass,
} from '@/app/vistrial/components/ui';
import { recordEvidenceAction } from '@/lib/da/actions';
import { getCaseFileBySlug, getDriveFolders, listEvidence } from '@/lib/da/queries';
import { driveConfigured } from '@/lib/drive/client';
import { ActionForm, Disclosure } from '../../components/ActionForm';
import ShareEvidenceForm from '../../components/ShareEvidenceForm';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { value: 'evidence', label: 'Evidence' },
  { value: 'deliverables', label: 'Deliverables' },
  { value: 'reports', label: 'Reports' },
  { value: 'client_provided', label: 'Client provided' },
];

export default async function EvidencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const [evidence, folders] = await Promise.all([listEvidence(caseFile.id), getDriveFolders(caseFile.id)]);
  const drive = driveConfigured();

  const untagged = evidence.filter((item) => item.needs_metadata);
  const tagged = evidence.filter((item) => !item.needs_metadata);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Evidence vault"
        description="Anything that proves the work happened or the result occurred. Files live in Google Drive; Vistrial holds the reference and the metadata."
        actions={
          <>
            {caseFile.drive_folder_url && (
              <a
                href={caseFile.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnSecondary} ${btnSizeSm}`}
              >
                Open Drive folder
              </a>
            )}
            <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
              Back to case file
            </Link>
          </>
        }
      />

      {!drive && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">Drive not connected</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            Google credentials are not set, so Vistrial cannot create folders, upload, or mint expiring share
            permissions. The vault still records references and metadata, which is all it ever stores — set
            the <code className="text-neutral-300">GOOGLE_DRIVE_*</code> variables to switch the file
            operations on.
          </p>
        </Panel>
      )}

      {untagged.length > 0 && (
        <section>
          <SectionHeader
            title="Awaiting metadata"
            hint="Found in Drive by the sync rather than uploaded through Vistrial."
          />
          <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
            <p className="text-sm leading-relaxed text-white">
              Every evidence item needs two things before it can be used: what it proves, and the date the
              thing happened, which may be earlier than the upload. These {untagged.length} were discovered in
              Drive and brought in untagged rather than left invisible.
            </p>
          </Panel>
          <ul className="mt-3 space-y-2.5">
            {untagged.map((item) => (
              <li key={item.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.filename}</p>
                    <Badge tone="warning">untagged</Badge>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">
                    {item.mime_type ?? 'unknown type'} · discovered {item.created_at.slice(0, 10)}
                  </p>
                  <div className="mt-3.5">
                    <Disclosure label="Add metadata">
                      <ActionForm
                        action={recordEvidenceAction.bind(null, caseFile.id, slug)}
                        submitLabel="Save metadata"
                      >
                        <input type="hidden" name="drive_file_id" value={item.drive_file_id} />
                        <input type="hidden" name="filename" value={item.filename} />
                        <input type="hidden" name="drive_url" value={item.drive_url ?? ''} />
                        <input type="hidden" name="mime_type" value={item.mime_type ?? ''} />
                        <div>
                          <label className={labelClass} htmlFor={`proves-${item.id}`}>
                            What this proves *
                          </label>
                          <input
                            id={`proves-${item.id}`}
                            name="what_it_proves"
                            required
                            className={inputClass}
                            placeholder="Consult calendar fully booked for the first time."
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className={labelClass} htmlFor={`happened-${item.id}`}>
                              Date it happened *
                            </label>
                            <input
                              id={`happened-${item.id}`}
                              name="happened_on"
                              type="date"
                              required
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass} htmlFor={`cat-${item.id}`}>
                              Category
                            </label>
                            <select
                              id={`cat-${item.id}`}
                              name="category"
                              defaultValue={item.category}
                              className={selectClass}
                            >
                              {CATEGORIES.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </ActionForm>
                    </Disclosure>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclosure label="Record an evidence item">
        <Panel className="p-5">
          <ActionForm action={recordEvidenceAction.bind(null, caseFile.id, slug)} submitLabel="Record evidence">
            <p className="text-xs leading-relaxed text-neutral-500">
              Both metadata fields are required and the database enforces it, so an item without a stated claim
              or a date cannot be recorded at all.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="filename">
                  Filename *
                </label>
                <input id="filename" name="filename" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="category">
                  Category
                </label>
                <select id="category" name="category" defaultValue="evidence" className={selectClass}>
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {folders.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-600">Uploads land in the matching Drive subfolder.</p>
                )}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="what_it_proves">
                What this proves *
              </label>
              <input id="what_it_proves" name="what_it_proves" required className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="happened_on">
                  Date it happened *
                </label>
                <input id="happened_on" name="happened_on" type="date" required className={inputClass} />
                <p className="mt-1 text-xs text-neutral-600">May be earlier than today.</p>
              </div>
              <div>
                <label className={labelClass} htmlFor="drive_file_id">
                  Drive file id *
                </label>
                <input id="drive_file_id" name="drive_file_id" required className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="drive_url">
                Drive URL
              </label>
              <input id="drive_url" name="drive_url" className={inputClass} />
            </div>
          </ActionForm>
        </Panel>
      </Disclosure>

      <section>
        <SectionHeader title="Vault" hint={`${tagged.length} tagged items.`} />
        {tagged.length === 0 ? (
          <EmptyState title="Nothing tagged yet" />
        ) : (
          <ul className="space-y-2.5">
            {tagged.map((item) => {
              const links = (item.evidence_share_link ?? []) as {
                id: string;
                expires_at: string;
                revoked_at: string | null;
                shared_with: string | null;
              }[];
              const live = links.filter(
                (link) => !link.revoked_at && new Date(link.expires_at) > new Date(),
              );

              return (
                <li key={item.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{item.filename}</p>
                          <Badge tone="neutral">{item.category.replace('_', ' ')}</Badge>
                          {live.length > 0 && <Badge tone="warning">{live.length} live share link</Badge>}
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-300">
                          {item.what_it_proves}
                        </p>
                        <p className="mt-1.5 text-xs text-neutral-600">
                          Happened {item.happened_on} · recorded {item.created_at.slice(0, 10)}
                          {item.discovered_by_sync && ' · found by the Drive sync'}
                        </p>
                      </div>
                      {item.drive_url && (
                        <a
                          href={item.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${btnSecondary} ${btnSizeSm} shrink-0`}
                        >
                          Open in Drive
                        </a>
                      )}
                    </div>

                    <div className="mt-3.5">
                      <Disclosure label="Share with the client" tone="neutral">
                        <ShareEvidenceForm evidenceId={item.id} slug={slug} />
                      </Disclosure>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
