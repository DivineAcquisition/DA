'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  Loader2,
  MessageSquareText,
  Trophy,
} from 'lucide-react';
import { formatDate, formatTime } from '@/lib/portal/time';
import { logActivityAction, logEodLinkAction, saveEodAction, saveEodLinkAction, submitEodAction, submitEodLinkAction, type EodBody } from '@/lib/sales-workspace/actions';
import { formatMetric } from '@/lib/sales-workspace/dashboard';
import './eod.css';

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

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string } | { kind: 'error'; message: string };

function lines(items: { text?: string }[] | null | undefined): string[] {
  return [0, 1, 2, 3, 4].map((i) => items?.[i]?.text ?? '');
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

function statusPill(status: string, wasLate: boolean): { label: string; tone: 'good' | 'warn' | 'bad' | 'quiet' | undefined } {
  if (status === 'submitted') return wasLate ? { label: 'Submitted late', tone: 'warn' } : { label: 'Submitted', tone: 'good' };
  if (status === 'missed') return { label: 'Missed', tone: 'bad' };
  if (status === 'draft') return { label: 'Draft', tone: undefined };
  if (status === 'excused') return { label: 'Excused', tone: 'quiet' };
  return { label: 'Not started', tone: 'quiet' };
}

export default function EodForm({ data, token }: { data: EodFormData; token?: string }) {
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
  const [save, setSave] = useState<SaveState>(data.updated_at && data.status !== 'not_started' ? { kind: 'saved', at: data.updated_at } : { kind: 'idle' });
  const [status, setStatus] = useState(data.status);
  const [step, setStep] = useState<'edit' | 'review' | 'done'>('edit');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
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

  // Autosave the draft 700 ms after the last keystroke, and say whether it worked.
  useEffect(() => {
    if (!canWrite || step === 'done') return;
    if (!dirty.current) return;
    const timer = window.setTimeout(async () => {
      setSave({ kind: 'saving' });
      const result = token ? await saveEodLinkAction(token, bodyRef.current) : await saveEodAction(data.work_date, bodyRef.current);
      if (result.ok) {
        setSave({ kind: 'saved', at: result.updated_at ?? new Date().toISOString() });
        setStatus(result.status);
        dirty.current = false;
      } else {
        setSave({ kind: 'error', message: result.error });
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [body, canWrite, data.work_date, step, token]);

  // Leaving the page sends whatever is unsaved.
  useEffect(() => {
    if (!canWrite) return;
    function leave() {
      if (!dirty.current) return;
      dirty.current = false;
      void fetch(token ? '/api/eod/draft' : '/api/workspace/eod-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(token ? { token, body: bodyRef.current } : { day: data.work_date, body: bodyRef.current }),
        keepalive: true,
      });
    }
    window.addEventListener('pagehide', leave);
    return () => window.removeEventListener('pagehide', leave);
  }, [canWrite, data.work_date, token]);

  function touch() {
    dirty.current = true;
    setError(null);
  }

  const winsOk = wins.trim().length >= data.min_chars;
  const blockerText = noBlockers ? NO_BLOCKERS : blockers.trim();
  const blockersOk = blockerText === NO_BLOCKERS || blockerText.length >= data.min_chars;
  const planOk = plan.some((line) => line.trim());
  const checklist = [
    { label: 'Wins', ok: winsOk, hint: `${Math.min(wins.trim().length, data.min_chars)}/${data.min_chars} characters` },
    { label: 'Blockers', ok: blockersOk, hint: noBlockers ? 'None today' : `${Math.min(blockers.trim().length, data.min_chars)}/${data.min_chars} characters` },
    { label: 'Tomorrow’s plan', ok: planOk, hint: `${plan.filter((line) => line.trim()).length} of 5` },
  ];
  const doneCount = checklist.filter((item) => item.ok).length;

  function problems(): string | null {
    if (!winsOk) return `Wins needs at least ${data.min_chars} characters.`;
    if (!blockersOk) return `Blockers needs at least ${data.min_chars} characters, or tick No blockers today.`;
    if (!planOk) return 'Add at least one priority for the next working day.';
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
    const result = token
      ? alreadySubmitted
        ? await saveEodLinkAction(token, body)
        : await submitEodLinkAction(token, body)
      : alreadySubmitted
        ? await saveEodAction(data.work_date, body)
        : await submitEodAction(data.work_date, body);
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

  /** Change a number by a step, or set it to a typed value. */
  async function record(kind: 'metric' | 'outcome', key: string, outcomeId: string | null, amount: number, mode: 'delta' | 'set') {
    if (!canWrite) return;
    const metricKey = kind === 'metric' ? key : 'positive_outcomes';
    const id = outcomeId ?? key;
    setBusyKey(id);
    const result = token
      ? await logEodLinkAction(token, metricKey, outcomeId, amount, mode)
      : await logActivityAction(metricKey, outcomeId, amount, mode, data.work_date);
    setBusyKey(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = (current: number | null) => (mode === 'set' ? Math.max(0, amount) : Math.max(0, (current ?? 0) + amount));
    if (kind === 'metric') setMetrics((rows) => rows.map((row) => (row.key === key ? { ...row, value: next(row.value) } : row)));
    else setOutcomes((rows) => rows.map((row) => (row.id === outcomeId ? { ...row, value: next(row.value) } : row)));
    setSave({ kind: 'saved', at: new Date().toISOString() });
  }

  const pill = statusPill(status, wasLate);
  const dayLabel = formatDate(data.work_date, true);

  if (data.excused || status === 'excused') {
    return (
      <div className="da-eod">
        <Card glow>
          <p className="eod-label">End of day · {dayLabel}</p>
          <h1 className="eod-title mt-2 text-2xl">Excused</h1>
          <p className="mt-3 text-[15px] text-[var(--eod-muted)]">No EOD is due. Reminders and escalation are off for this day.</p>
          <Exit token={token} />
        </Card>
      </div>
    );
  }

  if (step === 'done') {
    const title = alreadySubmitted ? 'Saved.' : wasLate || status === 'missed' ? 'Submitted late.' : 'Submitted.';
    const line = alreadySubmitted
      ? 'The edit is in the history.'
      : status === 'missed'
        ? 'This report stays marked missed, and your manager has it.'
        : wasLate
          ? 'This report is marked late, and your manager has it.'
          : 'This report is on time, and your manager has it.';
    return (
      <div className="da-eod">
        <Card glow>
          <CheckCircle2 className="size-9 text-[var(--eod-good)]" aria-hidden />
          <p className="eod-label mt-4">End of day · {dayLabel}</p>
          <h1 className="eod-title mt-2 text-[26px]">{title}</h1>
          <p className="mt-3 text-[15px] text-[var(--eod-muted)]">{line}</p>
          <Exit token={token} onDashboard={() => router.push('/workspace/operator/workspace')} />
        </Card>
      </div>
    );
  }

  const locked = !canWrite;
  const total = hoursTotal(hoursStart, hoursEnd, breakMinutes);

  return (
    <form
      className="da-eod space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 'review') void submit();
        else {
          const problem = problems();
          if (problem) setError(problem);
          else {
            setStep('review');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }}
    >
      <Card glow>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eod-label">End of day · {dayLabel}</p>
            <h1 className="eod-title mt-2 text-[26px] leading-tight">{step === 'review' ? 'Check it once.' : 'Today’s report'}</h1>
          </div>
          <span className="eod-pill" data-tone={pill.tone}>
            {pill.label}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--eod-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5 text-[var(--eod-lavender-soft)]" aria-hidden />
            Due {formatTime(data.deadline_at, data.time_zone)}
          </span>
          <SaveIndicator state={save} zone={data.time_zone} />
          {data.edited_after_submit ? <span>Edited after submission</span> : null}
        </div>
        {canWrite && step === 'edit' ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[12px] text-[var(--eod-dim)]">
              <span>Ready to submit</span>
              <span>
                {doneCount} of {checklist.length}
              </span>
            </div>
            <div className="eod-progress">
              <span style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-[13px]">
                  {item.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-[var(--eod-good)]" aria-hidden />
                  ) : (
                    <Circle className="size-4 shrink-0 text-[var(--eod-dim)]" aria-hidden />
                  )}
                  <span className={item.ok ? 'text-white' : 'text-[var(--eod-muted)]'}>{item.label}</span>
                  <span className="ml-auto text-[12px] text-[var(--eod-dim)] sm:ml-1">{item.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.view_as ? <p className="mt-3 text-[13px] text-[var(--eod-muted)]">View-as is read-only. Exit to let the operator do this.</p> : null}
        {locked && !data.view_as ? <p className="mt-3 text-[13px] text-[var(--eod-muted)]">This EOD is locked. Numbers and text are read-only.</p> : null}
      </Card>

      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#f0b45c]/40 bg-[#f0b45c]/10 px-4 py-3 text-sm text-[#f6cf95]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {step === 'review' ? (
        <Review data={data} body={body} metrics={metrics} outcomes={outcomes} total={total} />
      ) : (
        <div className="flex flex-col gap-4">
          {data.yesterday_plan.some((item) => item.text?.trim()) ? (
            <Card title="Yesterday’s plan" icon={ListChecks}>
              <ul className="space-y-2">
                {data.yesterday_plan
                  .filter((item) => item.text?.trim())
                  .map((item, index) => (
                    <li key={`${item.text}-${index}`} className="flex items-start gap-2.5 text-[15px] text-[var(--eod-muted)]">
                      {item.done_at ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--eod-good)]" aria-hidden />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-[var(--eod-dim)]" aria-hidden />
                      )}
                      <span className={item.done_at ? 'text-white' : undefined}>{item.text}</span>
                    </li>
                  ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Wins" icon={Trophy} hint="What went well today. Be specific: who, what, and the result.">
            <textarea
              value={wins}
              disabled={locked}
              onChange={(event) => {
                touch();
                setWins(event.target.value);
              }}
              rows={4}
              className="eod-field"
              placeholder="Booked a walkthrough with the Hendersons for Thursday after a callback."
            />
            <Counter value={wins.trim().length} min={data.min_chars} />
          </Card>

          <Card title="Blockers" icon={AlertTriangle} hint="What got in the way, and what you need to remove it.">
            <label className="flex cursor-pointer items-center gap-3 text-[15px] text-white">
              <input
                type="checkbox"
                className="eod-check"
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
            {noBlockers ? null : (
              <>
                <textarea
                  value={blockers}
                  disabled={locked}
                  onChange={(event) => {
                    touch();
                    setBlockers(event.target.value);
                  }}
                  rows={4}
                  className="eod-field mt-3"
                  placeholder="Three leads had no phone number in GHL, so I could only email them."
                />
                <Counter value={blockers.trim().length} min={data.min_chars} />
              </>
            )}
            <label className="mt-4 flex cursor-pointer items-center gap-3 text-[15px] text-white">
              <input
                type="checkbox"
                className="eod-check"
                checked={needsHelp}
                disabled={locked}
                onChange={(event) => {
                  touch();
                  setNeedsHelp(event.target.checked);
                }}
              />
              I need help from my manager
            </label>
          </Card>

          <Card title="Tomorrow’s plan" icon={ListChecks} hint="Up to five priorities for the next working day. At least one.">
            <ol className="space-y-2">
              {plan.map((line, index) => (
                <li key={index} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-[13px] tabular-nums text-[var(--eod-dim)]">{index + 1}</span>
                  <input
                    value={line}
                    disabled={locked}
                    onChange={(event) => {
                      touch();
                      setPlan((current) => current.map((item, i) => (i === index ? event.target.value : item)));
                    }}
                    className="eod-field"
                    placeholder={index === 0 ? 'Call back the four leads from today’s ads' : `Priority ${index + 1}`}
                  />
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Today’s numbers" icon={BarChart3} hint="Type a number or use the buttons. Each change saves on its own.">
            <div className="space-y-6">
              {groupMetrics(metrics).map((group) => (
                <div key={group.group}>
                  <p className="eod-label">{group.group}</p>
                  <ul className="mt-2 divide-y divide-[rgba(154,136,252,0.1)] rounded-xl border border-[var(--eod-line)] bg-[var(--eod-field)]">
                    {group.rows.map((row) => (
                      <MetricRow
                        key={row.key}
                        label={row.label}
                        value={row.value}
                        target={row.target}
                        unit={row.unit}
                        display={row.display}
                        editable={row.editable && canWrite}
                        busy={busyKey === row.key}
                        onStep={(delta) => record('metric', row.key, null, delta, 'delta')}
                        onSet={(value) => record('metric', row.key, null, value, 'set')}
                      />
                    ))}
                  </ul>
                </div>
              ))}
              {outcomes.length > 0 ? (
                <div>
                  <p className="eod-label">Positive outcomes</p>
                  <ul className="mt-2 divide-y divide-[rgba(154,136,252,0.1)] rounded-xl border border-[var(--eod-line)] bg-[var(--eod-field)]">
                    {outcomes.map((outcome) => (
                      <MetricRow
                        key={outcome.id}
                        label={outcome.name}
                        value={outcome.value}
                        target={null}
                        unit="count"
                        display="number"
                        editable={canWrite}
                        busy={busyKey === outcome.id}
                        onStep={(delta) => record('outcome', 'positive_outcomes', outcome.id, delta, 'delta')}
                        onSet={(value) => record('outcome', 'positive_outcomes', outcome.id, value, 'set')}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          {data.hours_enabled ? (
            <Card title="Hours worked" icon={Clock3}>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-[13px] text-[var(--eod-muted)]">
                  Start
                  <input type="time" value={hoursStart.slice(0, 5)} disabled={locked} onChange={(event) => { touch(); setHoursStart(event.target.value); }} className="eod-field mt-1.5" />
                </label>
                <label className="text-[13px] text-[var(--eod-muted)]">
                  End
                  <input type="time" value={hoursEnd.slice(0, 5)} disabled={locked} onChange={(event) => { touch(); setHoursEnd(event.target.value); }} className="eod-field mt-1.5" />
                </label>
                <label className="text-[13px] text-[var(--eod-muted)]">
                  Break minutes
                  <input inputMode="numeric" value={breakMinutes} disabled={locked} onChange={(event) => { touch(); setBreakMinutes(event.target.value.replace(/[^\d]/g, '')); }} className="eod-field mt-1.5" />
                </label>
              </div>
              {total ? <p className="mt-3 text-[15px] text-white">Total {total}</p> : null}
            </Card>
          ) : null}

          {data.note_enabled ? (
            <Card title="Note to manager" icon={MessageSquareText}>
              <textarea value={note} disabled={locked} onChange={(event) => { touch(); setNote(event.target.value); }} rows={3} className="eod-field" />
            </Card>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div>
          {step === 'review' ? (
            <button type="button" className="eod-secondary" onClick={() => setStep('edit')}>
              Back to edit
            </button>
          ) : token ? null : (
            <Link href="/workspace/operator/workspace" className="eod-secondary">
              Dashboard
            </Link>
          )}
        </div>
        {canWrite ? (
          <button type="submit" disabled={pending} className="eod-primary">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {step === 'review' ? (pending ? 'Submitting' : alreadySubmitted ? 'Save edit' : 'Submit EOD') : 'Review'}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Card({
  title,
  hint,
  icon: Icon,
  glow,
  children,
}: {
  title?: string;
  hint?: string;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  glow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`eod-card ${glow ? 'eod-card-glow' : ''} p-5 sm:p-6`}>
      {title ? (
        <div className="mb-4">
          <h2 className="eod-title flex items-center gap-2 text-[16px]">
            {Icon ? <Icon className="size-4 text-[var(--eod-lavender-soft)]" aria-hidden /> : null}
            {title}
          </h2>
          {hint ? <p className="mt-1 text-[13px] text-[var(--eod-dim)]">{hint}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Counter({ value, min }: { value: number; min: number }) {
  const ok = value >= min;
  return (
    <p className={`mt-1.5 text-right text-[12px] tabular-nums ${ok ? 'text-[var(--eod-good)]' : 'text-[var(--eod-dim)]'}`}>
      {ok ? `${value} characters` : `${value}/${min} characters`}
    </p>
  );
}

function SaveIndicator({ state, zone }: { state: SaveState; zone: string }) {
  if (state.kind === 'saving')
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="size-3.5 animate-spin text-[var(--eod-lavender-soft)]" aria-hidden />
        Saving…
      </span>
    );
  if (state.kind === 'saved')
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 text-[var(--eod-good)]" aria-hidden />
        Saved {formatTime(state.at, zone)}
      </span>
    );
  if (state.kind === 'error')
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-[var(--eod-warn)]">
        <AlertTriangle className="size-3.5" aria-hidden />
        Not saved: {state.message} Keep this page open and try again.
      </span>
    );
  return <span>Your draft saves as you type.</span>;
}

function MetricRow({
  label,
  value,
  target,
  unit,
  display,
  editable,
  busy,
  onStep,
  onSet,
}: {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  display: EodFormMetric['display'];
  editable: boolean;
  busy: boolean;
  onStep: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  function commit() {
    if (draft == null) return;
    const next = Number(draft);
    setDraft(null);
    if (draft.trim() === '' || !Number.isFinite(next) || next < 0 || next === value) return;
    onSet(Math.round(next));
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[15px] text-white">{label}</p>
        <p className="text-[12px] text-[var(--eod-dim)]">
          {editable
            ? target != null
              ? `Target ${formatMetric(unit, target)}`
              : 'You enter this'
            : display === 'pending_sync' || display === 'sync_delayed'
              ? 'Comes from GHL'
              : 'Read only'}
        </p>
      </div>
      {editable ? (
        <div className="flex items-center gap-2">
          <button type="button" aria-label={`Decrease ${label}`} disabled={busy || (value ?? 0) <= 0} onClick={() => onStep(-1)} className="eod-step">
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label={label}
            value={shown}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
            className="eod-field eod-num"
          />
          <button type="button" aria-label={`Increase ${label}`} disabled={busy} onClick={() => onStep(1)} className="eod-step">
            +
          </button>
        </div>
      ) : (
        <p className="text-[15px] tabular-nums text-white">
          {ghlLabel(display, unit, value)}
          {target != null ? <span className="text-[var(--eod-dim)]"> / {formatMetric(unit, target)}</span> : null}
        </p>
      )}
    </li>
  );
}

function Exit({ token, onDashboard }: { token?: string; onDashboard?: () => void }) {
  if (token) return <p className="mt-6 text-[13px] text-[var(--eod-dim)]">You can close this page.</p>;
  if (onDashboard)
    return (
      <button type="button" className="eod-primary mt-6" onClick={onDashboard}>
        Back to the dashboard
      </button>
    );
  return (
    <Link href="/workspace/operator/workspace" className="eod-primary mt-6">
      Back to the dashboard
    </Link>
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
  const filled = metrics.filter((row) => row.value != null && row.value > 0);
  return (
    <div className="space-y-4">
      <Narrative title="Wins" icon={Trophy} body={body.wins} />
      <Narrative title="Blockers" icon={AlertTriangle} body={body.blockers} extra={body.needs_help ? 'You asked for manager help.' : null} />
      <Card title="Tomorrow’s plan" icon={ListChecks}>
        <ol className="list-decimal space-y-1.5 pl-5 text-[15px] text-[var(--eod-muted)]">
          {body.plan_items
            .filter((item) => item.text.trim())
            .map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
        </ol>
      </Card>
      <Card title="Today’s numbers" icon={BarChart3}>
        {filled.length === 0 && outcomes.every((outcome) => outcome.value === 0) ? (
          <p className="text-[15px] text-[var(--eod-muted)]">No numbers entered today.</p>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-2">
            {metrics.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-[var(--eod-line)] bg-[var(--eod-field)] px-3 py-2">
                <dt className="text-[13px] text-[var(--eod-muted)]">{row.label}</dt>
                <dd className="text-[15px] tabular-nums text-white">{ghlLabel(row.display, row.unit, row.value)}</dd>
              </div>
            ))}
            {outcomes.map((outcome) => (
              <div key={outcome.id} className="flex items-center justify-between rounded-lg border border-[var(--eod-line)] bg-[var(--eod-field)] px-3 py-2">
                <dt className="text-[13px] text-[var(--eod-muted)]">{outcome.name}</dt>
                <dd className="text-[15px] tabular-nums text-white">{outcome.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      {data.hours_enabled ? <Narrative title="Hours worked" icon={Clock3} body={total ?? 'Not set'} /> : null}
      {data.note_enabled && body.note_to_manager ? <Narrative title="Note to manager" icon={MessageSquareText} body={body.note_to_manager} /> : null}
    </div>
  );
}

function Narrative({
  title,
  icon,
  body,
  extra,
}: {
  title: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  body: string;
  extra?: string | null;
}) {
  return (
    <Card title={title} icon={icon}>
      <p className="whitespace-pre-wrap text-[15px] text-[var(--eod-muted)]">{body.trim() || 'Nothing written.'}</p>
      {extra ? <p className="mt-2 text-[14px] text-[var(--eod-warn)]">{extra}</p> : null}
    </Card>
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
