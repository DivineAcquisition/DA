'use client';

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Activity } from 'lucide-react';

import {
  SYSTEM_AI,
  SYSTEM_AUTOMATION,
  SYSTEM_OUTPUTS,
  SYSTEM_SOURCES,
  SYSTEM_STATUSES,
  type Tool,
} from '@/lib/site/content';
import { cn } from '@/lib/utils';

import { useCycle, useInViewOnce } from './motion';
import { ToolLogo } from './primitives';

/** Which source and destination each status line lights up. */
const ROUTES: Array<{ source: number; output: number }> = [
  { source: 0, output: 0 },
  { source: 1, output: 1 },
  { source: 2, output: 0 },
  { source: 3, output: 2 },
  { source: 0, output: 2 },
  { source: 1, output: 3 },
];

type Beam = { d: string; kind: 'in' | 'out'; index: number };

/** Measures curved paths from each source to the hub and from the hub to each output. */
function useBeams(ref: RefObject<HTMLDivElement | null>) {
  const [beams, setBeams] = useState<Beam[]>([]);
  const measure = useCallback(() => {
    const root = ref.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const hub = root.querySelector('[data-node="hub"]')?.getBoundingClientRect();
    if (!hub || hub.width === 0) return;
    const next: Beam[] = [];
    const curve = (x1: number, y1: number, x2: number, y2: number) => {
      const bend = Math.max(30, (x2 - x1) * 0.55);
      return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
    };
    root.querySelectorAll<HTMLElement>('[data-node="source"]').forEach((node, index) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0) return;
      const y2 = hub.top + hub.height * (0.3 + index * 0.13) - box.top;
      next.push({ kind: 'in', index, d: curve(r.right - box.left, r.top + r.height / 2 - box.top, hub.left - box.left, y2) });
    });
    root.querySelectorAll<HTMLElement>('[data-node="output"]').forEach((node, index) => {
      const r = node.getBoundingClientRect();
      if (r.width === 0) return;
      const y1 = hub.top + hub.height * (0.3 + index * 0.13) - box.top;
      next.push({ kind: 'out', index, d: curve(hub.right - box.left, y1, r.left - box.left, r.top + r.height / 2 - box.top) });
    });
    setBeams(next);
  }, [ref]);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure, ref]);

  return beams;
}

function LogoStack({ tools }: { tools: Tool[] }) {
  return (
    <span className="flex -space-x-1.5">
      {tools.map((tool) => (
        <ToolLogo key={tool.id} tool={tool} size={14} className="ring-2 ring-[#101012]" />
      ))}
    </span>
  );
}

function NodeCard({
  kind,
  label,
  detail,
  tools,
  active,
}: {
  kind: 'source' | 'output';
  label: string;
  detail: string;
  tools: Tool[];
  active: boolean;
}) {
  return (
    <li
      data-node={kind}
      className={cn(
        'relative flex items-center gap-3 rounded-xl border bg-[#101012] px-3 py-2.5 transition-all duration-500',
        active
          ? 'border-[#9a88fc]/60 shadow-[0_0_0_3px_rgba(90,35,252,0.16),0_0_40px_-12px_rgba(90,35,252,0.9)]'
          : 'border-white/[0.07]',
        kind === 'source' ? 'lg:flex-row-reverse lg:text-right' : '',
      )}
    >
      <LogoStack tools={tools} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-white">{label}</span>
        <span className="block truncate text-[11px] text-white/45">{detail}</span>
      </span>
    </li>
  );
}

