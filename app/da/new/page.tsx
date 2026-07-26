import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { PageHeader, Panel, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { createCaseFileAction } from '@/lib/da/actions';
import { driveConfigured } from '@/lib/drive/client';
import { ActionForm } from '../components/ActionForm';

export default function NewCaseFilePage() {
  const drive = driveConfigured();

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        eyebrow="New engagement"
        title="Create a case file"
        description="The container for the baseline, every snapshot, the effort log, and the evidence vault."
        actions={
          <Link href="/da" className={`${btnSecondary} ${btnSizeSm}`}>
            Cancel
          </Link>
        }
      />

      <Panel className="p-6">
        <ActionForm action={createCaseFileAction} submitLabel="Create case file">
          <div>
            <label className={labelClass} htmlFor="name">
              Client name *
            </label>
            <input id="name" name="name" required className={inputClass} placeholder="Lumen Aesthetics" />
          </div>

          <div>
            <label className={labelClass} htmlFor="vertical">
              Vertical
            </label>
            <input id="vertical" name="vertical" className={inputClass} placeholder="Med spa, three locations" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="contact_name">
                Main contact
              </label>
              <input id="contact_name" name="contact_name" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="contact_email">
                Contact email
              </label>
              <input id="contact_email" name="contact_email" type="email" className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="engagement_start">
                Engagement start
              </label>
              <input id="engagement_start" name="engagement_start" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="retainer_amount">
                Retainer / mo
              </label>
              <input id="retainer_amount" name="retainer_amount" type="number" step="0.01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="revenue_goal_monthly">
                Revenue goal / mo
              </label>
              <input
                id="revenue_goal_monthly"
                name="revenue_goal_monthly"
                type="number"
                step="0.01"
                className={inputClass}
              />
              <p className="mt-1 text-xs text-neutral-600">
                Used to detect the first month over goal automatically.
              </p>
            </div>
          </div>

          <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-xs leading-relaxed text-neutral-500">
            {drive
              ? 'A Drive folder will be created for this client with Evidence, Deliverables, Reports and Client Provided subfolders.'
              : 'Google Drive is not connected, so no folders will be created. The case file works either way; evidence can record its references and the folders can be attached later.'}
          </p>
        </ActionForm>
      </Panel>
    </div>
  );
}
