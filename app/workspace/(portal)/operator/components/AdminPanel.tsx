'use client';

import { useCallback, useEffect, useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { attendance, bookingState, escalationCategory, OPERATOR_STATUS, PAYOUT_METHOD, TAX_STATUS, workingDays } from '@/lib/portal/labels';
import {
  addNoteAction,
  answerEscalationAction,
  answerPayQuestionAction,
  assignTaskAction,
  assignTrainingAction,
  decideLdAction,
  reviewBookingAction,
  sendNotificationAction,
  setAttendanceAction,
  staffPanelAction,
} from '@/lib/portal/staffActions';
import { formatDate, formatDateTime, formatDuration, formatMoney } from '@/lib/portal/time';
import type { PortalContext } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, selectClass } from '../../components/ui';
import PlaybookEditor from './PlaybookEditor';
import { Feedback, useAction } from './portal';

type Panel = {
  operator: {
    id: string;
    name: string;
    status: string;
    tier: number | null;
    certified_on: string | null;
    joined_on: string | null;
    time_zone: string;
    account_state: string | null;
  };
  viewer: {
    role: string;
    is_admin: boolean;
    can_review_bookings: boolean;
    can_answer_escalations: boolean;
    can_manage_attendance: boolean;
    can_assign: boolean;
    can_message: boolean;
    can_notes: boolean;
    can_decide_ld: boolean;
    can_edit_playbooks: boolean;
    can_see_pay: boolean;
  };
  placements: {
    id: string;
    client_name: string;
    status: string;
    live: boolean;
    start_date: string;
    end_date: string | null;
    shift_start: string | null;
    shift_end: string | null;
    time_zone: string;
    working_days: number[];
    monthly_booking_quota: number | null;
    commission_per_booking: number | null;
    client_rate_per_booking: number | null;
    has_client_playbook: boolean;
    has_override: boolean;
  }[];
  attendance: {
    shifts: {
      placement_id: string;
      client_name: string;
      shift_date: string;
      status: string;
      late_notice: boolean;
      reason: string | null;
      decided_by: string | null;
    }[];
    this_month: Record<string, number>;
    abandonments_30_days: number;
    ghosting_alert_at: string | null;
  };
  escalations: {
    id: string;
    category: string;
    customer_context: string;
    needed: string;
    status: string;
    raised_at: string;
    response_due_at: string | null;
    overdue: boolean;
    answer: string | null;
  }[];
  pending_bookings: {
    id: string;
    customer: string;
    customer_phone: string | null;
    customer_email: string | null;
    scheduled_for: string;
    recorded_at: string;
    operator_note: string | null;
    live_transfer: boolean;
  }[];
  onboarding: { status: string; protocol_name: string } | null;
  training: { id: string; title: string; completed_on: string | null }[];
  tasks: { id: string; title: string; due_on: string | null; overdue: boolean }[];
  pay: {
    statements: { id: string; period_start: string | null; period_end: string | null; total: number; locked: boolean }[];
    questions: { id: string; body: string; asked_at: string; answer: string | null; answered_at: string | null }[];
    payout_method: string | null;
    payout_last4: string | null;
    tax_doc_status: string | null;
  } | null;
  ld_proposals: {
    id: string;
    shift_date: string;
    amount: number;
    status: string;
    decided_by: string | null;
    decision_reason: string | null;
    applied_amount: number | null;
  }[] | null;
  notes: { id: string; body: string; author: string; created_at: string; during_view_as: boolean }[] | null;
};

/**
 * The admin panel: a side panel on desktop, a bottom sheet on a phone. It shows
 * what the VA cannot see, and every action here is taken in the viewer's own
 * name by a staff_* function. The VA's view behind it refreshes after each one.
 */