function Hub({ status, step }: { status: string; step: number }) {
  return (
    <div
      data-node="hub"
      className="relative mx-auto flex w-full max-w-[300px] flex-col items-center rounded-2xl border border-[#9a88fc]/35 bg-[#0d0c14] px-5 pt-6 pb-5 text-center shadow-[0_0_80px_-20px_rgba(90,35,252,0.85)] lg:w-[300px]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-2xl bg-gradient-to-b from-[#5a23fc]/25 to-transparent" />
      <div className="relative flex size-[88px] items-center justify-center">
        <span aria-hidden className="da-orbit absolute inset-0 rounded-full border border-dashed border-[#9a88fc]/35" />
        <span aria-hidden className="da-orbit-reverse absolute inset-[9px] rounded-full border border-[#9a88fc]/20" />
        <span aria-hidden className="absolute top-0 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#b59aff] shadow-[0_0_10px_2px_rgba(181,154,255,0.8)]" />
        <span className="relative flex size-14 items-center justify-center rounded-full bg-[#141220] shadow-[0_0_0_1px_rgba(154,136,252,0.35),0_0_30px_-4px_rgba(90,35,252,0.9)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/site/brand/da-crest.png" alt="" width={382} height={512} className="h-8 w-auto" />
        </span>
      </div>
      <p className="da-mono relative mt-4 text-[10px] tracking-[0.2em] text-[#b59aff] uppercase">Systems layer</p>
      <p className="da-display relative mt-1 text-lg font-semibold tracking-tight text-white">Divine Acquisition</p>

      <div className="relative mt-4 w-full rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 text-left">
        <div className="flex items-center justify-between">
          <span className="da-mono flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-white/45 uppercase">
            <Activity className="size-3 text-[#52d6a4]" aria-hidden /> Event
          </span>
          <span className="da-mono text-[10px] text-white/35">
            {String(step + 1).padStart(2, '0')}/{String(SYSTEM_STATUSES.length).padStart(2, '0')}
          </span>
        </div>
        <p key={status} className="da-enter mt-1.5 min-h-[34px] text-[12px] leading-snug text-white/85">
          <span className="da-shimmer-text">{status}</span>
        </p>
      </div>

      <div className="relative mt-4 grid w-full grid-cols-2 gap-2 text-left">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="da-mono text-[9px] tracking-[0.16em] text-white/40 uppercase">AI assist</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SYSTEM_AI.map((tool) => (
              <ToolLogo key={tool.id} tool={tool} size={13} />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="da-mono text-[9px] tracking-[0.16em] text-white/40 uppercase">Automation</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SYSTEM_AUTOMATION.map((tool) => (
              <ToolLogo key={tool.id} tool={tool} size={13} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SystemMap() {
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(frameRef, 0.15);
  const step = useCycle(SYSTEM_STATUSES.length, 2600, visible, 3);
  const route = ROUTES[step];
  const beams = useBeams(mapRef);

  return (
    <div
      ref={frameRef}
      className="da-panel-violet relative overflow-hidden rounded-[22px] p-1.5"
      role="img"
      aria-label="Illustration: leads from Meta, Google Ads, referrals, and the website flow through one systems layer into the CRM pipeline, follow-up, the sales-to-service handoff, and reporting."
    >
      <div className="flex items-center justify-between px-4 pt-2.5 pb-2">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-[#9a88fc]/70" />
        </div>
        <p className="da-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">Operating system · illustrative</p>
        <span className="da-mono flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-[#52d6a4] uppercase">
          <span className="da-pulse-dot size-1.5 rounded-full bg-[#52d6a4]" /> Live
        </span>
      </div>

      <div className="relative rounded-[16px] border border-white/[0.06] bg-[#0a0a0b]/90 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div aria-hidden className="da-grid pointer-events-none absolute inset-0 opacity-60" />
        <div ref={mapRef} className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-x-20">
          <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block">
            <defs>
              <linearGradient id="da-beam-in" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#b59aff" stopOpacity="0" />
                <stop offset="60%" stopColor="#b59aff" />
                <stop offset="100%" stopColor="#5a23fc" />
              </linearGradient>
            </defs>
            {beams.map((beam) => {
              const lit = beam.kind === 'in' ? beam.index === route.source : beam.index === route.output;
              return (
                <g key={`${beam.kind}-${beam.index}`}>
                  <path d={beam.d} fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="1.25" />
                  <path
                    d={beam.d}
                    pathLength={100}
                    fill="none"
                    stroke="url(#da-beam-in)"
                    strokeWidth={lit ? 2.25 : 1.25}
                    strokeLinecap="round"
                    className="da-beam transition-opacity duration-500"
                    style={{ opacity: lit ? 1 : 0.4, animationDelay: `${beam.index * 0.4 + (beam.kind === 'out' ? 1.2 : 0)}s` }}
                  />
                </g>
              );
            })}
          </svg>

          <div className="relative">
            <p className="da-mono mb-3 text-[10px] tracking-[0.18em] text-white/40 uppercase lg:text-right">Opportunities in</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {SYSTEM_SOURCES.map((source, index) => (
                <NodeCard key={source.label} kind="source" {...source} active={route.source === index} />
              ))}
            </ul>
          </div>

          <Hub status={SYSTEM_STATUSES[step]} step={step} />

          <div className="relative">
            <p className="da-mono mb-3 text-[10px] tracking-[0.18em] text-white/40 uppercase">Work lands where it belongs</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {SYSTEM_OUTPUTS.map((output, index) => (
                <NodeCard key={output.label} kind="output" {...output} active={route.output === index} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
