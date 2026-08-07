'use client';

import { useState, useTransition } from 'react';
import { syncDocuSealAction } from '@/lib/workspace/actions';
import { Button } from './ui';

/**
 * Pulls everything DocuSeal knows into the workspace: templates, agreements,
 * the values submitters have already entered, and a pre-fill pass over every
 * form still waiting on a signature.
 */
export default function SyncDocuSealButton({
  label = 'Pull from DocuSeal',
  variant = 'primary',
}: {
  label?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant={variant}
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await syncDocuSealAction();
            if (!result.ok) setError(result.error);
            else setMessage(result.message);
          });
        }}
      >
        {pending ? 'Pulling…' : label}
      </Button>
      {error && <p className="max-w-md text-right text-xs text-[var(--ws-error)]">{error}</p>}
      {message && <p className="max-w-md text-right text-xs text-[var(--ws-success)]">{message}</p>}
    </div>
  );
}
