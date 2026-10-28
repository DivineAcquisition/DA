'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { CONTROL_LABEL, formatStandard, STATUS_LABEL } from '@/lib/portal/standards';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { StandardItems } from '@/lib/portal/types';
import {
  addExclusionAction,
  cancelFormalNoticeAction,
  decideTierAction,
  draftFormalNoticeAction,
  postFeedbackAction,
  readTeamAction,
  recordFindingAction,
  sendFormalNoticeAction,
  setProductiveThresholdAction,
  setProductiveTimeAction,
} from '@/lib/team/actions';
import type { FeedbackContext, StaffNotice, StaffReview, StaffStandards } from '@/lib/team/types';
import { Badge, inputClass, labelClass, selectClass } from '../components/ui';
import { Feedback, useAction } from '../operator/components/portal';

function Panel({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="panel rounded-2xl p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function OperatorAccountability({
  standards,
  reviews,
  feedback,
  notices,
  canAdmin,
  viewer,
}: {
  standards: StaffStandards;
  reviews: StaffReview[];
  feedback: FeedbackContext | null;
  notices: StaffNotice[];
  canAdmin: boolean;
  viewer: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">{standards.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The same numbers {standards.name.split(' ')[0]} sees. Everything you decide here is recorded in your name, {viewer}.
        </p>
      </div>
      <StandardsPanel data={standards} />
      {feedback ? <FeedbackPanel data={feedback} /> : null}
      <ReviewsPanel reviews={reviews} />
      <FindingPanel data={standards} />
      {canAdmin ? <ExclusionsPanel data={standards} /> : null}
      {canAdmin ? <ProductivePanel data={standards} /> : null}
      {canAdmin ? <TierPanel operatorId={standards.operator_id} /> : null}
      <NoticesPanel operatorId={standards.operator_id} notices={notices} canAdmin={canAdmin} />
    </div>
  );
}

