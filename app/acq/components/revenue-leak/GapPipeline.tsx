'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CircleCheck } from 'lucide-react';
import { Panel } from '@/components/ui/panel';
import { REVENUE_LEAK, type RevenueLeakStep } from '@/lib/acq/revenue-leak-content';

const steps = REVENUE_LEAK.pipeline.steps;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function Detail({ step }: { step: RevenueLeakStep }) {
  return (
    <Panel className="p-4 sm:p-5">
      <p className="flex items-start gap-2 text-sm leading-relaxed text-flag-critical">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">The gap. </span>
          {step.gap}
        </span>
      </p>
      <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-brand-200">
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">The fix. </span>
          {step.fix}
        </span>
      </p>
    </Panel>
  );
}

export function GapPipeline({
  onOpen,
  onSealAll,
}: {
  onOpen?: (id: string) => void;
  onSealAll?: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [sealed, setSealed] = useState<boolean[]>(() => steps.map(() => false));
  const [sealing, setSealing] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of timers.current) window.clearTimeout(id);
    };
  }, []);

  function clearTimers() {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
    setSealing(false);
  }

  function sealOne(index: number) {
    setSealed((current) => {
      if (current[index]) return current;
      const next = current.slice();
      next[index] = true;
      return next;
    });
    setOpen(index);
  }

  function select(index: number, report: boolean) {
    clearTimers();
    sealOne(index);
    setFocusIndex(index);
    if (report) onOpen?.(steps[index].id);
  }

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = steps.length - 1;
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(last, index + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else return;
    event.preventDefault();
    setFocusIndex(next);
    document.getElementById(`gap-step-${steps[next].id}`)?.focus();
  }

  function sealAll() {
    clearTimers();
    onSealAll?.();
    if (prefersReducedMotion()) {
      setSealed(steps.map(() => true));
      setOpen(steps.length - 1);
      return;
    }
    setSealing(true);
    steps.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setSealed((current) => {
          const next = current.slice();
          next[index] = true;
          return next;
        });
        setOpen(index);
        if (index === steps.length - 1) setSealing(false);
      }, index * 220);
      timers.current.push(timer);
    });
  }

  const active = open == null ? null : steps[open];

  return (
    <div>
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-8 top-[30px] z-0 hidden h-px md:block">
          <div className="flex h-px">
            {steps.slice(0, -1).map((step, index) => (
              <span
                key={step.id}
                className={`h-px flex-1 motion-safe:transition-colors ${sealed[index] ? 'bg-brand-400' : 'bg-flag-critical/80'}`}
              />
            ))}
          </div>
        </div>
        <ol className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-2" aria-label="Seven handoffs from the first contact to a paid invoice">
          {steps.map((step, index) => {
            const isSealed = sealed[index];
            const isOpen = open === index;
            return (
              <li key={step.id} className="relative min-w-0 flex-1">
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className={`absolute bottom-[-0.5rem] left-[1.85rem] top-12 w-px md:hidden ${isSealed ? 'bg-brand-400' : 'bg-flag-critical/80'}`}
                  />
                ) : null}
                <button
                  id={`gap-step-${step.id}`}
                  type="button"
                  className={`relative z-10 flex min-h-12 w-full items-center gap-3 rounded-2xl border bg-ink-850 px-3 py-3 text-left motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 md:flex-col md:justify-start md:px-2 md:text-center ${
                    isSealed ? 'border-brand-500/50' : 'border-flag-critical/45'
                  }`}
                  aria-expanded={isOpen}
                  aria-controls="gap-detail"
                  tabIndex={focusIndex === index ? 0 : -1}
                  onClick={() => select(index, true)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === 'mouse') select(index, false);
                  }}
                  onFocus={() => setFocusIndex(index)}
                  onKeyDown={(event) => move(event, index)}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full border bg-ink-900 ${
                      isSealed ? 'border-brand-400 text-brand-200' : 'border-flag-critical text-flag-critical'
                    }`}
                  >
                    {isSealed ? (
                      <CircleCheck className="size-4" aria-hidden />
                    ) : (
                      <AlertTriangle className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      {index + 1}
                    </span>
                    <span className="acq-headline block text-sm font-semibold text-white">{step.name}</span>
                    <span className={`block text-[11px] font-semibold ${isSealed ? 'text-brand-200' : 'text-flag-critical'}`}>
                      {isSealed ? 'Sealed' : 'Leaking'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div id="gap-detail" className="mt-4" aria-live={sealing ? 'off' : 'polite'}>
        {active ? <Detail step={active} /> : <p className="text-sm text-neutral-400">{REVENUE_LEAK.pipeline.hint}</p>}
      </div>

      <button
        type="button"
        className="acq-button focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
        onClick={sealAll}
        disabled={sealing}
        aria-busy={sealing}
      >
        {REVENUE_LEAK.pipeline.sealAll}
      </button>
    </div>
  );
}
