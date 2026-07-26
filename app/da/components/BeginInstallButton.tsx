'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Panel } from '@/app/vistrial/components/ui';
import { beginInstallAction } from '@/lib/da/actions';

/**
 * Locking a baseline is permanent, so it asks first. A baseline that can be
 * adjusted after the fact is worthless as proof, which is the whole reason this
 * is a one-way door.
 */
export default function BeginInstallButton({ caseFileId, slug }: { caseFileId: string; slug: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${btnPrimary} ${btnSizeSm}`}>
        Begin install
      </button>
    );
  }

  return (
    <Panel className="w-full max-w-md p-5">
      <p className="text-sm font-semibold text-white">Lock the baseline permanently?</p>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        Beginning the install freezes the baseline. It can be annotated afterwards but never edited, by anyone,
        including through the database directly. That is what makes it usable as proof.
      </p>

      {error && <p className="mt-3 text-[13px] text-flag-critical">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await beginInstallAction(caseFileId, slug);
              if (!result.ok) setError(result.error);
              else setConfirming(false);
            })
          }
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          {pending ? 'Locking…' : 'Lock it and begin'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className={`${btnSecondary} ${btnSizeSm}`}>
          Not yet
        </button>
      </div>
    </Panel>
  );
}
