'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Globe, Hand, Loader2, Lock, RotateCcw, Search } from 'lucide-react';

import { TOOLS, VISTRIAL_URL } from '@/lib/site/content';
import { cn } from '@/lib/utils';

import { useCycle, useInViewOnce } from './motion';
import { ToolLogo } from './primitives';

const STEPS = ['Planning the research', 'Collecting from sources', 'Sorting what it found', 'Writing the report', 'Waiting for your approval'];

const SOURCES = [
  { label: 'Web', meta: '24 pages', tool: null },
  { label: 'YouTube', meta: '9 videos', tool: TOOLS.youtube },
  { label: 'Meta Ad Library', meta: '31 ads', tool: TOOLS.meta },
  { label: 'TikTok', meta: '6 links', tool: TOOLS.tiktok },
] as const;

type Basis = 'observed' | 'inferred' | 'hypothesis';

const FINDINGS: Array<{ claim: string; basis: Basis; sources: number }> = [
  { claim: 'Most long-running local ads lead with a first-visit offer, not with price.', basis: 'observed', sources: 11 },
  { claim: 'Move-out cleaning is under-served in reviews mentioning “deposit”.', basis: 'inferred', sources: 7 },
  { claim: 'A “before and after” proof angle may outperform discount-led creative.', basis: 'hypothesis', sources: 4 },
];

const BASIS_STYLE: Record<Basis, string> = {
  observed: 'bg-[#52d6a4]/12 text-[#52d6a4]',
  inferred: 'bg-[#9a88fc]/15 text-[#c9bcff]',
  hypothesis: 'bg-[#f0b45c]/12 text-[#f0b45c]',
};

const HOLD_MS = 1100;

/** The draft only moves once a person holds the button down. Mirrors Vistrial's approval step. */
function HoldToApprove() {
  const [progress, setProgress] = useState(0);
  const [approved, setApproved] = useState(false);
  const frame = useRef<number | null>(null);
  const started = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    started.current = null;
    setProgress((current) => (current >= 1 ? current : 0));
  }, []);

  const start = useCallback(() => {
    if (approved || started.current !== null) return;
    started.current = performance.now();
    const tick = (now: number) => {
      const value = Math.min(1, (now - (started.current ?? now)) / HOLD_MS);
      setProgress(value);
      if (value >= 1) {
        frame.current = null;
        started.current = null;
        setApproved(true);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [approved]);

  useEffect(() => () => stop(), [stop]);

  if (approved) {
    return (
      <div className="da-enter flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#52d6a4]/35 bg-[#52d6a4]/10 px-3 py-2" aria-live="polite">
        <span className="flex items-center gap-2 text-[12px] text-white">
          <CheckCircle2 className="size-4 text-[#52d6a4]" aria-hidden />
          Approved by you. Nothing is published without this step.
        </span>
        <button
          type="button"
          onClick={() => {
            setApproved(false);
            setProgress(0);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/55 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#9a88fc]"
        >
          <RotateCcw className="size-3" aria-hidden /> Reset
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
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
      className="relative inline-flex h-9 w-full touch-none items-center justify-center gap-2 overflow-hidden rounded-lg border border-[#9a88fc]/50 bg-black/40 text-[12px] font-medium text-white outline-none select-none focus-visible:ring-2 focus-visible:ring-[#9a88fc] sm:w-auto sm:px-4"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#5a23fc]/60 to-[#9a88fc]/50" style={{ width: `${progress * 100}%` }} />
      <span className="relative inline-flex items-center gap-2">
        {progress > 0 ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Hand className="size-3.5" aria-hidden />}
        {progress > 0 ? 'Keep holding…' : 'Hold to approve'}
      </span>
    </button>
  );
}

export function VistrialDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(ref, 0.25);
  const step = useCycle(STEPS.length, 2300, visible, STEPS.length - 1);
  const pct = ((step + 1) / STEPS.length) * 100;

  return (
    <div ref={ref} className="relative">
      <div aria-hidden className="absolute -inset-8 rounded-[40px] bg-[#5a23fc]/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0b0d] shadow-[0_40px_100px_-40px_rgba(90,35,252,0.9)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] bg-[#111113] px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-white/12" />
            <span className="size-2.5 rounded-full bg-white/12" />
            <span className="size-2.5 rounded-full bg-white/12" />
          </div>
          <a
            href={VISTRIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-black/50 px-3 py-1 text-[11px] text-white/50 transition-colors hover:text-white"
          >
            <Lock className="size-3" aria-hidden />
            <span className="truncate">vistrial.io/research-studio</span>
          </a>
          <span className="da-mono hidden rounded-full bg-white/[0.05] px-2 py-0.5 text-[9px] tracking-[0.12em] text-white/40 uppercase sm:inline">Sample data</span>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/site/brand/vistrial-icon.png" alt="" width={36} height={36} className="size-9 rounded-[10px] ring-1 ring-white/10" />
              <div>
                <p className="da-mono text-[10px] tracking-[0.16em] text-[#b59aff] uppercase">Growth Architect · Research Studio</p>
                <p className="da-display text-[17px] font-semibold tracking-tight text-white">Deep cleaning, Austin TX</p>
              </div>
            </div>
            <span className="da-mono flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-[#52d6a4] uppercase">
              <span className="da-pulse-dot size-1.5 rounded-full bg-[#52d6a4]" /> Live
            </span>
          </div>

          {/* Run progress */}
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between text-[12px]">
              <span key={step} className="da-enter flex items-center gap-2 text-white/85">
                <Search className="size-3.5 text-[#b59aff]" aria-hidden />
                <span className="da-shimmer-text">{STEPS[step]}</span>
              </span>
              <span className="da-mono text-[10px] text-white/40">
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#5a23fc] to-[#b59aff] transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {SOURCES.map((source, index) => (
                <li
                  key={source.label}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors duration-500',
                    step >= 1 && index <= step + 1 ? 'border-white/[0.09] bg-white/[0.03]' : 'border-white/[0.04] opacity-60',
                  )}
                >
                  {source.tool ? <ToolLogo tool={source.tool} size={12} tile={false} /> : <Globe className="size-3 text-[#b59aff]" aria-hidden />}
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] text-white/85">{source.label}</span>
                    <span className="block text-[10px] text-white/40">{source.meta}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Evidence */}
          <ul className="mt-3 space-y-1.5">
            {FINDINGS.map((finding, index) => (
              <li
                key={finding.claim}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 transition-opacity duration-500',
                  step >= 2 || index === 0 ? 'opacity-100' : 'opacity-40',
                )}
              >
                <p className="text-[12px] leading-snug text-white/80">{finding.claim}</p>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('da-mono rounded-md px-1.5 py-0.5 text-[9px] tracking-[0.1em] uppercase', BASIS_STYLE[finding.basis])}>{finding.basis}</span>
                  <span className="text-[10px] text-white/35">{finding.sources} sources</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Deliverable */}
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#9a88fc]/25 bg-[#5a23fc]/[0.07] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/40 ring-1 ring-white/10">
                <FileText className="size-4 text-[#b59aff]" aria-hidden />
              </span>
              <div>
                <p className="text-[13px] font-medium text-white">Opportunity report</p>
                <p className="text-[11px] text-white/45">14 claims · every one sourced · draft</p>
              </div>
            </div>
            <HoldToApprove />
          </div>
        </div>
      </div>
    </div>
  );
}
