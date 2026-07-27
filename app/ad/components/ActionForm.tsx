'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import type { ActionResult } from '@/lib/ad/rpc';

export function ActionForm({
  action,
  submitLabel,
  children,
  onDone,
  className = '',
  variant = 'primary',
  pendingLabel = 'Saving…',
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  submitLabel: string;
  children?: React.ReactNode;
  onDone?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  pendingLabel?: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const buttonClass =
    variant === 'danger'
      ? 'rounded-full border border-flag-critical/40 bg-flag-critical/[0.12] px-4 py-2 text-sm font-medium text-flag-critical transition hover:bg-flag-critical/[0.2] disabled:opacity-50'
      : variant === 'primary'
        ? `${btnPrimary} ${btnSizeSm}`
        : `${btnSecondary} ${btnSizeSm}`;

  return (
    <form
      className={`space-y-3 ${className}`}
      action={(formData) => {
        setResult(null);
        startTransition(async () => {
          const outcome = await action(formData);
          if (outcome) setResult(outcome);
          if (outcome?.ok) onDone?.();
        });
      }}
    >
      {children}

      {result && (
        <div
          className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${
            result.ok
              ? 'border-flag-good/25 bg-flag-good/[0.08] text-flag-good'
              : 'border-flag-critical/25 bg-flag-critical/[0.08] text-flag-critical'
          }`}
        >
          {result.ok ? result.message : result.error}
        </div>
      )}

      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

export function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${btnSecondary} ${btnSizeSm}`}>
        {open ? 'Cancel' : label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
