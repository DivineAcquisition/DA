'use client';

import { createContext, useContext, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PortalContext } from '@/lib/portal/types';
import type { Result } from '@/lib/portal/actions';

/**
 * What every portal component needs to know: whose portal this is, which
 * placement is selected, and whether the person looking can act. During View As
 * nothing the VA attests to can be done from here; the database refuses it too.
 */
type PortalValue = {
  context: PortalContext;
  placementId: string | null;
  readOnly: boolean;
  lockTitle: string;
  operatorZone: string;
};

const Ctx = createContext<PortalValue | null>(null);

export function PortalProvider({
  context,
  placementId,
  children,
}: {
  context: PortalContext;
  placementId: string | null;
  children: React.ReactNode;
}) {
  const readOnly = context.viewer.read_only;
  const value: PortalValue = {
    context,
    placementId,
    readOnly,
    lockTitle: `Only ${context.operator.first_name || context.operator.name} can do this. Use the admin panel to act in your own name.`,
    operatorZone: context.operator.time_zone,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal(): PortalValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('usePortal outside the portal');
  return value;
}

/** Runs a server action, shows its message or error, and refreshes the page. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run<T>(action: () => Promise<Result<T>>, onDone?: (result: Result<T>) => void) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMessage(result.message ?? null);
      else setError(result.error);
      onDone?.(result);
      router.refresh();
    });
  }

  return { run, pending, message, error, setError, setMessage };
}

export function Feedback({ message, error }: { message?: string | null; error?: string | null }) {
  if (error) {
    return (
      <p role="alert" className="mt-3 rounded-xl border border-flag-critical/30 bg-flag-critical/[0.08] px-3.5 py-2.5 text-sm text-flag-critical">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="mt-3 rounded-xl border border-flag-good/30 bg-flag-good/[0.08] px-3.5 py-2.5 text-sm text-flag-good">
        {message}
      </p>
    );
  }
  return null;
}

/**
 * A button for something only the VA can do. During View As it is disabled,
 * with the reason as its tooltip and, on a phone where there is no hover, as a
 * line beneath it.
 */
export function VaButton({
  children,
  className = '',
  showReason = false,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { showReason?: boolean }) {
  const { readOnly, lockTitle } = usePortal();
  return (
    <span className="inline-flex flex-col items-start">
      <button
        {...rest}
        disabled={readOnly || disabled}
        title={readOnly ? lockTitle : rest.title}
        aria-disabled={readOnly || disabled}
        className={`${className} ${readOnly ? 'cursor-not-allowed opacity-45' : ''}`}
      >
        {children}
      </button>
      {readOnly && showReason ? <span className="mt-1.5 text-[11px] text-cyan-300">{lockTitle}</span> : null}
    </span>
  );
}

/** A form's worth of fields that only the VA can fill in: dimmed and inert during View As. */
export function VaFieldset({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { readOnly, lockTitle } = usePortal();
  return (
    <fieldset disabled={readOnly} title={readOnly ? lockTitle : undefined} className={`min-w-0 ${className}`}>
      {readOnly ? (
        <p className="mb-3 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] px-3.5 py-2 text-xs text-cyan-200">
          Read-only. {lockTitle}
        </p>
      ) : null}
      <div className={readOnly ? 'pointer-events-none opacity-50' : ''}>{children}</div>
    </fieldset>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900 p-5 shadow-2xl sm:rounded-3xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-lg leading-none text-neutral-400 hover:text-white" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel rounded-2xl p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-white">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-neutral-500">{children}</p>;
}
