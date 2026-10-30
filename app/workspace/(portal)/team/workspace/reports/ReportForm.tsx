'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';

export default function ReportForm({
  action,
  className,
  children,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  className?: string;
  children: ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className={className}
      action={(formData) => {
        setError(null);
        setMessage(null);
        start(async () => {
          const result = await action(formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
    >
      {children}
      {error ? <p className="text-sm text-[#FFB020]">{error}</p> : null}
      {message ? <p className="text-sm text-neutral-300">{message}</p> : null}
      {pending ? <p className="text-xs text-neutral-500">Saving.</p> : null}
    </form>
  );
}
