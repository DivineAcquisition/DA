'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Hand, Loader2 } from 'lucide-react';
import { BorderBeam } from '@/components/ui/border-beam';
import { cn } from '@/lib/utils';

/*
 * Agentic visuals for the staff admin, ported from the Vistrial landing page
 * and app (src/components/marketing/agentic-visuals.tsx, saas-frame.tsx).
 * Every animation holds its final frame under reduced motion or calm mode.
 */

function prefersStill() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.getAttribute('data-calm') === 'true';
}

/** Steps forward on a timer, and holds the last frame when motion is reduced. */
export function useCycle(length: number, interval = 2600) {
  const [index, setIndex] = useState<number | 'still'>('still');
  useEffect(() => {
    if (length < 2 || prefersStill()) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = window.setInterval(() => setIndex((current) => (current === 'still' ? 0 : (current + 1) % length)), interval);
    const onChange = () => {
      if (media.matches) {
        window.clearInterval(timer);
        setIndex('still');
      }
    };
    media.addEventListener('change', onChange);
    return () => {
      window.clearInterval(timer);
      media.removeEventListener('change', onChange);
    };
  }, [interval, length]);
  return index === 'still' ? Math.max(0, length - 1) : index;
}

/* ---------------------------------------------------------------------------
 * Beams: SVG curves between elements, with a short light travelling each one.
 * Positions are measured, so they follow the layout as it resizes.
 * ------------------------------------------------------------------------- */

export type BeamPath = { d: string; delay: number };

