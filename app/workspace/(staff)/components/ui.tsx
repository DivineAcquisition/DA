'use client';

import { useEffect, useId, useState, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { BorderBeam } from '@/components/ui/border-beam';
import { Input as CossInput } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { ShineBorder } from '@/components/ui/shine-border';
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
  const variants = {
    primary:
      'border border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/24 hover:bg-primary/90 active:scale-[0.98]',
    secondary:
      'border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90',
    ghost: 'border border-transparent text-foreground hover:bg-accent',
    danger: 'border border-destructive bg-destructive text-white hover:bg-destructive/90',
  };
  const sizes = { sm: 'h-8 gap-1.5 px-2.5 text-sm', md: 'h-10 px-3.5 text-sm sm:h-9' };
  return (
    <button
      className={`relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[box-shadow,transform,background-color,border-color,color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 ${variants[variant]} ${sizes[size]} ${className}`}
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
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

/** Vistrial panel: quiet card, brand wash only when a screen asks for it. */
export function Card({
  children,
  className = '',
  shine = false,
  beam = false,
}: {
  children: ReactNode;
  className?: string;
  shine?: boolean;
  beam?: boolean;
}) {
  return (
    <div className={cn(ws.card, 'panel-hover', className)}>
      {shine ? <ShineBorder borderWidth={1} duration={14} /> : null}
      {beam ? <BorderBeam borderWidth={1} colorFrom="#9A88FC" colorTo="#C3B6FE" /> : null}
      <div className="relative z-[1]">{children}</div>
    </div>
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
    <header className="relative mb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.75rem] tracking-tight text-white sm:text-[2rem]">{title}</h1>
          {description ? (
            <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-silver">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div aria-hidden className="mt-6 h-px bg-linear-to-r from-transparent via-brand-500/30 to-transparent" />
    </header>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="px-6 py-14 text-center">
      <p className="font-heading text-sm text-card-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
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
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ws.panelHeader}>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
