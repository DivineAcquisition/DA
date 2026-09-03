'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { confirmPaymentAction } from '@/lib/calls/actions';

export default function ConfirmPaymentForm({ leadId }: { leadId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await confirmPaymentAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <button type="submit" disabled={pending} className={`${btnPrimary} ${btnSizeSm}`}>
        {pending ? 'Saving…' : 'Commas payment received'}
      </button>
      {error && <p className="mt-2 text-xs text-flag-critical">{error}</p>}
    </form>
  );
}
