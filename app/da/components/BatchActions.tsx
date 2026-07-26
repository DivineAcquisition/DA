'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { approveBatchAction, buildBatchAction } from '@/lib/da/billingActions';

export default function BatchActions({
  periodId,
  batchId,
  mode,
}: {
  periodId: string;
  batchId?: string;
  mode: 'build' | 'approve' | 'rebuild';
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean } & ({ message: string } | { error: string })>) =>
    startTransition(async () => {
      const result = await fn();
      setMessage({ ok: result.ok, text: 'message' in result ? result.message : result.error });
    });

  return (
    <span className="flex flex-wrap items-center gap-2">
      {message && (
        <span className={`text-xs ${message.ok ? 'text-flag-good' : 'text-flag-critical'}`}>{message.text}</span>
      )}

      {mode === 'build' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => buildBatchAction(periodId))}
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          {pending ? 'Building…' : 'Build batch'}
        </button>
      )}

      {mode === 'approve' && batchId && (
        <>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => buildBatchAction(periodId))}
            className={`${btnSecondary} ${btnSizeSm}`}
          >
            Rebuild
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveBatchAction(batchId))}
            className={`${btnPrimary} ${btnSizeSm}`}
          >
            {pending ? 'Approving…' : 'Approve batch'}
          </button>
        </>
      )}
    </span>
  );
}
