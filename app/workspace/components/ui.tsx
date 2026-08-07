'use client';

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

/** Workspace-scoped SaaS primitives — hiring-page visual language + brief brand tokens. */

export const ws = {
  page: 'bg-[var(--ws-page)] text-[var(--ws-body)]',
  card:
    'rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] shadow-[0_24px_60px_-40px_rgba(124,77,255,0.9)]',
  panelHeader: 'bg-[var(--ws-panel)]',
  input:
    'w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white placeholder:text-[var(--ws-dim)] outline-none transition focus:border-[var(--ws-accent)] focus:ring-1 focus:ring-[var(--ws-accent)]',
  label: 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]',
  heading: 'font-[family-name:var(--font-plus-jakarta)] text-white',
};

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
      'bg-[var(--ws-btn)] text-white shadow-[0_12px_34px_-14px_rgba(106,0,255,0.85)] hover:brightness-110',
    secondary:
      'border border-[var(--ws-border)] bg-white/[0.03] text-white hover:border-[var(--ws-accent)]/50 hover:bg-white/[0.06]',
    ghost: 'text-[var(--ws-body)] hover:text-white',
    danger: 'border border-[var(--ws-error)]/40 bg-[var(--ws-error)]/10 text-[var(--ws-error)] hover:bg-[var(--ws-error)]/20',
  };
  const sizes = { sm: 'px-3.5 py-1.5 text-[13px]', md: 'px-5 py-2.5 text-sm' };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${ws.input} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${ws.input} min-h-28 resize-y ${className}`} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${ws.input} ${className}`} {...props} />;
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
      {hint && <span className="mt-1 block text-xs text-[var(--ws-dim)]">{hint}</span>}
    </label>
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
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--ws-btn)]"
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
    neutral: 'border-[var(--ws-border)] bg-white/[0.04] text-[var(--ws-body)]',
    accent: 'border-[var(--ws-accent)]/35 bg-[var(--ws-accent)]/12 text-[var(--ws-accent)]',
    success: 'border-[var(--ws-success)]/35 bg-[var(--ws-success)]/12 text-[var(--ws-success)]',
    error: 'border-[var(--ws-error)]/35 bg-[var(--ws-error)]/12 text-[var(--ws-error)]',
    pending: 'border-[var(--ws-pending)]/35 bg-[var(--ws-pending)]/12 text-[var(--ws-pending)]',
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
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ws-dim)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={`${ws.card} px-6 py-14 text-center`}>
      <p className={`${ws.heading} text-base font-semibold`}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ws-dim)]">{description}</p>
    </div>
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${ws.card} relative z-10 w-full max-w-lg animate-rise p-5 shadow-2xl sm:p-6`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 id={titleId} className={`${ws.heading} text-lg font-semibold`}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--ws-dim)] hover:text-white"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
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
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className={ws.panelHeader}>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-accent)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ws-border)]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
