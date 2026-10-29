'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, formatTime } from '@/lib/portal/time';
import { logActivityAction, saveEodAction, submitEodAction, type EodBody } from '@/lib/sales-workspace/actions';
import { formatMetric } from '@/lib/sales-workspace/dashboard';
import { brand } from '../WorkspaceFrame';

const NO_BLOCKERS = 'No blockers today.';

export type EodFormMetric = {
  key: string;
  label: string;
  unit: string;
  group: string;
  editable: boolean;
  display: 'number' | 'pending_sync' | 'sync_delayed';
  value: number | null;
  target: number | null;
};

export type EodFormData = {
  work_date: string;
  status: string;
  deadline_at: string;
  submitted_at: string | null;
  was_late: boolean;
  edited_after_submit: boolean;
  editable: boolean;
  view_as: boolean;
  updated_at: string | null;
  wins: string | null;
  blockers: string | null;
  needs_help: boolean;
  plan_items: { text?: string; done_at?: string | null }[];
  note_to_manager: string | null;
  hours_start: string | null;
  hours_end: string | null;
  break_minutes: number | null;
  hours_enabled: boolean;
  note_enabled: boolean;
  min_chars: number;
  time_zone: string;
  metrics: EodFormMetric[];
  outcomes: { id: string; name: string; value: number }[];
  yesterday_plan: { text?: string; done_at?: string | null }[];
  yesterday: string | null;
  excused: boolean;
};

function lines(items: { text?: string }[] | null | undefined): string[] {
  const next = [0, 1, 2, 3, 4].map((i) => items?.[i]?.text ?? '');
  return next;
}

function hoursTotal(start: string, end: string, breakMinutes: string): string | null {
  if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) return null;
  const [sh, sm] = start.slice(0, 5).split(':').map(Number);
  const [eh, em] = end.slice(0, 5).split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 1440;
  minutes -= Number(breakMinutes || 0);
  if (minutes < 0) minutes = 0;
  if (minutes > 1440) minutes = 1440;
  return `${Math.round((minutes / 60) * 100) / 100} h`;
}

