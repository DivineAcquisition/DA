'use client';

import { useRef, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Blocks,
  Cable,
  Check,
  CircleDashed,
  Eye,
  LineChart,
  Loader2,
  ScanSearch,
  RotateCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { APPROACH, TOOLS, WHO, type Tool } from '@/lib/site/content';
import { cn } from '@/lib/utils';

import { useCycle, useInViewOnce, useSequence } from './motion';
import { ToolLogo } from './primitives';

/* ------------------------------------------------------------------------ */
/* 02 · The handoff trace                                                    */
/* ------------------------------------------------------------------------ */

type TraceRow = { label: string; note: string; state: 'ok' | 'warn' | 'bad'; tool?: Tool };

const TRACE_BEFORE: TraceRow[] = [
  { label: 'Opportunity enters the pipeline', note: 'Logged', state: 'ok', tool: TOOLS.meta },
  { label: 'Sales conversation', note: 'Held', state: 'ok', tool: TOOLS.calendly },
  { label: 'Proposal sent', note: 'Sent', state: 'ok', tool: TOOLS.gmail },
  { label: 'Customer signs', note: 'Signed', state: 'ok', tool: TOOLS.stripe },
];

const TRACE_AFTER: TraceRow[] = [
  { label: 'Handoff to delivery', note: 'Owner unclear', state: 'warn', tool: TOOLS.slack },
  { label: 'Client onboarding', note: 'Steps vary by person', state: 'warn', tool: TOOLS.sheets },
  { label: 'Follow-up', note: 'Missed', state: 'bad', tool: TOOLS.calendar },
  { label: 'Leadership visibility', note: '“Can someone update me?”', state: 'bad' },
];

function StateMark({ state }: { state: TraceRow['state'] }) {
  if (state === 'ok')
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-[#5a23fc] shadow-[0_0_14px_-2px_rgba(90,35,252,0.9)]">
        <Check className="size-3.5 text-white" aria-hidden />
      </span>
    );
  if (state === 'warn')
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-[#f0b45c]/15 ring-1 ring-[#f0b45c]/50">
        <AlertTriangle className="size-3.5 text-[#f0b45c]" aria-hidden />
      </span>
    );
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-[#f87171]/12 ring-1 ring-[#f87171]/50">
      <XCircle className="size-3.5 text-[#f87171]" aria-hidden />
    </span>
  );
}

function TraceLine({ row, shown }: { row: TraceRow; shown: boolean }) {
  return (
    <li
      className={cn(
        'relative flex items-center gap-3 py-2.5 pl-1 transition-all duration-500',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
      )}
    >
      <span className="relative z-[1]">
        <StateMark state={row.state} />
      </span>
      <span className="min-w-0 flex-1 text-sm text-white/85">{row.label}</span>
      {row.tool ? <ToolLogo tool={row.tool} size={13} /> : null}
      <span
        className={cn(
          'da-mono shrink-0 rounded-md px-2 py-1 text-[10px] tracking-[0.08em] uppercase',
          row.state === 'ok' && 'bg-[#211c30] text-white/55',
          row.state === 'warn' && 'bg-[#f0b45c]/10 text-[#f0b45c]',
          row.state === 'bad' && 'bg-[#f87171]/10 text-[#f87171]',
        )}
      >
        {row.note}
      </span>
    </li>
  );
}

export function HandoffTrace() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(ref, 0.35);
  const total = TRACE_BEFORE.length + TRACE_AFTER.length + 1;
  const shown = useSequence(visible, total, 420);

  return (
    <div ref={ref} className="da-panel relative overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="da-mono text-[10px] tracking-[0.18em] text-white/45 uppercase">Handoff trace · one client</p>
        <p className="da-mono text-[10px] tracking-[0.14em] text-white/30 uppercase">Illustrative</p>
      </div>
      <ol className="relative mt-4">
        <span aria-hidden className="absolute top-4 bottom-1/2 left-[15px] w-px bg-gradient-to-b from-[#5a23fc] to-[#9a88fc]" />
        <span
          aria-hidden
          className="absolute top-1/2 bottom-4 left-[15px] w-px"
          style={{ backgroundImage: 'linear-gradient(rgba(240,180,92,0.6) 50%, transparent 50%)', backgroundSize: '1px 7px' }}
        />
        {TRACE_BEFORE.map((row, index) => (
          <TraceLine key={row.label} row={row} shown={shown > index} />
        ))}
        <li
          className={cn(
            'relative my-2 ml-9 rounded-lg border border-dashed border-[#9a88fc]/25 px-3 py-2 text-[12px] leading-snug text-white/55 transition-opacity duration-500',
            shown > TRACE_BEFORE.length ? 'opacity-100' : 'opacity-0',
          )}
        >
          Work moves between people, departments, software, and responsibilities.
        </li>
        {TRACE_AFTER.map((row, index) => (
          <TraceLine key={row.label} row={row} shown={shown > TRACE_BEFORE.length + 1 + index} />
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* 03 · Sales operations: an opportunity moving through an owned pipeline    */
/* ------------------------------------------------------------------------ */

const STAGES = ['New', 'Qualified', 'Proposal', 'Won'] as const;
const NEXT_STEP = ['Call back within 1 hr', 'Discovery booked', 'Follow-up due day 3', 'Handoff to onboarding'] as const;

function MiniCard({ title, owner, faded }: { title: string; owner: string; faded?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-[#9a88fc]/15 bg-[#16131f] p-2', faded && 'opacity-50')}>
      <div className="h-1.5 w-3/4 rounded-full bg-white/15" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-white/45">{title}</span>
        <span className="flex size-4 items-center justify-center rounded-full bg-white/10 text-[8px] text-white/60">{owner}</span>
      </div>
    </div>
  );
}

export function PipelineBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(ref, 0.3);
  const stage = useCycle(STAGES.length, 2200, visible, 2);

  return (
    <div ref={ref} className="relative rounded-xl border border-[#9a88fc]/15 bg-[#12101a] p-3" aria-hidden>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="da-mono text-[10px] tracking-[0.16em] text-white/40 uppercase">Pipeline</span>
        <span className="flex items-center gap-1.5">
          <ToolLogo tool={TOOLS.gohighlevel} size={12} />
          <ToolLogo tool={TOOLS.hubspot} size={12} />
          <ToolLogo tool={TOOLS.salesforce} size={12} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAGES.map((name, column) => (
          <div key={name} className="min-w-0 rounded-lg bg-[#16131f] p-1.5">
            <p className="mb-1.5 flex items-center justify-between px-0.5 text-[10px] text-white/50">
              <span className="truncate">{name}</span>
              <span className="text-white/25">{[3, 2, 2, 1][column]}</span>
            </p>
            <div className="space-y-1.5">
              {stage === column ? (
                <div key={`active-${column}`} className="da-enter rounded-lg border border-[#9a88fc]/60 bg-[#5a23fc]/15 p-2 shadow-[0_0_24px_-8px_rgba(90,35,252,0.9)]">
                  <p className="truncate text-[10px] font-medium text-white">Kitchen remodel</p>
                  <p className="mt-1 truncate text-[9px] text-[#c3b6fe]">{NEXT_STEP[column]}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <ToolLogo tool={column === 0 ? TOOLS.googleAds : column === 3 ? TOOLS.stripe : TOOLS.calendly} size={9} />
                    <span className="flex size-4 items-center justify-center rounded-full bg-[#9a88fc] text-[8px] font-semibold text-black">JR</span>
                  </div>
                </div>
              ) : null}
              <MiniCard title="Owner set" owner={['AK', 'MS', 'JR', 'TL'][column]} />
              {column < 2 ? <MiniCard title="Next step due" owner={['TL', 'AK'][column]} faded /> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 px-1">
        {['Owner assigned', 'Next step dated', 'Source tracked'].map((chip) => (
          <span key={chip} className="flex items-center gap-1 rounded-full bg-[#1c1828] px-2 py-0.5 text-[10px] text-white/55">
            <Check className="size-2.5 text-[#52d6a4]" /> {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

/* 03 · A market's sales journey, stage by stage                             */
/* ------------------------------------------------------------------------ */

/**
 * The stages a market's opportunities move through. One stage lights at a
 * time once the card is on screen; the last stage loops back to the first,
 * because the next sale starts from the last one.
 */
export function JourneyFlow({ stages, label }: { stages: readonly string[]; label: string }) {
  const ref = useRef<HTMLOListElement>(null);
  const visible = useInViewOnce(ref, 0.4);
  const active = useCycle(stages.length, 1500, visible, stages.length - 1);

  return (
    <ol ref={ref} aria-label={label} className="flex flex-wrap items-center gap-y-2">
      {stages.map((stage, index) => (
        <li key={stage} className="flex items-center">
          <span
            className={cn(
              'da-mono rounded-full border px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase transition-all duration-500',
              index === active
                ? 'border-[#9a88fc]/60 bg-[#5a23fc]/25 text-white shadow-[0_0_18px_-4px_rgba(90,35,252,0.9)]'
                : index < active
                  ? 'border-[#9a88fc]/20 bg-[#1c1828] text-white/70'
                  : 'border-[#9a88fc]/15 text-white/45',
            )}
          >
            {stage}
          </span>
          {index < stages.length - 1 ? (
            <ArrowRight aria-hidden className={cn('mx-1 size-3 transition-colors duration-500', index < active ? 'text-[#9a88fc]' : 'text-white/20')} />
          ) : (
            <RotateCw aria-hidden className="ml-1.5 size-3 text-[#9a88fc]/70" />
          )}
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------------ */
/* 04 · The five-step engagement, played as a run                            */
/* ------------------------------------------------------------------------ */

const STEP_ICONS: ReactNode[] = [
  <ScanSearch key="d" className="size-5" aria-hidden />,
  <Blocks key="a" className="size-5" aria-hidden />,
  <Cable key="i" className="size-5" aria-hidden />,
  <ShieldCheck key="v" className="size-5" aria-hidden />,
  <LineChart key="m" className="size-5" aria-hidden />,
];

function StepState({ state }: { state: 'done' | 'running' | 'queued' }) {
  if (state === 'done')
    return (
      <span className="da-mono inline-flex items-center gap-1 rounded-full bg-[#52d6a4]/12 px-2 py-0.5 text-[9px] tracking-[0.12em] text-[#52d6a4] uppercase">
        <Check className="size-2.5" aria-hidden /> Complete
      </span>
    );
  if (state === 'running')
    return (
      <span className="da-mono inline-flex items-center gap-1 rounded-full whitespace-nowrap bg-[#5a23fc]/20 px-2 py-0.5 text-[9px] tracking-[0.12em] text-[#c3b6fe] uppercase">
        <Loader2 className="size-2.5 animate-spin" aria-hidden /> In progress
      </span>
    );
  return (
    <span className="da-mono inline-flex items-center gap-1 rounded-full bg-[#1c1828] px-2 py-0.5 text-[9px] tracking-[0.12em] text-white/40 uppercase">
      <CircleDashed className="size-2.5" aria-hidden /> Queued
    </span>
  );
}

export function ApproachRun() {
  const ref = useRef<HTMLOListElement>(null);
  const visible = useInViewOnce(ref, 0.25);
  const progress = useSequence(visible, APPROACH.steps.length, 1100);

  return (
    <ol ref={ref} className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {APPROACH.steps.map((step, index) => {
        const state = index < progress ? 'done' : index === progress ? 'running' : 'queued';
        return (
          <li key={step.name} className="relative">
            <div
              className={cn(
                'flex h-full flex-col rounded-2xl border p-5 transition-all duration-700',
                state === 'running'
                  ? 'border-[#9a88fc]/50 bg-[#5a23fc]/[0.08] shadow-[0_0_50px_-20px_rgba(90,35,252,0.95)]'
                  : 'border-[#9a88fc]/15 bg-[#16131f]',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl transition-colors duration-500',
                    state === 'queued' ? 'bg-[#1c1828] text-white/40 shadow-[inset_0_0_0_1px_rgba(154,136,252,0.14)]' : 'da-icon-tile',
                  )}
                >
                  {STEP_ICONS[index]}
                </span>
                <span className="da-mono text-xs text-[#9a88fc]">{'//'}{step.index}</span>
              </div>
              <h3 className="da-display mt-5 text-xl font-semibold tracking-tight text-white">{step.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">{step.body}</p>
              <div className="mt-5 flex flex-col items-start gap-2 border-t border-[#9a88fc]/15 pt-4">
                <span className="text-[11px] text-white/45">{step.artifact}</span>
                <StepState state={state} />
              </div>
            </div>
            {index < APPROACH.steps.length - 1 ? (
              <ArrowRight
                aria-hidden
                className={cn(
                  'absolute top-1/2 -right-[11px] z-[1] hidden size-4 -translate-y-1/2 transition-colors duration-500 lg:block',
                  index < progress ? 'text-[#9a88fc]' : 'text-white/15',
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------------ */
/* 09 · Fit check                                                            */
/* ------------------------------------------------------------------------ */

export function FitCheck() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(ref, 0.35);
  const checked = useSequence(visible, WHO.criteria.length + 1, 520);
  const complete = checked > WHO.criteria.length;

  return (
    <div ref={ref} className="da-panel-violet relative overflow-hidden rounded-2xl p-5 sm:p-7">
      <div className="flex items-center justify-between">
        <p className="da-mono flex items-center gap-2 text-[10px] tracking-[0.18em] text-white/45 uppercase">
          <Eye className="size-3.5 text-[#b59aff]" aria-hidden /> Partnership fit
        </p>
        <p className="da-mono text-[10px] text-white/35">
          {Math.min(checked, WHO.criteria.length)}/{WHO.criteria.length}
        </p>
      </div>
      <ul className="mt-5 space-y-2.5">
        {WHO.criteria.map((criterion, index) => {
          const on = index < checked;
          return (
            <li
              key={criterion}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-all duration-500',
                on ? 'border-[#9a88fc]/25 bg-[#5a23fc]/[0.07]' : 'border-[#9a88fc]/15 bg-[#16131f]',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md transition-all duration-500',
                  on ? 'bg-[#5a23fc] shadow-[0_0_14px_-2px_rgba(90,35,252,0.9)]' : 'ring-1 ring-white/20',
                )}
              >
                <Check className={cn('size-3 text-white transition-opacity duration-300', on ? 'opacity-100' : 'opacity-0')} aria-hidden />
              </span>
              <span className={cn('text-[15px] leading-snug transition-colors duration-500', on ? 'text-white' : 'text-white/55')}>{criterion}</span>
            </li>
          );
        })}
      </ul>
      <div
        className={cn(
          'mt-5 flex items-center justify-between rounded-xl border border-[#52d6a4]/30 bg-[#52d6a4]/[0.07] px-4 py-3 transition-all duration-500',
          complete ? 'opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        <span className="text-sm text-white">Next step: a diagnostic</span>
        <span className="da-mono text-[10px] tracking-[0.14em] text-[#52d6a4] uppercase">Recommended</span>
      </div>
    </div>
  );
}
