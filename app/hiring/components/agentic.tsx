'use client';

import { useRef, type ReactNode } from 'react';
import { CalendarClock, CheckCircle2, FileText, GraduationCap, Mail, Send, UserCheck, Video } from 'lucide-react';
import { Beams, LiveDot, ShimmerStatus, useBeamPaths } from '@/components/agentic/agentic';
import '@/components/agentic/agentic.css';
import { cn } from '@/lib/utils';
import { isSalesOperatorRole } from '@/lib/careers/roles';

/*
 * The careers site's agentic layer, after the Vistrial landing page
 * (src/components/marketing/agentic-visuals.tsx). It shows what really
 * happens to an application: a person reads it in the Applicants inbox, and
 * advancing it opens an operator file, enrols the hire in the Academy, and
 * sends the invite. Motion holds still under reduced motion.
 */

const FLOW_BEAMS = [
  { from: '[data-beam="source"]', to: '[data-beam="agent"]' },
  { from: '[data-beam="agent"]', to: '[data-beam="output"]' },
] as const;

const SOURCES = [
  { key: 'application', label: 'Your application', icon: FileText },
  { key: 'loom', label: 'A short Loom intro', icon: Video },
  { key: 'availability', label: 'Your availability', icon: CalendarClock },
];

const STATUSES = [
  'Reading new applications',
  'Opening operator files',
  'Enrolling new hires in the Academy',
  'Placing Ready operators on client seats',
];

