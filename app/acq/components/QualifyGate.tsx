import type { ReactNode } from 'react';
import { CTA_LABEL } from '@/lib/acq/copy';

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" />
    </svg>
  );
}

/** Scrolls to the on-page calendar. The landing no longer opens an application popup. */
export function QualifyButton({
  className = '',
  children,
  variant = 'solid',
}: {
  className?: string;
  children?: ReactNode;
  variant?: 'solid' | 'nav';
}) {
  if (variant === 'nav') {
    return (
      <a href="#calendar" className={`text-sm font-semibold text-brand-200 transition hover:text-white ${className}`}>
        {children ?? CTA_LABEL}
      </a>
    );
  }

  return (
    <a href="#calendar" className={`acq-button acq-button-full max-w-sm no-underline ${className}`}>
      {children ?? CTA_LABEL}
      <ArrowIcon />
    </a>
  );
}

export function QualifyProvider({ children }: { children: ReactNode }) {
  return children;
}
