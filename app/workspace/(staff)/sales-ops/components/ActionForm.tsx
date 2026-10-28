'use client';

import { useState, useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { Button } from '../../components/ui';

/** A form that posts to a server action and shows its one-line result. */
export default function ActionForm({
  action,
  submitLabel,
  children,
  onDone,
  className = 'space-y-5',
  resetOnSuccess = false,
  readOnly = false,
}: {
  readOnly?: boolean;
  action: (fd: FormData) => Promise<ActionResult>;
  submitLabel: string;
  children: ReactNode;
  onDone?: (result: ActionResult) => void;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setResult(null);
        startTransition(async () => {
          const r = await action(fd);
          setResult(r);
          if (r.ok && resetOnSuccess) form.reset();
          onDone?.(r);
        });
      }}
    >
      {children}
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
          <FormResult result={result} />
        </div>
      )}
    </form>
  );
}

export function FormResult({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="text-sm text-flag-good">{result.message}</p>
  ) : (
    <p role="alert" className="text-sm text-flag-critical">
      {result.error}
    </p>
  );
}

export function CheckboxGroup({
  name,
  options,
  selected,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.09] bg-ink-850 px-3 py-2 text-sm text-card-foreground has-[:checked]:border-brand-500/55 has-[:checked]:bg-brand-500/10"
        >
          <input
            type="checkbox"
            name={name}
            value={o.value}
            defaultChecked={selected.includes(o.value)}
            className="h-4 w-4 accent-brand-500"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