export default function AdminPanel({ context, open, onClose }: { context: PortalContext; open: boolean; onClose: () => void }) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbookFor, setPlaybookFor] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  const load = useCallback(async () => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    staffPanelAction(context.operator.id).then((result) => {
      if (!live) return;
      if (result.ok) {
        setPanel(result.data as Panel);
        setError(null);
      } else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [open, context.operator.id, tick]);

  if (!open) return null;
  const zone = context.operator.time_zone;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-end md:items-stretch" role="dialog" aria-label="Admin panel">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-cyan-400/40 bg-ink-900 md:mt-[52px] md:max-h-none md:w-[440px] md:rounded-none md:border-y-0 md:border-r-0">
        <div className="flex items-center justify-between gap-3 border-b border-cyan-400/25 bg-cyan-400/[0.08] px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">Admin panel</p>
            <p className="text-sm text-neutral-300">Everything here is done in your own name.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 text-xl text-neutral-400 hover:text-white" aria-label="Close">
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {error ? <Feedback error={error} /> : null}
          {!panel && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
          {panel ? (
            <>
              <Section title="This operator">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <Item label="Status">{OPERATOR_STATUS[panel.operator.status] ?? 'Sales Operator'}</Item>
                  <Item label="Account">{panel.operator.account_state ?? 'No sign-in'}</Item>
                  <Item label="Tier">{panel.operator.tier ?? '—'}</Item>
                  <Item label="Certified">{panel.operator.certified_on ? formatDate(panel.operator.certified_on, true) : 'Not yet'}</Item>
                  <Item label="Joined">{panel.operator.joined_on ? formatDate(panel.operator.joined_on, true) : '—'}</Item>
                  <Item label="Onboarding">
                    {panel.onboarding ? (panel.onboarding.status === 'completed' ? 'Finished' : 'Not finished') : 'None sent'}
                  </Item>
                </dl>
              </Section>

              <Section title="Placements">
                {panel.placements.map((placement) => (
                  <div key={placement.id} className="rounded-xl border border-white/[0.06] p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-white">{placement.client_name}</p>
                      <Badge tone={placement.live ? 'good' : 'neutral'}>{placement.live ? 'Active' : 'Ended'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {placement.shift_start}–{placement.shift_end} {placement.time_zone} · {workingDays(placement.working_days)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">
                      Quota {placement.monthly_booking_quota ?? '—'} · Commission {formatMoney(placement.commission_per_booking)}
                      {panel.viewer.is_admin && placement.client_rate_per_booking !== null ? (
                        <span className="text-cyan-300"> · Client rate {formatMoney(placement.client_rate_per_booking)} (admins only)</span>
                      ) : null}
                    </p>
                    {panel.viewer.can_edit_playbooks ? (
                      <button type="button" onClick={() => setPlaybookFor(placement.id)} className="mt-2 text-xs font-semibold text-cyan-300 underline">
                        Open the playbook editor
                      </button>
                    ) : null}
                  </div>
                ))}
              </Section>

              <Attendance panel={panel} reload={load} />
              <Bookings panel={panel} zone={zone} reload={load} />
              <Escalations panel={panel} zone={zone} reload={load} />

              <Section title="Onboarding and training">
                <ul className="space-y-1 text-sm">
                  {panel.training.length === 0 ? <li className="text-neutral-500">No training items.</li> : null}
                  {panel.training.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="text-neutral-300">{item.title}</span>
                      <span className="text-xs text-neutral-500">{item.completed_on ? `Done ${formatDate(item.completed_on)}` : 'Not done'}</span>
                    </li>
                  ))}
                </ul>
                {panel.tasks.length ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    {panel.tasks.length} open task{panel.tasks.length === 1 ? '' : 's'}, {panel.tasks.filter((t) => t.overdue).length} overdue
                  </p>
                ) : null}
              </Section>

              {panel.viewer.can_assign ? <Assign panel={panel} reload={load} /> : null}
              {panel.viewer.can_message ? <Message panel={panel} reload={load} /> : null}
              {panel.pay ? <Pay panel={panel} reload={load} /> : null}
              {panel.ld_proposals ? <Ld panel={panel} reload={load} /> : null}
              {panel.notes ? <Notes panel={panel} reload={load} /> : null}
            </>
          ) : null}
        </div>
      </aside>
      {playbookFor ? <PlaybookEditor placementId={playbookFor} onClose={() => setPlaybookFor(null)} /> : null}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{title}</h3>
        {aside}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </div>
  );
}

