'use client';

import Link from 'next/link';
import { formatPercent, initials } from '@/lib/vistrial/format';

/**
 * Hub primitives, built from the marketing site's tokens and `panel` surface so
 * the two properties read as one product. Nothing here introduces a new visual
 * language; it just packages the existing one at app density.
 */

export type Tone = 'brand' | 'neutral' | 'good' | 'warning' | 'critical';

const TONE_CLASSES: Record<Tone, string> = {
  brand: 'border-brand-500/30 bg-brand-500/[0.12] text-brand-200',
  neutral: 'border-white/10 bg-white/[0.04] text-neutral-300',
  good: 'border-flag-good/30 bg-flag-good/[0.12] text-flag-good',
  warning: 'border-flag-warning/30 bg-flag-warning/[0.12] text-flag-warning',
  critical: 'border-flag-critical/30 bg-flag-critical/[0.12] text-flag-critical',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = 'brand' }: { tone?: Tone }) {
  const colour = {
    brand: 'bg-brand-500',
    neutral: 'bg-neutral-600',
    good: 'bg-flag-good',
    warning: 'bg-flag-warning',
    critical: 'bg-flag-critical',
  }[tone];
  return <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${colour}`} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-300">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-[28px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  hint,
  actions,
}: {
  title: string;
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{title}</h2>
        {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  children,
  className = '',
  as: Component = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Component className={`panel rounded-2xl ${className}`}>{children}</Component>;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  const valueTone = {
    brand: 'text-brand-300',
    neutral: 'text-white',
    good: 'text-flag-good',
    warning: 'text-flag-warning',
    critical: 'text-flag-critical',
  }[tone];

  return (
    <div className="bg-ink-950/85 px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs leading-snug text-neutral-500">{hint}</p>}
    </div>
  );
}

/** Grid wrapper that gives StatTile children their hairline dividers. */
export function StatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <dl
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.06] ${cols}`}
    >
      {children}
    </dl>
  );
}

export function Meter({ value, tone = 'brand' }: { value: number; tone?: Tone }) {
  const fill = {
    brand: 'bg-brand-500',
    neutral: 'bg-neutral-500',
    good: 'bg-flag-good',
    warning: 'bg-flag-warning',
    critical: 'bg-flag-critical',
  }[tone];

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${fill}`}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="px-6 py-12 text-center">
      <p className="text-sm font-medium text-neutral-300">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-neutral-500">{detail}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Panel>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dimensions = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border border-brand-500/25 bg-brand-500/[0.12] font-semibold text-brand-200 ${dimensions}`}
    >
      {initials(name)}
    </span>
  );
}

export function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-full shrink-0 text-xs font-medium uppercase tracking-[0.1em] text-neutral-500 sm:w-52">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-neutral-200">{children}</dd>
    </div>
  );
}

export function DefinitionList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-white/[0.05]">{children}</dl>;
}

export function RowLink({
  href,
  children,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`panel panel-hover block rounded-2xl px-5 py-4 focus-visible:outline-none ${className}`}
    >
      {children}
    </Link>
  );
}

/** Compliance colouring used consistently wherever a rate is shown. */
export function rateTone(rate: number): Tone {
  if (rate >= 0.9) return 'good';
  if (rate >= 0.75) return 'warning';
  return 'critical';
}

export function RatePill({ rate, label }: { rate: number; label?: string }) {
  return (
    <Badge tone={rateTone(rate)}>
      {formatPercent(rate)}
      {label ? ` ${label}` : ''}
    </Badge>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 transition-colors focus:border-brand-500/60 focus:bg-white/[0.05] focus:outline-none';

export const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500';

export const selectClass = `${inputClass} cursor-pointer appearance-none bg-ink-900 pr-9`;
