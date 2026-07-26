'use client';

import { inputClass, labelClass } from '@/app/vistrial/components/ui';
import { annotateSnapshotAction } from '@/lib/da/actions';
import { ActionForm } from './ActionForm';

/**
 * Annotation is the only way to qualify a locked snapshot. It explains an
 * anomaly — a fortnight with the ads paused — without touching the numbers.
 */
export default function AnnotateForm({ snapshotId, slug }: { snapshotId: string; slug: string }) {
  return (
    <ActionForm
      variant="secondary"
      submitLabel="Add annotation"
      action={async (formData) =>
        annotateSnapshotAction(snapshotId, slug, String(formData.get('body') ?? ''))
      }
    >
      <div>
        <label className={labelClass} htmlFor={`annotation-${snapshotId}`}>
          Annotation
        </label>
        <textarea
          id={`annotation-${snapshotId}`}
          name="body"
          rows={2}
          required
          className={`${inputClass} resize-none`}
          placeholder="Explain the anomaly. The measurements themselves stay exactly as taken."
        />
      </div>
    </ActionForm>
  );
}