/** Sources beam into the hiring desk; the desk hands back an operator file. Under the board hero. */
export function HiringFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const paths = useBeamPaths(containerRef, FLOW_BEAMS);

  return (
    <section aria-label="How hiring works" className="relative border-y border-white/[0.07] bg-ink-900/60 px-5 sm:px-6">
      <div className="mx-auto max-w-5xl py-10 sm:py-12">
        <div ref={containerRef} className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-20">
          <Beams paths={paths} id="hiring-flow" />

          <div className="relative">
            <p className="mb-3 text-sm font-medium text-neutral-400 lg:text-right">What you send</p>
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:justify-items-end">
              {SOURCES.map((item) => (
                <li
                  key={item.key}
                  data-beam="source"
                  className="inline-flex w-full items-center gap-2 rounded-md border border-white/[0.08] bg-ink-950 px-2.5 py-1.5 text-sm font-medium text-white lg:w-auto"
                >
                  <item.icon className="size-4 text-brand-400" aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-beam="agent"
            className="agent-glow relative mx-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-brand-400/40 bg-ink-950 p-5 text-center lg:w-64"
          >
            <span className="relative flex size-14 items-center justify-center rounded-full border border-brand-400/40 bg-ink-950 shadow-[0_0_0_4px_rgba(154,136,252,0.12)]">
              <UserCheck className="size-6 text-brand-300" aria-hidden />
              <span aria-hidden className="live-pulse absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-ink-950 bg-emerald-400" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-200">Read by a person</p>
              <p className="text-lg font-semibold tracking-tight text-white">The hiring desk</p>
            </div>
            <ShimmerStatus lines={STATUSES} interval={2400} className="min-h-10 text-center" />
          </div>

          <div data-beam="output" className="relative mx-auto w-full max-w-xs rounded-xl border border-white/[0.08] bg-ink-950 p-4 lg:mx-0">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                <Mail className="size-4 text-brand-400" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">Your invite and operator file</p>
                <p className="text-xs text-neutral-500">Account, onboarding, and the Academy</p>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">
              <LiveDot tone="working" className="size-1.5 bg-amber-300" />
              Sent when you are advanced
            </span>
          </div>
        </div>
        <p className="mt-6 text-xs text-neutral-500 lg:text-center">
          Every application lands in one inbox and a person reads it. Advance, and your file opens at Invited with the Academy ready.
        </p>
      </div>
    </section>
  );
}

/** A small live marker for a role that is open. */
export function HiringNow({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300', className)}>
      <LiveDot tone="clear" className="live-pulse" />
      Hiring
    </span>
  );
}

type Step = { key: string; label: string; detail: string; icon: typeof Send };

const OPERATOR_PATH: Step[] = [
  { key: 'apply', label: 'Apply', detail: 'The form below.', icon: Send },
  { key: 'review', label: 'Read by a person', detail: 'Every application is read.', icon: UserCheck },
  { key: 'invite', label: 'Invite and account', detail: 'Your login and operator file.', icon: Mail },
  { key: 'academy', label: 'Onboarding and Academy', detail: 'Training before live work.', icon: GraduationCap },
  { key: 'placed', label: 'Placed on a client', detail: 'Your seat, your shift, your EOD.', icon: CheckCircle2 },
];

const GENERAL_PATH: Step[] = [
  { key: 'apply', label: 'Apply', detail: 'The form below.', icon: Send },
  { key: 'review', label: 'Read by a person', detail: 'Every application is read.', icon: UserCheck },
  { key: 'talk', label: 'A conversation', detail: 'With the person you would work with.', icon: CalendarClock },
  { key: 'offer', label: 'Offer and start', detail: 'Clear terms, then onboarding.', icon: CheckCircle2 },
];

/**
 * What happens after you apply, as a beam-connected path. Sales Operator roles
 * show the real operator lifecycle; other roles show the interview path.
 */
export function ApplicantPath({ roleSlug, className, compact = false }: { roleSlug: string; className?: string; compact?: boolean }) {
  const steps = isSalesOperatorRole(roleSlug) ? OPERATOR_PATH : GENERAL_PATH;
  const containerRef = useRef<HTMLDivElement>(null);
  const pairs = steps.slice(0, -1).map((_, index) => ({ from: `[data-path="${index}"]`, to: `[data-path="${index + 1}"]` }));
  const paths = useBeamPaths(containerRef, pairs);
  // In a narrow column the path wraps; beams only join steps that sit side by side.
  const cols = compact ? 'md:grid-cols-3' : steps.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';

  return (
    <section aria-label="What happens after you apply" className={cn('frame-glow relative overflow-hidden rounded-3xl border border-white/[0.08] bg-ink-900 p-5 sm:p-7', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand-500/20 to-transparent" />
      <div className="relative">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">After you apply</p>
          <ShimmerStatus lines={steps.map((step, index) => `Step ${index + 1} of ${steps.length}: ${step.label}`)} interval={2200} />
        </div>
        <div ref={containerRef} className="relative">
          <Beams paths={paths} id={`path-${roleSlug}`} />
          <ol className={cn('relative grid gap-3 sm:grid-cols-2 lg:gap-8', cols)}>
            {steps.map((step, index) => (
              <li
                key={step.key}
                data-path={index}
                className={cn(
                  'app-enter relative rounded-xl border bg-ink-950 p-4',
                  index === 0 ? 'agent-glow border-brand-400/50' : 'border-white/[0.08]',
                )}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
                    <step.icon className="size-4 text-brand-300" aria-hidden />
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-neutral-500">{String(index + 1).padStart(2, '0')}</span>
                </span>
                <span className="mt-3 block text-sm font-semibold text-white">{step.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-neutral-500">{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** The live state of a submitting application, in the Vistrial agent voice. */
export function SubmittingLine({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LiveDot tone="working" />
      <span className="live-shimmer-text">{children}</span>
    </span>
  );
}

/**
 * Draws beams between the [data-step] children of a row, left to right. Wrap a
 * step list in it to join its cards with the travelling light.
 */
export function BeamRow({ count, id, children, className }: { count: number; id: string; children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pairs = Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({ from: `[data-step="${index}"]`, to: `[data-step="${index + 1}"]` }));
  const paths = useBeamPaths(containerRef, pairs);
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Beams paths={paths} id={id} />
      {children}
    </div>
  );
}
