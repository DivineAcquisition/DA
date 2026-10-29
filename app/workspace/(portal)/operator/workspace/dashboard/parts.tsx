'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import { completeTaskAction, logActivityAction, markAlertReadAction, tickPlanAction } from '@/lib/sales-workspace/actions';
import {
  formatMetric,
  PACE_LABEL,
  showsTargetBar,
  type AlertItem,
  type BoardData,
  type MetricRow,
  type OutcomeBrief,
  type OutcomeCount,
  type Pace,
  type TaskItem,
  type TrendPoint,
} from '@/lib/sales-workspace/dashboard';
import type { ActionResult } from '@/lib/ad/rpc';
import { brand } from '../WorkspaceFrame';

function useSaved() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(work: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const result = await work();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }
  return { pending, error, run };
}

export function WinsList({ outcomes }: { outcomes: OutcomeBrief[] }) {
  const [open, setOpen] = useState(false);
  if (outcomes.length === 0) return <p className="text-sm text-neutral-400">No positive outcomes are set on this placement yet.</p>;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-sm font-semibold text-[#937DFF] underline-offset-4 hover:underline"
      >
        {open ? 'Hide what counts as a win' : 'What counts as a win'}
      </button>
      {open ? (
        <ul className="mt-3 space-y-2">
          {outcomes.map((outcome) => (
            <li key={outcome.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <p className="text-sm font-semibold text-white">{outcome.name}</p>
              <p className="mt-1 text-sm text-neutral-300">{outcome.definition}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Sparkline({ points }: { points: TrendPoint[] }) {
  const values = points.map((point) => point.value).filter((value): value is number => value != null);
  if (values.length === 0) return null;
  const width = 96;
  const height = 28;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const coords = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="text-[#937DFF]">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={coords} />
    </svg>
  );
}

function paceClass(pace: Pace | null): string {
  if (pace === 'met') return 'text-[#3DDC97]';
  if (pace === 'behind') return 'text-[#FFB020]';
  return 'text-[#937DFF]';
}

function barClass(pace: Pace | null): string {
  if (pace === 'met') return 'bg-[#3DDC97]';
  if (pace === 'behind') return 'bg-[#FFB020]';
  return 'bg-[#937DFF]';
}

function Stepper({
  label,
  value,
  disabled,
  pending,
  onDelta,
}: {
  label: string;
  value: number;
  disabled: boolean;
  pending: boolean;
  onDelta: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Remove one ${label}`}
        disabled={disabled || pending || value <= 0}
        onClick={() => onDelta(-1)}
        className={`${brand.ghostButton} h-11 w-11 px-0`}
      >
        −
      </button>
      <span className="min-w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`Add one ${label}`}
        disabled={disabled || pending}
        onClick={() => onDelta(1)}
        className={`${brand.ghostButton} h-11 w-11 px-0`}
      >
        +
      </button>
    </div>
  );
}

function MinutesField({
  label,
  value,
  disabled,
  pending,
  onSave,
}: {
  label: string;
  value: number;
  disabled: boolean;
  pending: boolean;
  onSave: (amount: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const amount = Number(draft);
        if (Number.isFinite(amount) && amount >= 0) onSave(amount);
      }}
    >
      <label className="sr-only" htmlFor={`minutes-${label.replace(/\s+/g, '-')}`}>
        {label} in minutes
      </label>
      <input
        id={`minutes-${label.replace(/\s+/g, '-')}`}
        inputMode="decimal"
        value={draft}
        disabled={disabled || pending}
        onChange={(event) => setDraft(event.target.value)}
        className="h-11 w-20 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white"
      />
      <button type="submit" disabled={disabled || pending} className={brand.ghostButton}>
        Save
      </button>
    </form>
  );
}

function MetricLine({
  metric,
  mode,
  outcomes,
  open,
  pending,
  onDelta,
  onSet,
}: {
  metric: MetricRow;
  mode: 'today' | 'week';
  outcomes: OutcomeCount[];
  open: boolean;
  pending: boolean;
  onDelta: (key: string, outcomeId: string | null, delta: number) => void;
  onSet: (key: string, amount: number) => void;
}) {
  const display = mode === 'today' ? metric.today_display : metric.week_display;
  const value = mode === 'today' ? metric.today : metric.week;
  const target = mode === 'today' ? metric.target_today : metric.target_week;
  const pace = mode === 'today' ? metric.pace_today : metric.pace_week;
  const layer = mode === 'today' ? metric.target_layer_today : metric.target_layer_week;
  const pendingSync = display === 'pending_sync' || display === 'sync_delayed';
  const pendingLabel = display === 'sync_delayed' ? 'Sync delayed' : 'Pending sync';
  const showBar = showsTargetBar(metric, mode);

  return (
    <div className="border-t border-white/[0.06] py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{metric.label}</p>
          {pendingSync ? <p className="mt-1 text-sm text-neutral-400">{pendingLabel}</p> : <p className="mt-1 text-lg font-semibold tabular-nums">{formatMetric(metric.unit, value)}</p>}
          {showBar && target != null ? (
            <p className="mt-1 text-xs text-neutral-400">
              Target {formatMetric(metric.unit, target)}
              {layer === 'override' ? <span className="ml-2 text-[#937DFF]">Override</span> : null}
              {pace ? <span className={`ml-2 font-semibold ${paceClass(pace)}`}>{PACE_LABEL[pace]}</span> : null}
            </p>
          ) : null}
        </div>
        {metric.trend.length > 0 ? (
          <div className="text-right">
            <Sparkline points={metric.trend} />
            <p className="mt-1 text-[10px] text-neutral-500">Last {metric.trend.length} working days</p>
          </div>
        ) : null}
      </div>
      {showBar && target != null && value != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className={`h-full ${barClass(pace)}`} style={{ width: `${Math.max(0, Math.min(100, (value / target) * 100))}%` }} />
        </div>
      ) : null}
      {metric.by_outcome ? (
        <ul className="mt-3 space-y-2">
          {outcomes.map((outcome) => {
            const count = mode === 'today' ? outcome.today : outcome.week;
            return (
              <li key={outcome.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-3 py-2">
                <span className="text-sm text-neutral-200">{outcome.name}</span>
                {mode === 'today' ? (
                  <Stepper
                    label={outcome.name}
                    value={outcome.today}
                    disabled={!open}
                    pending={pending}
                    onDelta={(delta) => onDelta('positive_outcomes', outcome.id, delta)}
                  />
                ) : (
                  <span className="text-sm font-semibold tabular-nums">{count}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {mode === 'today' && metric.operator_editable && !metric.by_outcome && metric.unit === 'minutes' ? (
        <div className="mt-2">
          <MinutesField key={`${metric.key}-${metric.today ?? 0}`} label={metric.label} value={metric.today ?? 0} disabled={!open} pending={pending} onSave={(amount) => onSet(metric.key, amount)} />
        </div>
      ) : null}
      {mode === 'today' && metric.operator_editable && !metric.by_outcome && metric.unit !== 'minutes' ? (
        <div className="mt-2">
          <Stepper label={metric.label} value={metric.today ?? 0} disabled={!open} pending={pending} onDelta={(delta) => onDelta(metric.key, null, delta)} />
        </div>
      ) : null}
    </div>
  );
}

export function NumbersBoard({ data }: { data: BoardData }) {
  const [mode, setMode] = useState<'today' | 'week'>('today');
  const save = useSaved();
  const weekLabel =
    data.week_start && data.week_through ? `${formatDate(data.week_start)} – ${formatDate(data.week_through)}` : 'This week';

  return (
    <section className={brand.panel} aria-labelledby="numbers-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="numbers-heading" className={`${brand.heading} text-lg`}>
          Numbers
        </h2>
        <div className="flex rounded-xl border border-white/10 p-0.5" role="group" aria-label="Numbers period">
          {(['today', 'week'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`rounded-lg px-3 py-1.5 text-sm ${mode === item ? 'bg-[#6A00FF] text-white' : 'text-neutral-300'}`}
            >
              {item === 'today' ? 'Today' : 'This week'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'week' ? <p className="mt-2 text-xs text-neutral-500">{weekLabel}. Working days only.</p> : null}
      {!data.any_logged ? <p className="mt-3 text-sm text-neutral-400">No numbers logged today.</p> : null}
      {data.quick_log_message ? <p className="mt-3 text-sm text-neutral-300">{data.quick_log_message}</p> : null}
      {save.error ? <p className="mt-3 text-sm text-[#FFB020]">{save.error}</p> : null}
      <div className="mt-4 space-y-6">
        {data.groups.map((group) => {
          const otherIndex = group.metrics.findIndex((metric) => metric.section === 'other');
          return (
            <div key={group.key}>
              <h3 className={brand.eyebrow}>{group.label}</h3>
              <div className="mt-2">
                {group.metrics.map((metric, index) => {
                  return (
                    <div key={metric.key}>
                      {index === otherIndex ? <p className="border-t border-white/[0.06] pt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Other outcomes</p> : null}
                      <MetricLine
                        metric={metric}
                        mode={mode}
                        outcomes={data.outcomes}
                        open={data.quick_log_open}
                        pending={save.pending}
                        onDelta={(key, outcomeId, delta) => save.run(() => logActivityAction(key, outcomeId, delta, 'delta'))}
                        onSet={(key, amount) => save.run(() => logActivityAction(key, null, amount, 'set'))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function TodayPlan({
  plan,
  readOnly,
}: {
  plan: { eod_id?: string; work_date?: string; items?: { text?: string; done_at?: string | null }[] } | null;
  readOnly: boolean;
}) {
  const save = useSaved();
  const items = plan?.items ?? [];
  if (!plan?.eod_id || !items.some((item) => item.text?.trim())) return null;
  return (
    <section className={brand.panel} aria-labelledby="plan-heading">
      <h2 id="plan-heading" className={`${brand.heading} text-lg`}>
        Your plan for today
      </h2>
      <p className="mt-1 text-sm text-neutral-400">From {plan.work_date}. Tick what you finished.</p>
      {readOnly ? <p className="mt-3 text-sm text-neutral-300">View-as is read-only. Exit to let the operator do this.</p> : null}
      {save.error ? <p className="mt-3 text-sm text-[#FFB020]">{save.error}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item, index) =>
          item.text?.trim() ? (
            <li key={`${item.text}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] px-3 py-3">
              <p className={`text-sm ${item.done_at ? 'text-neutral-500 line-through' : 'text-white'}`}>{item.text}</p>
              <button
                type="button"
                disabled={readOnly || save.pending}
                onClick={() => save.run(() => tickPlanAction(plan.eod_id as string, index, !item.done_at))}
                className={brand.ghostButton}
              >
                {item.done_at ? 'Undo' : 'Done'}
              </button>
            </li>
          ) : null,
        )}
      </ul>
    </section>
  );
}

export function ExcusedNote({ days }: { days: { work_date: string; reason: string; note: string | null }[] }) {
  if (days.length === 0) return null;
  return (
    <section className="rounded-3xl border border-white/[0.07] px-5 py-4">
      <h2 className={`${brand.heading} text-lg`}>Excused days</h2>
      <ul className="mt-3 space-y-1 text-sm text-neutral-300">
        {days.slice(0, 8).map((day) => (
          <li key={day.work_date}>
            {formatDate(day.work_date)} · {day.reason.replaceAll('_', ' ')}
            {day.note ? ` · ${day.note}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TaskList({ tasks, doneToday, readOnly }: { tasks: TaskItem[]; doneToday: number; readOnly: boolean }) {
  const save = useSaved();
  return (
    <section className={brand.panel} aria-labelledby="tasks-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tasks-heading" className={`${brand.heading} text-lg`}>
          Today&apos;s tasks
        </h2>
        {doneToday > 0 ? <p className="text-sm text-neutral-400">{doneToday} done today</p> : null}
      </div>
      {tasks.length === 0 ? <p className="mt-3 text-sm text-neutral-400">No tasks today.</p> : null}
      {readOnly ? <p className="mt-3 text-sm text-neutral-300">View-as is read-only. Exit to let the operator do this.</p> : null}
      {save.error ? <p className="mt-3 text-sm text-[#FFB020]">{save.error}</p> : null}
      <ul className="mt-3 space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className={`rounded-2xl border px-3 py-3 ${task.overdue ? 'border-[#FFB020]/40 bg-[#FFB020]/10' : 'border-white/[0.06] bg-white/[0.02]'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{task.title}</p>
                {task.note ? <p className="mt-1 text-sm text-neutral-300">{task.note}</p> : null}
                <p className="mt-1 text-xs text-neutral-500">
                  {task.source === 'system' ? 'System' : 'Manager'} · {task.created_by}
                  {task.due_on ? ` · Due ${formatDate(task.due_on)}${task.due_time ? ` ${task.due_time}` : ''}` : ''}
                  {task.priority === 'high' ? ' · High' : ''}
                  {task.overdue ? <span className="text-[#FFB020]"> · Overdue</span> : ''}
                </p>
              </div>
              {task.source === 'manager' && !readOnly ? (
                <button
                  type="button"
                  disabled={save.pending}
                  onClick={() => save.run(() => completeTaskAction(task.id))}
                  className={brand.ghostButton}
                >
                  Done
                </button>
              ) : null}
            </div>
            {task.source !== 'manager' ? <p className="mt-2 text-xs text-neutral-500">Completes when the EOD is submitted.</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AlertPreview({ alerts, unread, timeZone, readOnly }: { alerts: AlertItem[]; unread: number; timeZone: string; readOnly: boolean }) {
  const save = useSaved();
  return (
    <div className={brand.panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className={`${brand.heading} text-base`}>Alerts</h3>
        <div className="flex items-center gap-3 text-sm">
          {unread > 0 && !readOnly ? (
            <button type="button" disabled={save.pending} onClick={() => save.run(() => markAlertReadAction(null))} className="text-neutral-300 underline-offset-4 hover:underline">
              Mark all read
            </button>
          ) : null}
          <Link href="/workspace/operator/workspace/alerts" className="font-semibold text-[#937DFF]">
            View all
          </Link>
        </div>
      </div>
      {alerts.length === 0 ? <p className="mt-3 text-sm text-neutral-400">No alerts.</p> : null}
      {readOnly ? <p className="mt-3 text-sm text-neutral-300">View-as is read-only. Exit to let the operator do this.</p> : null}
      {save.error ? <p className="mt-3 text-sm text-[#FFB020]">{save.error}</p> : null}
      <ul className="mt-3 space-y-2">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} timeZone={timeZone} readOnly={readOnly} pending={save.pending} onRead={() => save.run(() => markAlertReadAction(alert.id))} />
        ))}
      </ul>
    </div>
  );
}

export function AlertList({ alerts, timeZone, readOnly }: { alerts: AlertItem[]; timeZone: string; readOnly: boolean }) {
  const save = useSaved();
  const unread = alerts.some((alert) => !alert.read);
  return (
    <div>
      {unread && !readOnly ? (
        <button type="button" disabled={save.pending} onClick={() => save.run(() => markAlertReadAction(null))} className={`${brand.ghostButton} mb-4`}>
          Mark all read
        </button>
      ) : null}
      {readOnly ? <p className="mb-4 text-sm text-neutral-300">View-as is read-only. Exit to let the operator do this.</p> : null}
      {save.error ? <p className="mb-4 text-sm text-[#FFB020]">{save.error}</p> : null}
      {alerts.length === 0 ? <p className="text-sm text-neutral-400">No alerts.</p> : null}
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} timeZone={timeZone} readOnly={readOnly || Boolean(alert.read)} pending={save.pending} onRead={() => save.run(() => markAlertReadAction(alert.id))} />
        ))}
      </ul>
    </div>
  );
}

function AlertRow({
  alert,
  timeZone,
  readOnly,
  pending,
  onRead,
}: {
  alert: AlertItem;
  timeZone: string;
  readOnly: boolean;
  pending: boolean;
  onRead: () => void;
}) {
  return (
    <li className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#937DFF]">{alert.type_label}</p>
          <p className="mt-1 text-sm text-white">{alert.text}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {alert.from} · {formatDateTime(alert.created_at, timeZone)}
            {alert.read ? ' · Read' : ''}
          </p>
          {alert.href ? (
            <Link href={alert.href} className="mt-2 inline-block text-sm font-semibold text-[#937DFF]">
              Open the EOD
            </Link>
          ) : null}
        </div>
        {!readOnly && !alert.read ? (
          <button type="button" disabled={pending} onClick={onRead} className={brand.ghostButton}>
            Mark read
          </button>
        ) : null}
      </div>
    </li>
  );
}
