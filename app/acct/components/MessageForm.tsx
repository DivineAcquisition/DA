'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { Panel, inputClass, labelClass } from '@/app/vistrial/components/ui';
import { sendMessageAction } from '@/lib/acct/actions';

export default function MessageForm({ caseFileId }: { caseFileId: string }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel className="p-5">
      <form
        action={(formData) => {
          setResult(null);
          startTransition(async () => {
            const outcome = await sendMessageAction(caseFileId, formData);
            setResult({ ok: outcome.ok, text: outcome.ok ? outcome.message : outcome.error });
          });
        }}
        className="space-y-4"
      >
        <div>
          <label className={labelClass} htmlFor="body">
            What do you need?
          </label>
          <textarea
            id="body"
            name="body"
            rows={3}
            required
            className={`${inputClass} resize-none`}
            placeholder="A question, a change you want, or something you have noticed."
          />
        </div>

        {result && (
          <p
            className={`rounded-xl border px-3.5 py-2.5 text-sm ${
              result.ok
                ? 'border-flag-good/25 bg-flag-good/[0.08] text-flag-good'
                : 'border-flag-critical/25 bg-flag-critical/[0.08] text-flag-critical'
            }`}
          >
            {result.text}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
          {pending ? 'Sending…' : 'Send to DA'}
        </button>
      </form>
    </Panel>
  );
}
