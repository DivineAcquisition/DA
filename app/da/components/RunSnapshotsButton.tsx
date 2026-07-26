'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { runDueSnapshotsAction } from '@/lib/da/actions';

/**
 * The weekly snapshot job also runs on a schedule in Postgres. This button
 * shares the same function, so a manual run and the cron run cannot drift.
 */
export default function RunSnapshotsButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-wrap items-center gap-2">
      {message && <span className="text-xs text-neutral-500">{message}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runDueSnapshotsAction();
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className={`${btnSecondary} ${btnSizeSm}`}
      >
        {pending ? 'Measuring…' : 'Run due snapshots'}
      </button>
    </span>
  );
}
