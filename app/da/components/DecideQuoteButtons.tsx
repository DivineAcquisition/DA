'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { inputClass } from '@/app/vistrial/components/ui';
import { decideQuoteAction } from '@/lib/da/actions';

export default function DecideQuoteButtons({ quoteId, slug }: { quoteId: string; slug: string }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (status: 'accepted' | 'declined') =>
    startTransition(async () => {
      const result = await decideQuoteAction(quoteId, slug, status, note);
      if (!result.ok) setError(result.error);
    });

  return (
    <div className="space-y-2.5">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className={inputClass}
        placeholder="Note on the decision"
      />
      {error && <p className="text-xs text-flag-critical">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('accepted')}
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          Client accepted
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('declined')}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Client declined
        </button>
      </div>
    </div>
  );
}