export default function EodForm({ data }: { data: EodFormData }) {
  const router = useRouter();
  const [wins, setWins] = useState(data.wins ?? '');
  const [blockers, setBlockers] = useState(data.blockers ?? '');
  const [noBlockers, setNoBlockers] = useState((data.blockers ?? '') === NO_BLOCKERS);
  const [needsHelp, setNeedsHelp] = useState(data.needs_help);
  const [plan, setPlan] = useState<string[]>(() => lines(data.plan_items));
  const [note, setNote] = useState(data.note_to_manager ?? '');
  const [hoursStart, setHoursStart] = useState(data.hours_start ?? '');
  const [hoursEnd, setHoursEnd] = useState(data.hours_end ?? '');
  const [breakMinutes, setBreakMinutes] = useState(data.break_minutes == null ? '' : String(data.break_minutes));
  const [metrics, setMetrics] = useState(data.metrics);
  const [outcomes, setOutcomes] = useState(data.outcomes);
  const [savedAt, setSavedAt] = useState(data.updated_at);
  const [status, setStatus] = useState(data.status);
  const [step, setStep] = useState<'edit' | 'review' | 'done'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [wasLate, setWasLate] = useState(data.was_late);
  const dirty = useRef(false);
  const canWrite = data.editable && !data.view_as && !data.excused;
  const alreadySubmitted = Boolean(data.submitted_at);

  const body = useMemo<EodBody>(() => {
    const payload: EodBody = {
      wins,
      blockers: noBlockers ? NO_BLOCKERS : blockers,
      needs_help: needsHelp,
      plan_items: plan.map((text) => ({ text })),
    };
    if (data.note_enabled) payload.note_to_manager = note;
    if (data.hours_enabled) {
      payload.hours_start = hoursStart;
      payload.hours_end = hoursEnd;
      payload.break_minutes = breakMinutes === '' ? null : Number(breakMinutes);
    }
    return payload;
  }, [wins, blockers, noBlockers, needsHelp, plan, note, hoursStart, hoursEnd, breakMinutes, data.note_enabled, data.hours_enabled]);

  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    if (!canWrite || step === 'done') return;
    if (!dirty.current) return;
    const timer = window.setTimeout(async () => {
      const result = await saveEodAction(data.work_date, bodyRef.current);
      if (result.ok) {
        setSavedAt(result.updated_at ?? new Date().toISOString());
        setStatus(result.status);
        dirty.current = false;
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [body, canWrite, data.work_date, step]);

  useEffect(() => {
    if (!canWrite) return;
    function leave() {
      if (!dirty.current) return;
      dirty.current = false;
      void fetch('/api/workspace/eod-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day: data.work_date, body: bodyRef.current }),
        keepalive: true,
      });
    }
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [canWrite, data.work_date]);

  function touch() {
    dirty.current = true;
    setError(null);
  }

  function problems(): string | null {
    if (wins.trim().length < data.min_chars) return `Wins needs at least ${data.min_chars} characters.`;
    const blockerText = noBlockers ? NO_BLOCKERS : blockers.trim();
    if (blockerText !== NO_BLOCKERS && blockerText.length < data.min_chars) {
      return `Blockers needs at least ${data.min_chars} characters, or tick No blockers today.`;
    }
    if (!plan.some((line) => line.trim())) return 'Add at least one priority for the next working day.';
    return null;
  }

  async function submit() {
    const problem = problems();
    if (problem) {
      setError(problem);
      setStep('edit');
      return;
    }
    setPending(true);
    setError(null);
    const result = alreadySubmitted ? await saveEodAction(data.work_date, body) : await submitEodAction(data.work_date, body);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dirty.current = false;
    setWasLate(Boolean(result.was_late) || data.was_late);
    setStatus(result.status);
    setStep('done');
  }

  async function adjust(kind: 'metric' | 'outcome', key: string, outcomeId: string | null, delta: number) {
    if (!canWrite) return;
    setPending(true);
    const result = await logActivityAction(kind === 'metric' ? key : 'positive_outcomes', outcomeId, delta, 'delta', data.work_date);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (kind === 'metric') {
      setMetrics((rows) => rows.map((row) => (row.key === key ? { ...row, value: Math.max(0, (row.value ?? 0) + delta) } : row)));
    } else {
      setOutcomes((rows) => rows.map((row) => (row.id === outcomeId ? { ...row, value: Math.max(0, row.value + delta) } : row)));
    }
  }

  if (data.excused || status === 'excused') {
    return (
      <section className={brand.panel}>
        <p className={brand.eyebrow}>End of day · {formatDate(data.work_date, true)}</p>
        <h1 className={`${brand.heading} mt-2 text-2xl`}>Excused</h1>
        <p className="mt-3 text-sm text-neutral-300">No EOD is due. Reminders and escalation are off for this day.</p>
        <Link href="/workspace/operator/workspace" className={`${brand.primaryButton} mt-6`}>
          Back to the dashboard
        </Link>
      </section>
    );
  }

  if (step === 'done') {
    return (
      <section className={brand.panel}>
        <p className={brand.eyebrow}>End of day · {formatDate(data.work_date, true)}</p>
        <h1 className={`${brand.heading} mt-2 text-2xl`}>
          {alreadySubmitted ? 'Saved.' : wasLate || status === 'missed' ? 'Submitted late.' : 'Submitted.'}
        </h1>
        <p className="mt-3 text-sm text-neutral-300">
          {alreadySubmitted
            ? 'The edit is in the history.'
            : status === 'missed'
              ? 'This report stays marked missed. Your manager has it.'
              : wasLate
                ? 'This report is marked late. Your manager has it.'
                : 'This report is on time. Your manager has it.'}
        </p>
        <button type="button" className={`${brand.primaryButton} mt-6`} onClick={() => router.push('/workspace/operator/workspace')}>
          Back to the dashboard
        </button>
      </section>
    );
  }

  const locked = !canWrite;
  const total = hoursTotal(hoursStart, hoursEnd, breakMinutes);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 'review') void submit();
        else {
          const problem = problems();
          if (problem) setError(problem);
          else setStep('review');
        }
      }}
    >
      <header>
        <p className={brand.eyebrow}>End of day · {formatDate(data.work_date, true)}</p>
        <h1 className={`${brand.heading} mt-2 text-2xl`}>{step === 'review' ? 'Check it once.' : 'Today’s report'}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Due {formatTime(data.deadline_at, data.time_zone)}.
          {savedAt && status !== 'not_started' ? ` Draft saved ${formatTime(savedAt, data.time_zone)}.` : ''}
          {data.edited_after_submit ? ' Edited after submission.' : ''}
        </p>
        {data.view_as ? <p className="mt-2 text-sm text-neutral-300">View-as is read-only. Exit to let the operator do this.</p> : null}
        {locked && !data.view_as ? <p className="mt-2 text-sm text-neutral-300">This EOD is locked. Numbers and text are read-only.</p> : null}
      </header>

      {error ? <p className="rounded-2xl border border-[#FFB020]/40 bg-[#FFB020]/10 px-4 py-3 text-sm text-[#FFB020]">{error}</p> : null}

      {step === 'review' ? (
        <Review data={data} body={body} metrics={metrics} outcomes={outcomes} total={total} />
      ) : (
        <>
          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Today’s numbers</h2>
            <p className="mt-1 text-sm text-neutral-400">Corrections save to today’s log, with the time.</p>
            <div className="mt-4 space-y-5">
              {groupMetrics(metrics).map((group) => (
                <div key={group.group}>
                  <h3 className={brand.eyebrow}>{group.group}</h3>
                  <ul className="mt-2 space-y-2">
                    {group.rows.map((row) => (
                      <li key={row.key} className="rounded-2xl border border-white/[0.06] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{row.label}</p>
                          <p className="text-sm text-neutral-300">
                            {ghlLabel(row.display, row.unit, row.value)}
                            {row.target != null ? <span className="text-neutral-500"> / {formatMetric(row.unit, row.target)}</span> : null}
                          </p>
                        </div>
                        {row.editable ? (
                          <div className="mt-3 flex items-center gap-2">
                            <Step label={`Decrease ${row.label}`} disabled={pending || (row.value ?? 0) <= 0} onClick={() => adjust('metric', row.key, null, -1)} />
                            <Step label={`Increase ${row.label}`} disabled={pending} onClick={() => adjust('metric', row.key, null, 1)} sign="+" />
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-neutral-500">{row.display === 'pending_sync' ? 'From GHL. You cannot edit this.' : 'Read only.'}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {outcomes.length > 0 ? (
                <div>
                  <h3 className={brand.eyebrow}>Positive outcomes</h3>
                  <ul className="mt-2 space-y-2">
                    {outcomes.map((outcome) => (
                      <li key={outcome.id} className="rounded-2xl border border-white/[0.06] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{outcome.name}</p>
                          <p className="text-sm text-neutral-300">{outcome.value}</p>
                        </div>
                        {canWrite ? (
                          <div className="mt-3 flex items-center gap-2">
                            <Step label={`Decrease ${outcome.name}`} disabled={pending || outcome.value <= 0} onClick={() => adjust('outcome', 'positive_outcomes', outcome.id, -1)} />
                            <Step label={`Increase ${outcome.name}`} disabled={pending} onClick={() => adjust('outcome', 'positive_outcomes', outcome.id, 1)} sign="+" />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>

          {data.yesterday_plan.some((item) => item.text?.trim()) ? (
            <section className={brand.panel}>
              <h2 className={`${brand.heading} text-lg`}>Yesterday’s plan</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                {data.yesterday_plan.filter((item) => item.text?.trim()).map((item, index) => (
                  <li key={`${item.text}-${index}`}>
                    {item.done_at ? 'Done' : 'Open'} · {item.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Wins</h2>
            <textarea
              value={wins}
              disabled={locked}
              onChange={(event) => {
                touch();
                setWins(event.target.value);
              }}
              rows={4}
              required
              className={fieldClass}
              placeholder="What went well today."
            />
          </section>

          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Blockers</h2>
            <label className="mt-3 flex items-center gap-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={noBlockers}
                disabled={locked}
                onChange={(event) => {
                  touch();
                  setNoBlockers(event.target.checked);
                  if (event.target.checked) setBlockers(NO_BLOCKERS);
                  else if (blockers === NO_BLOCKERS) setBlockers('');
                }}
              />
              No blockers today
            </label>
            <textarea
              value={noBlockers ? NO_BLOCKERS : blockers}
              disabled={locked || noBlockers}
              onChange={(event) => {
                touch();
                setBlockers(event.target.value);
              }}
              rows={4}
              className={`${fieldClass} mt-3`}
              placeholder="What got in the way, and what you need to remove it."
            />
            <label className="mt-4 flex items-center gap-3 text-sm text-neutral-200">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={needsHelp}
                disabled={locked}
                onChange={(event) => {
                  touch();
                  setNeedsHelp(event.target.checked);
                }}
              />
              Needs manager help
            </label>
          </section>

          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Tomorrow’s plan</h2>
            <p className="mt-1 text-sm text-neutral-400">Up to five priorities. At least one.</p>
            <div className="mt-3 space-y-2">
              {plan.map((line, index) => (
                <input
                  key={index}
                  value={line}
                  disabled={locked}
                  onChange={(event) => {
                    touch();
                    setPlan((current) => current.map((item, i) => (i === index ? event.target.value : item)));
                  }}
                  className={fieldClass}
                  placeholder={`Priority ${index + 1}`}
                />
              ))}
            </div>
          </section>

          {data.hours_enabled ? (
            <section className={brand.panel}>
              <h2 className={`${brand.heading} text-lg`}>Hours worked</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-neutral-300">
                  Start
                  <input type="time" value={hoursStart.slice(0, 5)} disabled={locked} onChange={(event) => { touch(); setHoursStart(event.target.value); }} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-sm text-neutral-300">
                  End
                  <input type="time" value={hoursEnd.slice(0, 5)} disabled={locked} onChange={(event) => { touch(); setHoursEnd(event.target.value); }} className={`${fieldClass} mt-1`} />
                </label>
                <label className="text-sm text-neutral-300">
                  Break minutes
                  <input inputMode="numeric" value={breakMinutes} disabled={locked} onChange={(event) => { touch(); setBreakMinutes(event.target.value.replace(/[^\d]/g, '')); }} className={`${fieldClass} mt-1`} />
                </label>
              </div>
              {total ? <p className="mt-3 text-sm text-white">Total {total}</p> : null}
            </section>
          ) : null}

          {data.note_enabled ? (
            <section className={brand.panel}>
              <h2 className={`${brand.heading} text-lg`}>Note to manager</h2>
              <textarea value={note} disabled={locked} onChange={(event) => { touch(); setNote(event.target.value); }} rows={3} className={`${fieldClass} mt-3`} />
            </section>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {step === 'review' ? (
          <button type="button" className={brand.ghostButton} onClick={() => setStep('edit')}>
            Back
          </button>
        ) : (
          <Link href="/workspace/operator/workspace" className={brand.ghostButton}>
            Dashboard
          </Link>
        )}
        {canWrite ? (
          <button type="submit" disabled={pending} className={brand.primaryButton}>
            {step === 'review' ? (pending ? 'Saving' : alreadySubmitted ? 'Save edit' : 'Submit EOD') : 'Review'}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Review({
  data,
  body,
  metrics,
  outcomes,
  total,
}: {
  data: EodFormData;
  body: EodBody;
  metrics: EodFormMetric[];
  outcomes: EodFormData['outcomes'];
  total: string | null;
}) {
  return (
    <div className="space-y-4">
      <section className={brand.panel}>
        <h2 className={`${brand.heading} text-lg`}>Today’s numbers</h2>
        <ul className="mt-3 space-y-1 text-sm text-neutral-300">
          {metrics.map((row) => (
            <li key={row.key}>
              {row.label}: {ghlLabel(row.display, row.unit, row.value)}
              {row.target != null ? ` / ${formatMetric(row.unit, row.target)}` : ''}
            </li>
          ))}
          {outcomes.map((outcome) => (
            <li key={outcome.id}>
              {outcome.name}: {outcome.value}
            </li>
          ))}
        </ul>
      </section>
      <Narrative title="Wins" body={body.wins} />
      <Narrative title="Blockers" body={body.blockers} extra={body.needs_help ? 'Needs manager help.' : null} />
      <section className={brand.panel}>
        <h2 className={`${brand.heading} text-lg`}>Tomorrow’s plan</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-neutral-300">
          {body.plan_items.filter((item) => item.text.trim()).map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ol>
      </section>
      {data.hours_enabled ? <Narrative title="Hours worked" body={total ?? 'Not set'} /> : null}
      {data.note_enabled && body.note_to_manager ? <Narrative title="Note to manager" body={body.note_to_manager} /> : null}
    </div>
  );
}

function Narrative({ title, body, extra }: { title: string; body: string; extra?: string | null }) {
  return (
    <section className={brand.panel}>
      <h2 className={`${brand.heading} text-lg`}>{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-300">{body.trim() || 'Nothing written.'}</p>
      {extra ? <p className="mt-2 text-sm text-[#FFB020]">{extra}</p> : null}
    </section>
  );
}

function Step({ label, disabled, onClick, sign = '−' }: { label: string; disabled: boolean; onClick: () => void; sign?: string }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${brand.ghostButton} h-12 w-12 px-0 text-lg`}>
      {sign}
    </button>
  );
}

function ghlLabel(display: string, unit: string, value: number | null): string {
  if (display === 'sync_delayed') return 'Sync delayed';
  if (display === 'pending_sync') return 'Pending sync';
  return formatMetric(unit, value);
}

function groupMetrics(rows: EodFormMetric[]): { group: string; rows: EodFormMetric[] }[] {
  const groups: { group: string; rows: EodFormMetric[] }[] = [];
  for (const row of rows) {
    const existing = groups.find((group) => group.group === row.group);
    if (existing) existing.rows.push(row);
    else groups.push({ group: row.group, rows: [row] });
  }
  return groups;
}

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white outline-none focus:border-[#937DFF] disabled:opacity-60';