function StandardsPanel({ data }: { data: StaffStandards }) {
  const [open, setOpen] = useState<string | null>(null);
  const [items, setItems] = useState<StandardItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const show = async (key: string) => {
    setOpen(key);
    setItems(null);
    setError(null);
    const result = await readTeamAction<StandardItems>('staff_standard_items', { p_operator_id: data.operator_id, p_key: key, p_month: data.month });
    if (result.ok) setItems(result.data ?? null);
    else setError(result.error);
  };
  return (
    <Panel title="Standards this month">
      <ul className="space-y-2">
        {data.standards.map((s) => (
          <li key={s.key} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => show(s.key)} className="min-w-0 text-left text-sm text-neutral-200 hover:underline">
                {s.label}
              </button>
              <span className="flex shrink-0 items-center gap-2 text-sm">
                <span className="tabular-nums text-white">{s.measured ? formatStandard(s.value, s.unit) : '–'}</span>
                <Badge tone={STATUS_LABEL[s.status].tone}>{STATUS_LABEL[s.status].label}</Badge>
              </span>
            </div>
            {s.note ? <p className="mt-1 text-xs text-neutral-500">{s.note}</p> : null}
            {open === s.key ? (
              <div className="mt-2 border-t border-white/[0.06] pt-2">
                {error ? <p className="text-xs text-flag-critical">{error}</p> : null}
                {!items && !error ? <p className="text-xs text-neutral-500">Loading…</p> : null}
                <ul className="space-y-1 text-xs">
                  {items?.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-2 text-neutral-400">
                      <span className="truncate">
                        {i.label ?? (i.date ? formatDate(i.date) : i.at ? i.at.slice(0, 16).replace('T', ' ') : i.id)}
                        {i.excluded_reason ? ` · ${i.excluded_reason}` : ''}
                      </span>
                      <span className={i.counted ? (i.met ? 'text-flag-good' : 'text-neutral-200') : 'text-neutral-600'}>
                        {i.counted ? (i.met ? 'Met' : 'Missed') : 'Left out'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function FeedbackPanel({ data }: { data: FeedbackContext }) {
  const posted = data.history.find((h) => h.week_start === data.week_start);
  const [keep, setKeep] = useState('');
  const [improve, setImprove] = useState('');
  const [focus, setFocus] = useState('');
  const action = useAction();
  return (
    <Panel id="feedback" title={`Weekly feedback · week of ${formatDate(data.week_start)}`}>
      <div className="mb-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Their own view first</p>
        <p className="mt-1 text-neutral-200">{data.self_review ? data.self_review.focus_line : 'No self-review for that week.'}</p>
        {data.reflections.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-neutral-400">
            {data.reflections.map((r) => (
              <li key={r.shift_date}>
                {formatDate(r.shift_date)}: {[r.went_well, r.differently, r.in_way].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {posted ? (
        <p className="text-sm text-neutral-300">
          Posted by {posted.author}. Focus: {posted.focus}. {posted.acknowledged_at ? 'Acknowledged.' : 'Not acknowledged yet.'}
          {posted.reply ? ` Reply: ${posted.reply}` : ''}
        </p>
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className={labelClass}>Keep doing (one or two specific things)</span>
            <textarea value={keep} onChange={(e) => setKeep(e.target.value)} rows={2} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Improve (one thing, tied to a standard or a real example)</span>
            <textarea value={improve} onChange={(e) => setImprove(e.target.value)} rows={2} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Next week&apos;s focus (one sentence, shown on their My Day)</span>
            <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={300} className={inputClass} />
          </label>
          <button
            type="button"
            disabled={action.pending}
            onClick={() =>
              action.run(() => postFeedbackAction({ operatorId: data.operator_id, weekStart: data.week_start, keepDoing: keep, improve, focus }))
            }
            className={`${btnPrimary} ${btnSizeSm}`}
          >
            Post feedback
          </button>
        </div>
      )}
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function ReviewsPanel({ reviews }: { reviews: StaffReview[] }) {
  return (
    <Panel title="Shift reviews (last 60 days)">
      {reviews.length === 0 ? <p className="text-sm text-neutral-500">No drafted shifts yet.</p> : null}
      <ul className="space-y-2">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-200">
                {formatDate(r.shift_date)} · {r.client_name}
              </span>
              <Badge tone={r.status === 'confirmed' ? 'good' : 'neutral'}>{r.status === 'confirmed' ? 'Confirmed' : r.status === 'open' ? 'Open' : 'Unconfirmed'}</Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Captured: {r.system.conversations ?? 'n/c'} conversations, {r.system.appointments_booked} booked, {r.system.escalations_raised} escalations
              {r.report ? ` · Confirmed: ${r.report.conversations_handled} conversations, ${r.report.appointments_booked} booked` : ''}
              {r.flagged ? ' · attribution flagged' : ''}
            </p>
            {r.report?.variance_explanation ? <p className="text-xs text-neutral-400">Their reason: {r.report.variance_explanation}</p> : null}
            {r.blockers.map((b) => (
              <p key={b.id} className="text-xs text-neutral-400">
                {CONTROL_LABEL[b.control]}: {b.note}
                {b.resolved_at ? ` (resolved: ${b.resolution})` : ''}
              </p>
            ))}
            {r.reflection.went_well || r.reflection.differently || r.reflection.in_way ? (
              <p className="text-xs text-neutral-500">
                Reflection: {[r.reflection.went_well, r.reflection.differently, r.reflection.in_way].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function FindingPanel({ data }: { data: StaffStandards }) {
  const live = data.placements.filter((p) => p.live);
  const [placement, setPlacement] = useState(live[0]?.id ?? data.placements[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const action = useAction();
  if (data.placements.length === 0) return null;
  return (
    <Panel title="Escalation discipline">
      <p className="mb-3 text-xs text-neutral-500">
        Record a matter that should have been escalated but was handled without DA, with the verified facts. The VA is told and can
        dispute it. Nothing follows automatically.
      </p>
      {data.findings.length > 0 ? (
        <ul className="mb-3 space-y-1 text-xs text-neutral-400">
          {data.findings.map((f) => (
            <li key={f.id}>
              {formatDate(f.occurred_on)}: {f.note} ({f.recorded_by})
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
        <select value={placement} onChange={(e) => setPlacement(e.target.value)} className={selectClass}>
          {data.placements.map((p) => (
            <option key={p.id} value={p.id}>
              {p.client_name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputClass} mt-2`} placeholder="What happened, verified" />
      <button
        type="button"
        disabled={action.pending || !date || note.trim().length < 5}
        onClick={() => action.run(() => recordFindingAction({ operatorId: data.operator_id, placementId: placement, date, note }))}
        className={`${btnSecondary} ${btnSizeSm} mt-2`}
      >
        Record finding
      </button>
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function ExclusionsPanel({ data }: { data: StaffStandards }) {
  const [placement, setPlacement] = useState(data.placements[0]?.id ?? '');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [kind, setKind] = useState('outage');
  const [reason, setReason] = useState('');
  const action = useAction();
  if (data.placements.length === 0) return null;
  return (
    <Panel title="Outage and incident windows">
      <p className="mb-3 text-xs text-neutral-500">Items inside a window are left out for every VA on that placement, with your reason shown to them.</p>
      <ul className="mb-3 space-y-1 text-xs text-neutral-400">
        {data.placements.flatMap((p) =>
          p.exclusions.map((w) => (
            <li key={w.id}>
              {p.client_name}: {w.starts_at.slice(0, 16).replace('T', ' ')} to {w.ends_at.slice(0, 16).replace('T', ' ')} UTC ·{' '}
              {w.kind === 'outage' ? 'Outage' : 'Client incident'} · {w.reason} ({w.created_by})
            </li>
          )),
        )}
      </ul>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={placement} onChange={(e) => setPlacement(e.target.value)} className={selectClass}>
          {data.placements.map((p) => (
            <option key={p.id} value={p.id}>
              {p.client_name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass}>
          <option value="outage">System outage</option>
          <option value="client_incident">Client-side incident</option>
        </select>
        <label>
          <span className={labelClass}>From (UTC)</span>
          <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>To (UTC)</span>
          <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className={inputClass} />
        </label>
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} mt-2`} placeholder="Reason the VAs will see" />
      <button
        type="button"
        disabled={action.pending || !starts || !ends || reason.trim().length < 3}
        onClick={() =>
          action.run(() =>
            addExclusionAction({ placementId: placement, startsAt: `${starts}:00Z`, endsAt: `${ends}:00Z`, kind, reason }),
          )
        }
        className={`${btnSecondary} ${btnSizeSm} mt-2`}
      >
        Mark window
      </button>
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function ProductivePanel({ data }: { data: StaffStandards }) {
  const [placement, setPlacement] = useState(data.placements[0]?.id ?? '');
  const current = data.placements.find((p) => p.id === placement);
  const [threshold, setThreshold] = useState(current?.productive_minutes_weekly?.toString() ?? '');
  const [week, setWeek] = useState('');
  const [minutes, setMinutes] = useState('');
  const action = useAction();
  if (data.placements.length === 0) return null;
  return (
    <Panel title="Productive time">
      <p className="mb-3 text-xs text-neutral-500">
        Entered by hand until the monitoring tool is connected. Weeks with no entry show as not measured, never zero.
      </p>
      <select value={placement} onChange={(e) => setPlacement(e.target.value)} className={selectClass}>
        {data.placements.map((p) => (
          <option key={p.id} value={p.id}>
            {p.client_name}
          </option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label>
          <span className={labelClass}>Weekly threshold (minutes)</span>
          <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" className={`${inputClass} w-36`} />
        </label>
        <button
          type="button"
          onClick={() => action.run(() => setProductiveThresholdAction(placement, threshold ? Number(threshold) : null))}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Save threshold
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label>
          <span className={labelClass}>Week starting (Monday)</span>
          <input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>Minutes</span>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" className={`${inputClass} w-28`} />
        </label>
        <button
          type="button"
          disabled={!week || minutes === ''}
          onClick={() => action.run(() => setProductiveTimeAction({ operatorId: data.operator_id, placementId: placement, weekStart: week, minutes: Number(minutes) }))}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Save week
        </button>
      </div>
      {data.productive_time.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-neutral-400">
          {data.productive_time.map((pt) => (
            <li key={`${pt.placement_id}-${pt.week_start}`}>
              Week of {formatDate(pt.week_start)}: {pt.minutes} minutes ({pt.entered_by})
            </li>
          ))}
        </ul>
      ) : null}
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function TierPanel({ operatorId }: { operatorId: string }) {
  const [tier, setTier] = useState('2');
  const [reason, setReason] = useState('');
  const action = useAction();
  return (
    <Panel title="Tier decision">
      <p className="mb-2 text-xs text-neutral-500">Tiers change only when an admin decides here. The VA sees your reason.</p>
      <div className="flex flex-wrap items-end gap-2">
        <select value={tier} onChange={(e) => setTier(e.target.value)} className={`${selectClass} w-32`}>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} min-w-0 flex-1`} placeholder="Reason" />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={action.pending || reason.trim().length < 3}
          onClick={() => action.run(() => decideTierAction({ operatorId, toTier: Number(tier), approve: true, reason }))}
          className={`${btnPrimary} ${btnSizeSm}`}
        >
          Approve move
        </button>
        <button
          type="button"
          disabled={action.pending || reason.trim().length < 3}
          onClick={() => action.run(() => decideTierAction({ operatorId, toTier: Number(tier), approve: false, reason }))}
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Decline
        </button>
      </div>
      <Feedback message={action.message} error={action.error} />
    </Panel>
  );
}

function NoticesPanel({ operatorId, notices, canAdmin }: { operatorId: string; notices: StaffNotice[]; canAdmin: boolean }) {
  const action = useAction();
  return (
    <Panel id="notices" title="Formal notices">
      <p className="mb-3 text-xs text-neutral-500">
        Never sent automatically. An admin drafts one from a template, replaces every placeholder with verified facts, and presses
        send. The admin who sends it is recorded as the approver.
      </p>
      {canAdmin ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => action.run(() => draftFormalNoticeAction(operatorId, 'formal_shift_coverage'))} className={`${btnSecondary} ${btnSizeSm}`}>
            Draft: shift coverage
          </button>
          <button type="button" onClick={() => action.run(() => draftFormalNoticeAction(operatorId, 'formal_general'))} className={`${btnSecondary} ${btnSizeSm}`}>
            Draft: general
          </button>
        </div>
      ) : (
        <p className="mb-3 text-xs text-neutral-500">Only an owner or admin can draft and send formal notices.</p>
      )}
      <Feedback message={action.message} error={action.error} />
      <ul className="space-y-3">
        {notices.map((n) => (
          <NoticeItem key={n.id} notice={n} canAdmin={canAdmin} />
        ))}
      </ul>
    </Panel>
  );
}

function NoticeItem({ notice, canAdmin }: { notice: StaffNotice; canAdmin: boolean }) {
  const [subject, setSubject] = useState(notice.subject);
  const [body, setBody] = useState(notice.body);
  const action = useAction();
  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{notice.subject}</p>
        <Badge tone={notice.status === 'sent' ? 'critical' : 'neutral'}>{notice.status === 'draft' ? 'Draft' : notice.status === 'sent' ? 'Sent' : 'Cancelled'}</Badge>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Drafted by {notice.drafted_by} {formatDate(notice.drafted_at.slice(0, 10))}
        {notice.sent_at ? ` · sent by ${notice.approved_by} ${formatDateTime(notice.sent_at, 'UTC')} UTC` : ''}
      </p>
      {notice.status === 'draft' && canAdmin ? (
        <div className="mt-2 space-y-2">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={inputClass} />
          <div className="flex gap-2">
            <button type="button" disabled={action.pending} onClick={() => action.run(() => sendFormalNoticeAction(notice.id, subject, body))} className={`${btnPrimary} ${btnSizeSm}`}>
              I have reviewed this. Send it.
            </button>
            <button type="button" onClick={() => action.run(() => cancelFormalNoticeAction(notice.id))} className={`${btnSecondary} ${btnSizeSm}`}>
              Cancel draft
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-300">{notice.body}</p>
      )}
      {notice.reply ? <p className="mt-2 text-xs text-neutral-400">Their reply: {notice.reply}</p> : null}
      <Feedback message={action.message} error={action.error} />
    </li>
  );
}
