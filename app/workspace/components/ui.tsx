'use client';

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { Input as CossInput } from '@/components/ui/input';
import { MagicCard } from '@/components/ui/magic-card';
import { NativeSelect } from '@/components/ui/select';
import { ShineBorder } from '@/components/ui/shine-border';
import { Surface } from '@/components/ui/surface';
import { Textarea as CossTextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ws } from './tokens';

/** Workspace-scoped SaaS primitives — hiring-page visual language + brief brand tokens. */

export { ws };

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'hiring-button-sm' : 'hiring-button-md';
  if (variant === 'primary') {
    return <button className={cn('hiring-button', sizeClass, className)} {...props} />;
  }
  if (variant === 'secondary') {
    return <button className={cn('hiring-button-secondary', sizeClass, className)} {...props} />;
  }
  const variants = {
    ghost: 'text-neutral-300 hover:text-white',
    danger:
      'rounded-xl border border-flag-critical/70 bg-flag-critical/10 text-flag-critical shadow-[inset_0_0_0_1px_rgba(248,113,113,0.18)] hover:bg-flag-critical/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-flag-critical',
  };
  const sizes = { sm: 'px-4 py-2 text-[13px]', md: 'px-5 py-2.5 text-sm' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <CossInput nativeInput className={className} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <CossTextarea className={className} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <NativeSelect className={className} {...props} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className={ws.label}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-neutral-500">{hint}</span> : null}
    </label>
  );
}

/** Workspace card: Coss panel and the hiring shine. */
export function Card({
  children,
  className = '',
  shine = true,
  beam = false,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  shine?: boolean;
  beam?: boolean;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return (
    <Surface as={as} className={className} shine={shine} beam={beam}>
      {children}
    </Surface>
  );
}

export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
      />
      <span>
        <span className="block text-sm text-white">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[var(--ws-dim)]">{hint}</span>}
      </span>
    </label>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'error' | 'pending';
}) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.04] text-neutral-300',
    accent: 'border-brand-500/25 bg-brand-500/10 text-brand-300',
    success: 'border-flag-good/35 bg-flag-good/12 text-flag-good',
    error: 'border-flag-critical/35 bg-flag-critical/12 text-flag-critical',
    pending: 'border-flag-warning/35 bg-flag-warning/12 text-flag-warning',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className={`${ws.heading} text-2xl font-semibold tracking-tight sm:text-[28px]`}>{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="px-6 py-14 text-center">
      <p className={`${ws.heading} text-base font-semibold`}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">{description}</p>
    </Card>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Portaled to body so no ancestor transform / stacking context can trap
  // `fixed`. On large screens the overlay starts after the sidebar so the
  // panel centers in the content area rather than the full viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 lg:pl-64"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade lg:left-64"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${ws.card} relative z-10 max-h-[min(90vh,52rem)] w-full max-w-lg overflow-y-auto animate-rise p-5 shadow-2xl sm:p-6`}
      >
        <ShineBorder borderWidth={1} duration={14} />
        <MagicCard className="relative rounded-[inherit]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={titleId} className={`${ws.heading} text-lg font-semibold`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-neutral-500 hover:text-white"
          >
            Close
          </button>
        </div>
        {children}
        </MagicCard>
      </div>
    </div>,
    document.body,
  );
}

export function SecretInput({
  name,
  defaultValue = '',
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const hasValue = Boolean(defaultValue);
  return (
    <div className="flex gap-2">
      <input type="hidden" name={`${name}_keep`} value={hasValue ? '1' : '0'} />
      <Input
        name={name}
        type={revealed ? 'text' : 'password'}
        placeholder={hasValue ? '••••••••••••' : placeholder}
        autoComplete="off"
        className="flex-1"
      />
      <Button type="button" variant="secondary" size="sm" onClick={() => setRevealed((v) => !v)}>
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
    </div>
  );
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed' || status === 'active' || status === 'active_link'
      ? 'success'
      : status === 'declined' || status === 'revoked' || status === 'inactive'
        ? 'error'
        : status === 'viewed' || status === 'pending' || status === 'sent'
          ? 'pending'
          : status === 'expired'
            ? 'neutral'
            : 'accent';
  const label = status === 'active_link' ? 'active' : status.replace(/_/g, ' ');
  return <Badge tone={tone as 'success' | 'error' | 'pending' | 'neutral' | 'accent'}>{label}</Badge>;
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className={`${ws.card} overflow-hidden`}>
      <ShineBorder borderWidth={1} duration={18} />
      <MagicCard className="relative rounded-[inherit]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ws.panelHeader}>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3"
                >
                  <AnimatedShinyText className="mx-0 max-w-none text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">
                    {h}
                  </AnimatedShinyText>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
        </table>
      </div>
      </MagicCard>
    </div>
  );
}
