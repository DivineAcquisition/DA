'use client';

import { useState, useTransition } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { detectMilestonesAction } from '@/lib/da/actions';

export default function DetectMilestonesButton({
  caseFileId,
  slug,
}: {
  caseFileId: string;
  slug: string;
}) {
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
            const result = await detectMilestonesAction(caseFileId, slug);
            setMessage(result.ok ? result.message : result.error);
          })
        }
        className={`${btnSecondary} ${btnSizeSm}`}
      >
        {pending ? 'Scanning…' : 'Detect from tracking'}
      </button>
    </span>
  );
}
