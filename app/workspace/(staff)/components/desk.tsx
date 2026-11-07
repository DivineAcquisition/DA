import Link from 'next/link';
import type { ReactNode } from 'react';
import { LiveDot } from './agentic';

/** Shared pieces for the four desks, so a queue and a case file read the same everywhere. */

export const field =
  'h-9 rounded-lg border border-white/10 bg-ink-950 px-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-brand-400/60 focus:outline-none';
export const area = `${field} h-auto min-h-[72px] py-2`;
export const primary =
  'inline-flex h-9 items-center justify-center rounded-lg bg-[#6A00FF] px-3.5 text-sm font-medium text-white hover:bg-[#7a1aff] disabled:opacity-50';
export const secondary =
  'inline-flex h-9 items-center justify-center rounded-lg border border-white/15 px-3.5 text-sm text-neutral-200 hover:border-white/30 hover:text-white disabled:opacity-50';
export const danger =
  'inline-flex h-9 items-center justify-center rounded-lg border border-[#FFB020]/40 px-3.5 text-sm text-[#FFB020] hover:border-[#FFB020]/70 disabled:opacity-50';

export function DeskHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-neutral-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({ id, title, hint, children, aside }: { id?: string; title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="panel scroll-mt-24 rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-neutral-500">{hint}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
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
  brand: 'border-brand-500/30 bg-brand-500/10 text-brand-200',
  good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  bad: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
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
