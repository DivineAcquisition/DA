'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, FileText, GraduationCap, Mail, Search, Send, UserCheck, Video } from 'lucide-react';
import { Beams, ShimmerStatus, useBeamPaths, useCycle } from '@/components/agentic/agentic';
import { cn } from '@/lib/utils';
import { isSalesOperatorRole } from '@/lib/careers/roles';
import { levelLabels, roleHref, type Role } from '../../data/roles';
import { FrameDots, GlowFrame, StepBadge, inset } from './careers-ui';

/*
 * The careers site's agentic layer, on the light Vistrial marketing system
 * (src/components/marketing/agentic-visuals.tsx, growth-visuals.tsx). It shows
 * what really happens to an application: a person reads it in the Applicants
 * inbox, and advancing it opens an operator file, enrols the hire in the
 * Academy, and sends the invite. Motion holds still under reduced motion.
 */

const TRACK = 'rgba(154, 136, 252, 0.2)';

/** A live green dot: the role is open. */
export function HiringNow({ className, label = 'Hiring' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300', className)}>
      <span aria-hidden className="live-pulse size-1.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Hero frame: the hiring desk, with the real open roles
 * ------------------------------------------------------------------------- */

const DESK_STATUS = ['Reading new applications', 'Opening operator files', 'Enrolling new hires in the Academy', 'Placing Ready operators on client seats'];

export function HiringDeskFrame({ roles }: { roles: Role[] }) {
  const step = useCycle(5, 2600);
  return (
    <GlowFrame>
      <FrameDots label="Live roles" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-c-violet">Divine Acquisition · Hiring desk</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xl font-medium tracking-tight text-c-ink">{roles.length} open roles</p>
        <HiringNow label="Live" />
      </div>

      <div className={cn(inset, 'mt-4 p-3')}>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-c-ink">
            <Search className="size-3.5 text-[#7e67f2]" aria-hidden />
            <ShimmerStatus lines={DESK_STATUS} className="!text-sm !text-c-ink" />
          </span>
          <span className="text-xs text-c-muted tabular-nums">Step {step + 1} of 5</span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#c3b6fe] to-[#7e67f2] transition-[width] duration-700" style={{ width: `${((step + 1) / 5) * 100}%` }} />
        </div>
      </div>

      <ul className="mt-4 grid gap-2">
        {roles.slice(0, 4).map((role, index) => (
          <li key={role.slug}>
            <Link
              href={roleHref(role)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg border bg-c-card px-3 py-2.5 transition-colors hover:border-[#9a88fc]/60',
                index === 0 ? 'border-c-tint-line shadow-[0_8px_24px_-16px_rgba(126,103,242,0.8)]' : 'border-c-line',
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-c-ink">{role.title}</span>
                <span className="block truncate text-xs text-c-muted">
                  {role.departmentLabel} · {levelLabels[role.level]}
                </span>
              </span>
              <HiringNow />
            </Link>
          </li>
        ))}
      </ul>

      <div className={cn(inset, 'mt-4 flex items-center justify-between gap-3 p-3')}>
        <p className="text-sm text-c-ink">Every application is read by a person.</p>
        <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">One inbox</span>
      </div>
    </GlowFrame>
  );
}

/* ---------------------------------------------------------------------------
 * Strip under the hero: what you send, the hiring desk, what comes back
 * ------------------------------------------------------------------------- */

const FLOW_BEAMS = [
  { from: '[data-beam="source"]', to: '[data-beam="agent"]' },
  { from: '[data-beam="agent"]', to: '[data-beam="output"]' },
] as const;

const SOURCES = [
  { key: 'application', label: 'Your application', icon: FileText },
  { key: 'loom', label: 'A short Loom intro', icon: Video },
  { key: 'availability', label: 'Your availability', icon: CalendarClock },
];

export function HiringFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const paths = useBeamPaths(containerRef, FLOW_BEAMS);

  return (
    <section aria-label="How an application moves" className="border-y border-c-line bg-c-card px-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl py-10 sm:py-12">
        <div ref={containerRef} className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-20">
          <Beams paths={paths} id="careers-flow" track={TRACK} />

          <div className="relative">
            <p className="mb-3 text-sm font-medium text-c-muted lg:text-right">What you send</p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 lg:justify-items-end">
              {SOURCES.map((item) => (
                <li key={item.key} data-beam="source" className="inline-flex w-full items-center gap-2 rounded-md border border-c-line bg-c-card px-2.5 py-1.5 text-sm font-medium text-c-ink lg:w-auto">
                  <item.icon className="size-4 text-[#7e67f2]" aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <div
            data-beam="agent"
            className="relative mx-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-xl border border-c-tint-line bg-c-card p-5 text-center shadow-[0_0_60px_-24px_rgba(154,136,252,0.9)] lg:w-64"
          >
            <span className="relative flex size-14 items-center justify-center rounded-full border border-c-tint-line bg-c-card shadow-[0_0_0_4px_rgba(154,136,252,0.12)]">
              <UserCheck className="size-6 text-[#5140a9]" aria-hidden />
              <span aria-hidden className="live-pulse absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-c-page bg-emerald-500" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-c-violet">Read by a person</p>
              <p className="text-lg font-medium tracking-tight text-c-ink">The hiring desk</p>
            </div>
            <ShimmerStatus lines={DESK_STATUS} interval={2400} className="min-h-10 text-center !text-c-muted" />
          </div>

          <div data-beam="output" className="relative mx-auto w-full max-w-xs rounded-xl border border-c-line bg-c-card p-4 lg:mx-0">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-c-line bg-c-soft">
                <Mail className="size-4 text-[#7e67f2]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-c-ink">Your invite and operator file</p>
                <p className="text-xs text-c-muted">Account, onboarding, and the Academy</p>
              </div>
            </div>
            <span className="mt-3 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">
              Sent when you are advanced
            </span>
          </div>
        </div>
        <p className="mt-6 text-xs text-c-muted lg:text-center">Every application lands in one inbox and a person reads it. Advance, and your file opens with the Academy ready.</p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * After you apply: Vistrial's step cards, one stage "in progress" at a time
 * ------------------------------------------------------------------------- */

type Step = { key: string; label: string; detail: string; icon: typeof Send };

const OPERATOR_PATH: Step[] = [
  { key: 'apply', label: 'Apply', detail: 'Send the form on the role page.', icon: Send },
  { key: 'review', label: 'Read by a person', detail: 'Every application is read.', icon: UserCheck },
  { key: 'invite', label: 'Invite and account', detail: 'Your login and your operator file.', icon: Mail },
  { key: 'academy', label: 'Onboarding and Academy', detail: 'Training before any live work.', icon: GraduationCap },
  { key: 'placed', label: 'Placed on a client', detail: 'Your seat, your shift, your EOD.', icon: CheckCircle2 },
];

const GENERAL_PATH: Step[] = [
  { key: 'apply', label: 'Apply', detail: 'Send the form on the role page.', icon: Send },
  { key: 'review', label: 'Read by a person', detail: 'Every application is read.', icon: UserCheck },
  { key: 'talk', label: 'A conversation', detail: 'With the person you would work with.', icon: CalendarClock },
  { key: 'offer', label: 'Offer and start', detail: 'Clear terms, then onboarding.', icon: CheckCircle2 },
];

export function ApplicantPath({ roleSlug, className }: { roleSlug: string; className?: string }) {
  const steps = isSalesOperatorRole(roleSlug) ? OPERATOR_PATH : GENERAL_PATH;
  const current = useCycle(steps.length, 2400);
  const cols = steps.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  return (
    <ol aria-label="What happens after you apply" className={cn('grid gap-3 sm:grid-cols-2', cols, className)}>
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'running' : 'queued';
        return (
          <li
            key={step.key}
            className={cn(
              'relative flex flex-col rounded-xl border bg-c-card p-5 transition-shadow duration-500',
              state === 'running' ? 'border-c-tint-line shadow-[0_0_48px_-20px_rgba(154,136,252,0.9)]' : 'border-c-line shadow-[0_16px_40px_-24px_rgba(0,0,0,0.7)]',
            )}
          >
            {state === 'running' ? <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 rounded-t-xl bg-gradient-to-b from-[#9a88fc]/15 to-transparent" /> : null}
            <span className="relative flex size-11 items-center justify-center rounded-lg border border-c-line bg-c-soft">
              <step.icon className="size-5 text-[#7e67f2]" aria-hidden />
            </span>
            <span className="relative mt-4 flex items-center justify-between gap-2 border-t border-c-line pt-3">
              <span className="rounded-full border border-c-line px-1.5 text-[11px] tabular-nums text-c-muted">{String(index + 1).padStart(2, '0')}</span>
              <StepBadge state={state} />
            </span>
            <span className="relative mt-3 text-lg font-medium tracking-tight text-c-ink">{step.label}</span>
            <span className="relative mt-1 text-sm leading-relaxed text-c-muted">{step.detail}</span>
            {index < steps.length - 1 ? (
              <ArrowRight aria-hidden className="absolute -right-[13px] top-1/2 z-10 hidden size-4 -translate-y-1/2 text-[#7e67f2] lg:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
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
      <Beams paths={paths} id={id} track={TRACK} />
      {children}
    </div>
  );
}

/** The live state of a submitting application. */
export function SubmittingLine({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="live-pulse size-2 rounded-full bg-[#5140a9]" />
      <span className="live-shimmer-text">{children}</span>
    </span>
  );
}
