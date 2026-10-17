'use client';

import { createContext, useCallback, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { CTA_LABEL } from '@/lib/acq/copy';
import type { TrackingParamKey } from '@/lib/acq/config';
import { ApplyAttribution, ApplyDialog } from './ApplyFlow';

type QualifyContextValue = {
  open: () => void;
};

const QualifyContext = createContext<QualifyContextValue | null>(null);

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

export function QualifyButton({
  className = '',
  children,
  variant = 'solid',
}: {
  className?: string;
  children?: ReactNode;
  variant?: 'solid' | 'nav';
}) {
  const ctx = useContext(QualifyContext);
  if (!ctx) {
    throw new Error('QualifyButton must be used inside QualifyProvider');
  }

  if (variant === 'nav') {
    return (
      <button
        type="button"
        onClick={ctx.open}
        className={`text-sm font-semibold text-brand-200 transition hover:text-white ${className}`}
      >
        {children ?? CTA_LABEL}
      </button>
    );
  }

  return (
    <button type="button" onClick={ctx.open} className={`acq-button acq-button-full max-w-sm ${className}`}>
      {children ?? CTA_LABEL}
      <ArrowIcon />
    </button>
  );
}

export function QualifyProvider({
  children,
  tracking,
  testMode = false,
}: {
  children: ReactNode;
  tracking: Partial<Record<TrackingParamKey, string>>;
  testMode?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.dispatchEvent(new Event('acq-apply-shown'));
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, []);

  return (
    <QualifyContext.Provider value={{ open }}>
      <ApplyAttribution tracking={tracking} testMode={testMode} />
      {children}
      <dialog ref={dialogRef} aria-labelledby="acq-apply-title" className="acq-apply-dialog acq-coaches">
        <ApplyDialog
          dialogRef={dialogRef as RefObject<HTMLDialogElement | null>}
          firstFieldRef={firstFieldRef}
          tracking={tracking}
          testMode={testMode}
        />
      </dialog>
    </QualifyContext.Provider>
  );
}