function Attendance({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [target, setTarget] = useState<{ placementId: string; date: string } | null>(null);
  const [status, setStatus] = useState('excused_emergency');
  const [reason, setReason] = useState('');
  const month = panel.attendance.this_month ?? {};
  const review = panel.attendance.shifts.filter((s) =>
    ['suspected_missed', 'worked_report_missing', 'abandoned', 'excused_emergency', 'notified_absence'].includes(s.status),
  );

  return (
    <Section title="Attendance">
      <p className="text-sm text-neutral-300">
        This month: {(month.worked ?? 0) + (month.report_missing ?? 0)} worked · {month.suspected_missed ?? 0} missed ·{' '}
        {(month.excused ?? 0) + (month.notified_absence ?? 0)} excused or notified · {month.abandoned ?? 0} abandoned
      </p>
      {panel.attendance.abandonments_30_days >= 2 ? (
        <Badge tone="critical">Two abandonments in 30 days (Section 6.4)</Badge>
      ) : null}
      {panel.attendance.ghosting_alert_at ? <Badge tone="critical">Ghosting alert (Section 6.5)</Badge> : null}
      <ul className="space-y-1.5">
        {review.slice(0, 12).map((shift) => (
          <li key={`${shift.placement_id}-${shift.shift_date}`} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-neutral-300">
              {formatDate(shift.shift_date)} · {attendance(shift.status).label}
              {shift.late_notice ? ' (late notice)' : ''}
            </span>
            {panel.viewer.can_manage_attendance ? (
              <button
                type="button"
                onClick={() => {
                  setTarget({ placementId: shift.placement_id, date: shift.shift_date });
                  setStatus(shift.status === 'suspected_missed' ? 'abandoned' : 'excused_emergency');
                }}
                className="shrink-0 text-xs font-semibold text-cyan-300 underline"
              >
                Decide
              </button>
            ) : null}
          </li>
        ))}
        {review.length === 0 ? <li className="text-sm text-neutral-500">Nothing to review.</li> : null}
      </ul>
      {target ? (
        <div className="rounded-xl border border-cyan-400/25 p-3">
          <p className="text-sm text-white">Shift on {formatDate(target.date, true)}</p>
          <label className={`${labelClass} mt-2`}>Record it as</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
            <option value="abandoned">Abandoned (no notice, no work)</option>
            <option value="excused_emergency">Excused emergency</option>
            <option value="worked">Worked (correct the record)</option>
            <option value="notified_absence">They did give notice (correct the record)</option>
          </select>
          <label className={`${labelClass} mt-2`}>Why</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} />
          {status === 'abandoned' ? (
            <p className="mt-1 text-xs text-neutral-500">This proposes the liquidated damages set in Team settings (Section 6.3). Nothing is deducted until an admin approves it.</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={action.pending}
              onClick={() =>
                action.run(() => setAttendanceAction(target.placementId, target.date, status, reason), (r) => {
                  if (r.ok) {
                    setTarget(null);
                    setReason('');
                    void reload();
                  }
                })
              }
              className={`${btnPrimary} ${btnSizeSm}`}
            >
              Record
            </button>
            <button type="button" onClick={() => setTarget(null)} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Bookings({ panel, zone, reload }: { panel: Panel; zone: string; reload: () => Promise<void> }) {
  const action = useAction();
  const [now] = useState(() => Date.now());
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const oldest = panel.pending_bookings[0];
  return (
    <Section
      title="Bookings awaiting review"
      aside={<span className="text-xs text-neutral-500">{panel.pending_bookings.length}{oldest ? `, oldest ${formatDuration(now - Date.parse(oldest.recorded_at))}` : ''}</span>}
    >
      {panel.pending_bookings.length === 0 ? <p className="text-sm text-neutral-500">Nothing waiting.</p> : null}
      {panel.pending_bookings.slice(0, 10).map((booking) => (
        <div key={booking.id} className="rounded-xl border border-white/[0.06] p-3 text-sm">
          <p className="font-medium text-white">{booking.customer}</p>
          <p className="text-xs text-neutral-400">
            {booking.live_transfer ? 'Live transfer · ' : ''}
            {formatDateTime(booking.scheduled_for, zone)} · {booking.customer_phone ?? booking.customer_email ?? 'no contact'}
          </p>
          {booking.operator_note ? <p className="mt-1 text-xs text-neutral-500">“{booking.operator_note}”</p> : null}
          {panel.viewer.can_review_bookings ? (
            rejecting === booking.id ? (
              <div className="mt-2">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={inputClass} placeholder="Why it does not count (the VA sees this)" />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={action.pending || reason.trim().length < 3}
                    onClick={() =>
                      action.run(() => reviewBookingAction(booking.id, 'reject', reason), (r) => {
                        if (r.ok) {
                          setRejecting(null);
                          setReason('');
                          void reload();
                        }
                      })
                    }
                    className={`${btnPrimary} ${btnSizeSm}`}
                  >
                    Reject
                  </button>
                  <button type="button" onClick={() => setRejecting(null)} className={`${btnSecondary} ${btnSizeSm}`}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={action.pending}
                  onClick={() => action.run(() => reviewBookingAction(booking.id, 'approve', ''), (r) => r.ok && void reload())}
                  className={`${btnPrimary} ${btnSizeSm}`}
                >
                  Approve
                </button>
                <button type="button" onClick={() => setRejecting(booking.id)} className={`${btnSecondary} ${btnSizeSm}`}>
                  Reject…
                </button>
              </div>
            )
          ) : null}
        </div>
      ))}
      <Feedback message={action.message} error={action.error} />
      <p className="text-[11px] text-neutral-600">States shown to the VA: {bookingState('pending_review').label}, {bookingState('confirmed').label}, {bookingState('rejected').label}.</p>
    </Section>
  );
}

function Escalations({ panel, zone, reload }: { panel: Panel; zone: string; reload: () => Promise<void> }) {
  const action = useAction();
  const [now] = useState(() => Date.now());
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const open = panel.escalations.filter((e) => e.status === 'open');
  return (
    <Section title="Open escalations" aside={<span className="text-xs text-neutral-500">{open.length}</span>}>
      {open.length === 0 ? <p className="text-sm text-neutral-500">None open.</p> : null}
      {open.map((item) => (
        <div key={item.id} className={`rounded-xl border p-3 text-sm ${item.overdue ? 'border-flag-critical/40' : 'border-white/[0.06]'}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-white">{escalationCategory(item.category)}</span>
            <span className={`text-xs ${item.overdue ? 'text-flag-critical' : 'text-neutral-500'}`}>
              waiting {formatDuration(now - Date.parse(item.raised_at))}
              {item.overdue ? ' · late' : item.response_due_at ? ` · due ${formatDateTime(item.response_due_at, zone)}` : ''}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">{item.customer_context}</p>
          <p className="mt-1 text-xs text-neutral-200">Needs: {item.needed}</p>
          {panel.viewer.can_answer_escalations ? (
            answering === item.id ? (
              <div className="mt-2">
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} className={inputClass} placeholder="The answer the VA will act on" />
                <button
                  type="button"
                  disabled={action.pending || answer.trim().length < 2}
                  onClick={() =>
                    action.run(() => answerEscalationAction(item.id, answer), (r) => {
                      if (r.ok) {
                        setAnswering(null);
                        setAnswer('');
                        void reload();
                      }
                    })
                  }
                  className={`${btnPrimary} ${btnSizeSm} mt-2`}
                >
                  Send answer
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAnswering(item.id)} className="mt-2 text-xs font-semibold text-cyan-300 underline">
                Answer
              </button>
            )
          ) : null}
        </div>
      ))}
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Assign({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [kind, setKind] = useState<'task' | 'training'>('task');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueOn, setDueOn] = useState('');
  return (
    <Section title="Assign">
      <div className="flex gap-2">
        {(['task', 'training'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`rounded-full px-3 py-1 text-xs ${kind === value ? 'bg-cyan-400 text-cyan-950' : 'bg-white/[0.05] text-neutral-300'}`}
          >
            {value === 'task' ? 'A task' : 'Training'}
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Title" />
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} className={inputClass} placeholder="Detail (optional)" />
      {kind === 'task' ? <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputClass} /> : null}
      <button
        type="button"
        disabled={action.pending || title.trim().length < 3}
        onClick={() =>
          action.run(
            () =>
              kind === 'task'
                ? assignTaskAction({ operatorId: panel.operator.id, title, detail, dueOn, placementId: '' })
                : assignTrainingAction({ operatorId: panel.operator.id, title, detail, assetId: '' }),
            (r) => {
              if (r.ok) {
                setTitle('');
                setDetail('');
                setDueOn('');
                void reload();
              }
            },
          )
        }
        className={`${btnPrimary} ${btnSizeSm}`}
      >
        Assign
      </button>
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Message({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState('informational');
  const [blocking, setBlocking] = useState(false);
  return (
    <Section title="Send a notification">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Title" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={inputClass} placeholder="Message" />
      <div className="flex flex-wrap items-center gap-3">
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="informational">Info</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input type="checkbox" checked={blocking} onChange={(e) => setBlocking(e.target.checked)} />
          Blocking: they must confirm it before working
        </label>
      </div>
      <button
        type="button"
        disabled={action.pending || title.trim().length < 2 || body.trim().length < 2}
        onClick={() =>
          action.run(() => sendNotificationAction({ operatorId: panel.operator.id, title, body, severity, blocking }), (r) => {
            if (r.ok) {
              setTitle('');
              setBody('');
              setBlocking(false);
              void reload();
            }
          })
        }
        className={`${btnPrimary} ${btnSizeSm}`}
      >
        Send
      </button>
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Pay({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [answering, setAnswering] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const pay = panel.pay!;
  return (
    <Section title="Pay (owners and admins)">
      <p className="text-sm text-neutral-300">
        {pay.payout_method ? `${PAYOUT_METHOD[pay.payout_method] ?? pay.payout_method} ending ${pay.payout_last4 ?? '????'}` : 'No payout method'} · Tax
        document: {pay.tax_doc_status ? TAX_STATUS[pay.tax_doc_status]?.label ?? pay.tax_doc_status : 'Missing'}
      </p>
      <ul className="space-y-1 text-sm">
        {pay.statements.map((s) => (
          <li key={s.id} className="flex justify-between gap-2">
            <span className="text-neutral-400">
              {s.period_start ? `${formatDate(s.period_start)} – ${formatDate(s.period_end ?? s.period_start)}` : 'Statement'}
            </span>
            <span className="text-neutral-200">
              {formatMoney(s.total)} {s.locked ? '· final' : '· open'}
            </span>
          </li>
        ))}
        {pay.statements.length === 0 ? <li className="text-neutral-500">No statements yet.</li> : null}
      </ul>
      {pay.questions.filter((q) => !q.answered_at).map((q) => (
        <div key={q.id} className="rounded-xl border border-white/[0.06] p-3 text-sm">
          <p className="text-neutral-200">“{q.body}”</p>
          {answering === q.id ? (
            <>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} className={`${inputClass} mt-2`} />
              <button
                type="button"
                disabled={action.pending || answer.trim().length < 2}
                onClick={() =>
                  action.run(() => answerPayQuestionAction(q.id, answer), (r) => {
                    if (r.ok) {
                      setAnswering(null);
                      setAnswer('');
                      void reload();
                    }
                  })
                }
                className={`${btnPrimary} ${btnSizeSm} mt-2`}
              >
                Answer
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setAnswering(q.id)} className="mt-1 text-xs font-semibold text-cyan-300 underline">
              Answer this pay question
            </button>
          )}
        </div>
      ))}
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Ld({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [reason, setReason] = useState('');
  const proposals = panel.ld_proposals ?? [];
  return (
    <Section title="Liquidated damages (Section 6.3)">
      {proposals.length === 0 ? <p className="text-sm text-neutral-500">No proposals.</p> : null}
      {proposals.map((p) => (
        <div key={p.id} className="rounded-xl border border-white/[0.06] p-3 text-sm">
          <p className="text-neutral-200">
            {formatMoney(p.amount)} for the abandoned shift on {formatDate(p.shift_date, true)}
          </p>
          {p.status === 'proposed' ? (
            <>
              <p className="mt-1 text-xs text-neutral-500">
                Applied only against commission and speed bonus on the open statement, never earned base pay.
              </p>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${inputClass} mt-2`} placeholder="Reason for your decision" />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={action.pending || reason.trim().length < 5}
                  onClick={() => action.run(() => decideLdAction(p.id, true, reason), (r) => r.ok && void reload())}
                  className={`${btnPrimary} ${btnSizeSm}`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={action.pending || reason.trim().length < 5}
                  onClick={() => action.run(() => decideLdAction(p.id, false, reason), (r) => r.ok && void reload())}
                  className={`${btnSecondary} ${btnSizeSm}`}
                >
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-xs text-neutral-500">
              {p.status === 'approved' ? `Approved, ${formatMoney(p.applied_amount ?? 0)} applied` : 'Dismissed'}
              {p.decided_by ? ` by ${p.decided_by}` : ''}
              {p.decision_reason ? `: ${p.decision_reason}` : ''}
            </p>
          )}
        </div>
      ))}
      <Feedback message={action.message} error={action.error} />
    </Section>
  );
}

function Notes({ panel, reload }: { panel: Panel; reload: () => Promise<void> }) {
  const action = useAction();
  const [body, setBody] = useState('');
  return (
    <Section title="Internal notes (never shown to the VA)">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className={inputClass} placeholder="Add a note" />
      <button
        type="button"
        disabled={action.pending || body.trim().length < 2}
        onClick={() =>
          action.run(() => addNoteAction(panel.operator.id, body), (r) => {
            if (r.ok) {
              setBody('');
              void reload();
            }
          })
        }
        className={`${btnPrimary} ${btnSizeSm}`}
      >
        Add note
      </button>
      <Feedback message={action.message} error={action.error} />
      <ul className="space-y-2">
        {(panel.notes ?? []).map((note) => (
          <li key={note.id} className="rounded-xl bg-white/[0.03] p-2.5 text-sm">
            <p className="whitespace-pre-wrap text-neutral-200">{note.body}</p>
            <p className="mt-1 text-[11px] text-neutral-500">
              {note.author} · {formatDate(note.created_at.slice(0, 10))}
              {note.during_view_as ? ' · during View As' : ''}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
