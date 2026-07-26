'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Panel, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { recordUploadAction } from '@/lib/acct/actions';

export default function UploadForm({ caseFileId }: { caseFileId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} ${btnSizeSm}`}>
        Send DA a file
      </button>
    );
  }

  return (
    <Panel className="p-5">
      <form
        action={(formData) => {
          setResult(null);
          startTransition(async () => {
            const outcome = await recordUploadAction(caseFileId, formData);
            setResult({ ok: outcome.ok, text: outcome.ok ? outcome.message : outcome.error });
            if (outcome.ok) setOpen(false);
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className={labelClass} htmlFor="filename">
            File name *
          </label>
          <input id="filename" name="filename" required className={inputClass} placeholder="patient-list.csv" />
        </div>
        <div>
          <label className={labelClass} htmlFor="what_it_proves">
            What is it for? *
          </label>
          <input
            id="what_it_proves"
            name="what_it_proves"
            required
            className={inputClass}
            placeholder="Customer list for the reactivation campaign"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="happened_on">
            Date it relates to
          </label>
          <input id="happened_on" name="happened_on" type="date" className={inputClass} />
        </div>

        {result && !result.ok && (
          <p className="rounded-xl border border-flag-critical/25 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
            {result.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
            {pending ? 'Sending…' : 'Send it'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={`${btnSecondary} ${btnSizeSm}`}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}
