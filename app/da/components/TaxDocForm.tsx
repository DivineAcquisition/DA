'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass, labelClass, selectClass } from '@/app/vistrial/components/ui';
import { updateTaxDocAction } from '@/lib/da/billingActions';

export default function TaxDocForm({ operatorId, current }: { operatorId: string; current: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      action={(formData) =>
        startTransition(async () => {
          const result = await updateTaxDocAction(operatorId, formData);
          setMessage(result.ok ? result.message : result.error);
        })
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor={`st-${operatorId}`}>
            Status
          </label>
          <select id={`st-${operatorId}`} name="tax_doc_status" defaultValue={current} className={selectClass}>
            <option value="missing">Missing</option>
            <option value="requested">Requested</option>
            <option value="on_file">On file</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor={`rf-${operatorId}`}>
            Where it lives
          </label>
          <input
            id={`rf-${operatorId}`}
            name="tax_doc_reference"
            className={inputClass}
            placeholder="drive:w8ben-…"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`${btnSecondary} ${btnSizeSm}`}>
          {pending ? 'Saving…' : 'Update'}
        </button>
        {message && <span className="text-xs text-neutral-500">{message}</span>}
      </div>
    </form>
  );
}
