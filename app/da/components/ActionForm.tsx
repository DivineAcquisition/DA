'use client';

import { useState, useTransition } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge } from '@/app/vistrial/components/ui';
import type { ActionResult } from '@/lib/da/actions';

/**
 * Wraps a server action and surfaces whatever the database said. The rule
 * violations raise real messages from Postgres, and showing them verbatim is
 * more useful than a generic failure toast.
 */
export function ActionForm({
  action,
  submitLabel,
  children,
  onDone,
  className = '',
  variant = 'primary',
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  submitLabel: string;
  children: React.ReactNode;
  onDone?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary';
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={`space-y-4 ${className}`}
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

      <button
        type="submit"
        disabled={pending}
        className={`${variant === 'primary' ? btnPrimary : btnSecondary} ${btnSizeSm}`}
      >
        {pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

/** A collapsible wrapper so the log pages are not a wall of forms. */
export function Disclosure({
  label,
  children,
  tone = 'brand',
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'brand' | 'neutral';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${tone === 'brand' ? btnPrimary : btnSecondary} ${btnSizeSm}`}
      >
        {open ? 'Cancel' : label}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ImmutableNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs leading-relaxed text-neutral-500">
      <Badge tone="neutral">Immutable</Badge>
      {children}
    </p>
  );
}