export function useBeamPaths(containerRef: RefObject<HTMLElement | null>, pairs: ReadonlyArray<{ from: string; to: string }>) {
  const [paths, setPaths] = useState<BeamPath[]>([]);
  const key = pairs.map((pair) => `${pair.from}>${pair.to}`).join('|');

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const next: BeamPath[] = [];
    for (const pair of key ? key.split('|').map((part) => part.split('>')) : []) {
      const [fromSelector, toSelector] = pair;
      const target = container.querySelector(toSelector)?.getBoundingClientRect();
      if (!target || target.width === 0) continue;
      container.querySelectorAll(fromSelector).forEach((element) => {
        const from = element.getBoundingClientRect();
        if (from.width === 0) return;
        const x1 = from.right - box.left;
        const y1 = from.top + from.height / 2 - box.top;
        const x2 = target.left - box.left;
        const y2 = target.top + target.height / 2 - box.top;
        if (x2 <= x1) return;
        const bend = Math.max(12, (x2 - x1) * 0.5);
        next.push({ d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`, delay: next.length * 0.45 });
      });
    }
    setPaths(next);
  }, [containerRef, key]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, measure]);

  return paths;
}

/** `track` is the resting line under the light; pass a dark hairline on a white page. */
export function Beams({ paths, id, track = 'var(--panel-border, rgba(255,255,255,0.08))' }: { paths: BeamPath[]; id: string; track?: string }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block">
      <defs>
        <linearGradient id={`${id}-glow`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#9A88FC" stopOpacity="0" />
          <stop offset="50%" stopColor="#9A88FC" />
          <stop offset="100%" stopColor="#6650D8" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {paths.map((path, index) => (
        <g key={index}>
          <path d={path.d} fill="none" stroke={track} strokeWidth="1.5" />
          <path
            d={path.d}
            pathLength={100}
            fill="none"
            stroke={`url(#${id}-glow)`}
            strokeWidth="2"
            strokeLinecap="round"
            className="beam-dash"
            style={{ animationDelay: `${path.delay}s` }}
          />
        </g>
      ))}
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Small pieces
 * ------------------------------------------------------------------------- */

export type LiveTone = 'waiting' | 'working' | 'clear' | 'idle';

const DOT: Record<LiveTone, string> = {
  waiting: 'bg-brand-400 live-ring',
  working: 'bg-brand-400 live-pulse',
  clear: 'bg-emerald-400',
  idle: 'bg-neutral-500/50',
};

/** A status dot. Waiting rings, working breathes, clear and idle hold still. */
export function LiveDot({ tone, className, label }: { tone: LiveTone; className?: string; label?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn('inline-block size-2 shrink-0 rounded-full', DOT[tone], className)} />;
}

/** One line of status that cycles, with the light sweep Vistrial uses for a working agent. */
export function ShimmerStatus({ lines, className, interval = 2600 }: { lines: string[]; className?: string; interval?: number }) {
  const index = useCycle(lines.length, interval);
  if (lines.length === 0) return null;
  return (
    <p className={cn('text-xs leading-relaxed text-neutral-400', className)} aria-live="off">
      <span key={index} className="live-shimmer-text live-enter">
        {lines[index]}
      </span>
    </p>
  );
}

/** A product frame with the purple wash and a light travelling its edge. */
export function GlowFrame({ children, className, beam = true }: { children: ReactNode; className?: string; beam?: boolean }) {
  return (
    <div className={cn('panel frame-glow relative overflow-hidden rounded-2xl', className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand-500/20 to-transparent" />
      {beam ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
          <BorderBeam duration={9} size={110} borderWidth={1} colorFrom="#9A88FC" colorTo="#C3B6FE" />
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The lifecycle flow: stages joined by beams, like the Vistrial agent flow.
 * The busiest stage that needs a person glows as the "agent".
 * ------------------------------------------------------------------------- */

export type FlowStage = {
  key: string;
  label: string;
  count: number;
  hint: string;
  href?: string;
  /** Items here wait on a person (they ring), or move on their own (they breathe). */
  kind: 'person' | 'auto';
};

const COLS: Record<number, string> = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

export function LifecycleFlow({ stages, statuses, label }: { stages: FlowStage[]; statuses: string[]; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pairs = stages.slice(0, -1).map((_, index) => ({ from: `[data-flow="${index}"]`, to: `[data-flow="${index + 1}"]` }));
  const paths = useBeamPaths(containerRef, pairs);
  const busiest = stages.reduce<number>((best, stage, index) => (stage.kind === 'person' && stage.count > (stages[best]?.count ?? -1) ? index : best), -1);
  const focus = busiest >= 0 && stages[busiest].count > 0 ? busiest : -1;

  return (
    <GlowFrame className="p-5 sm:p-6" beam={focus >= 0}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">{label}</p>
        <ShimmerStatus lines={statuses} />
      </div>
      <div ref={containerRef} className="relative">
        <Beams paths={paths} id={`flow-${label.replace(/\W+/g, '-').toLowerCase()}`} />
        <ol className={cn('relative grid gap-3 sm:grid-cols-2 lg:gap-10', COLS[stages.length] ?? 'lg:grid-cols-4')}>
          {stages.map((stage, index) => {
            const tone: LiveTone = stage.count === 0 ? 'idle' : stage.kind === 'person' ? 'waiting' : 'working';
            const body = (
              <>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{stage.label}</span>
                  <LiveDot tone={tone} label={stage.count === 0 ? 'Clear' : stage.kind === 'person' ? 'Waiting on a person' : 'Moving'} />
                </span>
                <span className="mt-2 block text-3xl font-semibold tabular-nums text-white">{stage.count}</span>
                <span className="mt-1 block text-xs text-neutral-500">{stage.hint}</span>
              </>
            );
            const className = cn(
              'relative block rounded-xl border bg-ink-950 p-4 transition-colors',
              index === focus ? 'agent-glow border-brand-400/50' : 'border-white/[0.08] hover:border-white/20',
            );
            return (
              <li key={stage.key} data-flow={index} className="app-enter" style={{ animationDelay: `${index * 60}ms` }}>
                {stage.href ? (
                  <Link href={stage.href} className={className}>
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </GlowFrame>
  );
}

/* ---------------------------------------------------------------------------
 * Hold to approve: a consequential action only moves when a person holds it.
 * It submits the form it sits in once the hold completes.
 * ------------------------------------------------------------------------- */

const HOLD_MS = 1200;

export function HoldToSubmit({ children, holding = 'Keep holding', hint, className }: { children: ReactNode; holding?: string; hint?: string; className?: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const started = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    started.current = null;
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    if (started.current !== null) return;
    started.current = performance.now();
    const tick = (now: number) => {
      const value = Math.min(1, (now - (started.current ?? now)) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        frame.current = null;
        started.current = null;
        setProgress(0);
        button.current?.form?.requestSubmit();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => stop(), [stop]);
  const hintId = useId();

  return (
    <div className="grid gap-1.5">
      <button
        ref={button}
        type="button"
        aria-describedby={hint ? hintId : undefined}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(event) => {
          if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault();
            start();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === ' ' || event.key === 'Enter') stop();
        }}
        onBlur={stop}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'relative inline-flex h-10 touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-lg border border-brand-500/50 bg-ink-950 px-5 text-sm font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 disabled:opacity-50',
          className,
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-400/35 to-brand-600/35" style={{ width: `${progress * 100}%` }} />
        <span className="relative inline-flex items-center gap-2">
          {progress > 0 ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Hand className="size-4" aria-hidden />}
          {progress > 0 ? holding : children}
        </span>
      </button>
      {hint ? (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
