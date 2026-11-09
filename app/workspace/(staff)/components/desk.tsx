import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { LiveDot } from './agentic';

/** Shared pieces for the four desks, so a queue and a case file read the same everywhere. */

export const field =
  'h-9 rounded-lg border border-[var(--field-border,rgba(255,255,255,0.12))] bg-[var(--field-bg,#100f18)] px-2.5 text-sm text-white placeholder:text-neutral-500 transition-[border-color,box-shadow] focus:border-brand-400/60 focus:shadow-[0_0_0_3px_rgba(154,136,252,0.18)] focus:outline-none';
export const area = `${field} h-auto min-h-[72px] py-2`;
/** Vistrial's primary: lavender gradient, dark label (styled by .da-primary). */
export const primary =
  'da-primary inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-[background-image] disabled:opacity-50';
export const secondary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.02] px-3.5 text-sm text-neutral-200 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50';
export const danger =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-flag-critical/40 px-3.5 text-sm text-flag-critical transition-colors hover:bg-flag-critical/10 disabled:opacity-50';

/**
 * The page header from the Vistrial app: a small breadcrumb, a medium-weight
 * title, a status pill or actions on the right, and a hairline underneath.
 */
export function DeskHeader({
  title,
  description,
  actions,
  crumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  crumb?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-5">
      <div className="min-w-0">
        {crumb ? <p className="mb-1 text-[13px] text-neutral-500">{crumb}</p> : null}
        <h1 className="text-[22px] font-medium tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-neutral-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A Vistrial card: rounded, hairline, a medium title with an optional icon. */
export function Section({
  id,
  title,
  hint,
  children,
  aside,
  icon: Icon,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: ReactNode;
  aside?: ReactNode;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}) {
  return (
    <section id={id} className="panel scroll-mt-24 rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-white">
            {Icon ? <Icon className="size-4 text-brand-300" aria-hidden /> : null}
            {title}
          </h2>
          {hint ? <p className="mt-0.5 text-[13px] text-neutral-500">{hint}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A stat tile: a quiet uppercase label over a plain number, in a bordered tile. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      <p className="mt-1 text-lg tabular-nums text-white">{value}</p>
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{children}</dd>
    </div>
  );
}

const TONES = {
  neutral: 'border-white/10 bg-white/[0.04] text-neutral-300',
  brand: 'border-brand-500/30 bg-brand-500/12 text-brand-200',
  good: 'border-flag-good/30 bg-flag-good/10 text-flag-good',
  warn: 'border-flag-warning/30 bg-flag-warning/10 text-flag-warning',
  bad: 'border-flag-critical/30 bg-flag-critical/10 text-flag-critical',
} as const;

const DOTS = {
  neutral: 'bg-neutral-500',
  brand: 'bg-brand-400',
  good: 'bg-flag-good',
  warn: 'bg-flag-warning',
  bad: 'bg-flag-critical',
} as const;

export type Tone = keyof typeof TONES;

/** Vistrial's status badge: a rounded pill with a tinted fill and a dot. */
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="panel rounded-2xl px-5 py-8 text-center text-sm text-neutral-400">{children}</p>;
}

export function Problem({ children }: { children: ReactNode }) {
  return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{children}</p>;
}

/**
 * The single next step, at the top of a case file. Drawn as the Vistrial
 * agent node: a glowing card, a ringing dot, and the step in a light sweep.
 */
export function NextStep({ label, href }: { label: string; href: string | null }) {
  const body = (
    <>
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-brand-400/40 bg-ink-950 shadow-[0_0_0_4px_rgba(154,136,252,0.12)]">
        <LiveDot tone={href ? 'waiting' : 'clear'} className="size-2.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">Next</span>
        <span className={`block text-sm text-white ${href ? 'live-shimmer-text' : ''}`}>{label}</span>
      </span>
      {href ? <span className="shrink-0 text-sm font-medium text-brand-200">Go</span> : null}
    </>
  );
  const className = 'agent-glow app-enter flex items-center gap-3 rounded-xl border border-brand-400/40 bg-brand-500/[0.06] px-4 py-3';
  return href ? (
    <Link href={href} className={`${className} transition-colors hover:border-brand-400/70`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
