'use client';

import { inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import { shareEvidenceAction } from '@/lib/da/actions';
import { ActionForm } from './ActionForm';

/**
 * Rule 6: files are private by default and never publicly linked. Sharing issues
 * a time-limited view link instead of permanently changing the file's Drive
 * permissions.
 */
export default function ShareEvidenceForm({ evidenceId, slug }: { evidenceId: string; slug: string }) {
  return (
    <ActionForm
      variant="secondary"
      submitLabel="Issue a time-limited link"
      action={async (formData) =>
        shareEvidenceAction(
          evidenceId,
          slug,
          Number(formData.get('ttl') ?? 1440),
          String(formData.get('shared_with') ?? ''),
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`ttl-${evidenceId}`}>
            Expires after
          </label>
          <select id={`ttl-${evidenceId}`} name="ttl" defaultValue="1440" className={selectClass}>
            <option value="60">1 hour</option>
            <option value="1440">24 hours</option>
            <option value="4320">3 days</option>
            <option value="10080">7 days</option>
            <option value="20160">14 days</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`with-${evidenceId}`}>
            Shared with
          </label>
          <input
            id={`with-${evidenceId}`}
            name="shared_with"
            type="email"
            className={inputClass}
            placeholder="client@example.com"
          />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-neutral-500">
        The file&apos;s own permissions are never changed permanently, so revoking access does not depend on
        remembering to undo something later.
      </p>
    </ActionForm>
  );
}
