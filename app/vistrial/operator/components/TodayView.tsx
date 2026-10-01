'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { markNotificationReadAction, reportAbsenceAction } from '@/lib/portal/actions';
import { escalationCategory, SEVERITY_LABEL, SEVERITY_TONE, workingDays } from '@/lib/portal/labels';
import { formatDate, formatDateTime, formatMoney, formatTime, shiftPhase, zoneAbbreviation } from '@/lib/portal/time';
import type { TodayData } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, Meter } from '../../components/ui';
import { Card, CardTitle, Feedback, Sheet, useAction, usePortal, VaButton } from './portal';

/** Today: what am I doing right now, in one glance. */
export default function TodayView({ data, extras }: { data: TodayData | null; extras?: React.ReactNode }) {
  const { context, operatorZone } = usePortal();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const onboarding = context.onboarding;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hi {context.operator.first_name || context.operator.name}</h1>

      {onboarding && onboarding.status === 'pending' ? (
        <Card className="border border-brand-500/30">
          <p className="text-sm font-semibold text-white">Finish your onboarding</p>
          <p className="mt-1 text-sm text-neutral-400">{onboarding.protocol_name} is not finished yet.</p>
          {onboarding.link_token ? (
            <a href={`/o/${onboarding.link_token}`} className={`${btnPrimary} ${btnSizeSm} mt-3`}>
              Continue onboarding
            </a>
          ) : null}
        </Card>
      ) : null}

      {data ? <ShiftCard data={data} now={now} operatorZone={operatorZone} /> : null}

      {extras}

      {!extras && data && data.missing_reports.length > 0 ? (
        <Card className="border border-flag-warning/40">
          <p className="text-sm font-semibold text-flag-warning">
            Your shift review for {formatDate(data.missing_reports[0])} is waiting
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            {data.missing_reports.length === 1
              ? 'The system drafted it from your activity. Confirm it, or correct anything that is off.'
              : `${data.missing_reports.length} shifts are waiting for your review. The recorded numbers stand until you confirm or correct them.`}
          </p>
          <Link
            href={`/vistrial/operator/record?review=${data.missing_reports[0]}`}
            className={`${btnPrimary} ${btnSizeSm} mt-3`}
          >
            Review my shift
          </Link>
        </Card>
      ) : null}

      {data && data.overdue_escalations > 0 ? (
        <Card className="border border-flag-critical/40">
          <p className="text-sm font-semibold text-flag-critical">DA is late responding, keep the customer warm</p>
          <p className="mt-1 text-sm text-neutral-400">
            {data.overdue_escalations} escalation{data.overdue_escalations === 1 ? ' is' : 's are'} past the answer time. This
            delay is on DA, not you.
          </p>
        </Card>
      ) : null}

      {data ? <MonthCard data={data} /> : null}

      <Card>
        <CardTitle>Needs your attention</CardTitle>
        <ul className="space-y-2">
          {data?.answers_ready.map((item) => (
            <li key={item.id}>
              <Link href={`/vistrial/operator/escalations#${item.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-flag-good/[0.08] px-3 py-2.5 text-sm">
                <span>
                  Answer ready: <span className="font-medium">{escalationCategory(item.category)}</span>
                </span>
                <Badge tone="good">Open</Badge>
              </Link>
            </li>
          ))}
          {data?.tasks_due.map((task) => (
            <li key={task.id}>
              <Link href="/vistrial/operator/tasks" className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                <span>{task.title}</span>
                <Badge tone={task.overdue ? 'critical' : 'warning'}>{task.overdue ? 'Overdue' : 'Due today'}</Badge>
              </Link>
            </li>
          ))}
          {data?.notifications.map((item) => (
            <Notification key={item.id} item={item} />
          ))}
          {data?.notices.map((notice) => (
            <li key={notice.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
              <Badge tone={SEVERITY_TONE[notice.severity] ?? 'neutral'}>Notice</Badge>
              <p className="mt-1.5 whitespace-pre-wrap text-neutral-300">{notice.body}</p>
            </li>
          ))}
          {!data || (data.answers_ready.length + data.tasks_due.length + data.notifications.length + data.notices.length === 0) ? (
            <li className="text-sm text-neutral-500">Nothing needs you right now.</li>
          ) : null}
        </ul>
      </Card>

      {data?.live ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/vistrial/operator/escalations?new=1" className={`${btnPrimary} ${btnSizeSm} justify-center`}>
            I need help
          </Link>
          <AbsenceButton data={data} />
        </div>
      ) : null}
    </div>
  );
}

function ShiftCard({ data, now, operatorZone }: { data: TodayData; now: number; operatorZone: string }) {
  const phase = shiftPhase(now, data.shift_today, data.next_shift);
  const shown = phase.phase === 'on_shift' ? data.next_shift : data.shift_today ?? data.next_shift;
  const status =
    phase.phase === 'on_shift'
      ? `On shift now (${phase.left} left)`
      : phase.phase === 'starts_in'
        ? `Shift starts in ${phase.in}`
        : phase.phase === 'over'
          ? 'Today’s shift is over'
          : data.live
            ? 'No shift today'
            : 'This placement has ended';
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{data.client_name}</p>
          <p className={`mt-1 text-lg font-semibold ${phase.phase === 'on_shift' ? 'text-flag-good' : 'text-white'}`}>{status}</p>
        </div>
        {phase.phase === 'on_shift' ? <Badge tone="good">Live</Badge> : null}
      </div>
      {shown ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-white/[0.03] px-3 py-2">
            <dt className="text-[11px] text-neutral-500">Your time ({zoneAbbreviation(shown.starts_at, operatorZone)})</dt>
            <dd className="font-medium">
              {formatDateTime(shown.starts_at, operatorZone)} – {formatTime(shown.ends_at, operatorZone)}
            </dd>
          </div>
          <div className="rounded-xl bg-white/[0.03] px-3 py-2">
            <dt className="text-[11px] text-neutral-500">Client time ({zoneAbbreviation(shown.starts_at, data.time_zone)})</dt>
            <dd className="font-medium">
              {formatDateTime(shown.starts_at, data.time_zone)} – {formatTime(shown.ends_at, data.time_zone)}
            </dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-3 text-sm text-neutral-400">
        {data.response_standard_minutes
          ? `Respond to every inquiry within ${data.response_standard_minutes} minute${data.response_standard_minutes === 1 ? '' : 's'}.`
          : 'Respond to every inquiry as fast as you can.'}{' '}
        Works {workingDays(data.working_days)}.
      </p>
    </Card>
  );
}

function MonthCard({ data }: { data: TodayData }) {
  const quota = data.month.quota ?? 0;
  const ratio = quota > 0 ? data.month.confirmed / quota : 0;
  return (
    <Card>
      <CardTitle aside={<span className="text-xs text-neutral-500">{data.month.label}</span>}>This month</CardTitle>
      <p className="text-2xl font-semibold tabular-nums">
        {data.month.confirmed} <span className="text-base font-normal text-neutral-400">of {quota} confirmed</span>
      </p>
      <div className="mt-2">
        <Meter value={ratio} tone={ratio >= 1 ? 'good' : 'brand'} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] text-neutral-500">Waiting for review</p>
          <p className="font-medium">{data.month.pending}</p>
          <p className="text-[11px] text-neutral-500">Don’t count yet</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] text-neutral-500">Commission so far (estimate)</p>
          <p className="font-medium">{formatMoney(data.month.estimated_commission)}</p>
          <p className="text-[11px] text-neutral-500">Confirmed above quota × {formatMoney(data.month.commission_per_booking)}. Final on your locked statement.</p>
        </div>
      </div>
    </Card>
  );
}

function Notification({ item }: { item: TodayData['notifications'][number] }) {
  const { readOnly } = usePortal();
  return (
    <li className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-white">{item.title}</span>
        <Badge tone={SEVERITY_TONE[item.severity] ?? 'neutral'}>{SEVERITY_LABEL[item.severity] ?? 'Info'}</Badge>
      </div>
      <p className="mt-1 text-neutral-400">{item.body}</p>
      {readOnly ? null : (
        <button type="button" onClick={() => void markNotificationReadAction(item.id)} className="mt-1.5 text-xs text-neutral-500 underline">
          Mark as read
        </button>
      )}
    </li>
  );
}

function AbsenceButton({ data }: { data: TodayData }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(data.today);
  const [reason, setReason] = useState('');
  const action = useAction();
  return (
    <>
      <VaButton type="button" onClick={() => setOpen(true)} className={`${btnSecondary} ${btnSizeSm} w-full justify-center`}>
        I can’t make a shift
      </VaButton>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report an absence">
        <p className="text-sm text-neutral-400">
          Tell DA before the shift starts. After it has started, it is recorded as late notice.
        </p>
        <label className={`${labelClass} mt-4`}>Shift date</label>
        <input type="date" value={date} min={data.today} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <label className={`${labelClass} mt-3`}>Why</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
        <VaButton
          type="button"
          disabled={action.pending || reason.trim().length < 3}
          onClick={() => action.run(() => reportAbsenceAction(data.placement_id, date, reason), (r) => r.ok && setReason(''))}
          className={`${btnPrimary} ${btnSizeSm} mt-4`}
          showReason
        >
          Tell DA
        </VaButton>
        <Feedback message={action.message} error={action.error} />
      </Sheet>
    </>
  );
}
