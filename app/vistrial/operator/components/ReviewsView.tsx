'use client';

import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { confirmShiftAction, type ReviewEntry } from '@/lib/portal/actions';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import type { BlockerControl, ReviewsData, ShiftReview } from '@/lib/portal/types';
import { Badge, inputClass, labelClass, selectClass } from '../../components/ui';
import { CONTROL_LABEL } from '@/lib/portal/standards';
import { Card, CardTitle, Empty, Feedback, Sheet, useAction, usePortal, VaButton, VaFieldset } from './portal';

const STATUS: Record<ShiftReview['status'], { label: string; tone: 'brand' | 'good' | 'neutral' }> = {
  open: { label: 'Ready to confirm', tone: 'brand' },
  unconfirmed: { label: 'Unconfirmed', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'good' },
};

type Field = { key: keyof ReviewEntry; label: string; system: (r: ShiftReview) => number | string | null; time?: boolean };

const FIELDS: Field[] = [
  { key: 'conversations_handled', label: 'Conversations handled', system: (r) => r.system.conversations },
  { key: 'appointments_booked', label: 'Appointments booked', system: (r) => r.system.appointments_booked },
  { key: 'follow_ups_completed', label: 'Follow-ups completed', system: (r) => r.system.follow_ups },
  { key: 'escalations_raised', label: 'Escalations raised', system: (r) => r.system.escalations_raised },
  { key: 'shift_start_actual', label: 'Started', system: (r) => r.captured_start, time: true },
  { key: 'shift_end_actual', label: 'Finished', system: (r) => r.captured_end, time: true },
];

/** My Record: shift reviews. The system drafts each shift; the VA confirms or corrects it. */
export default function ReviewsView({ data, initialDate }: { data: ReviewsData; initialDate: string | null }) {
  const [openDate, setOpenDate] = useState<string | null>(initialDate);
  const selected = data.reviews.find((r) => r.shift_date === openDate) ?? null;
  const waiting = data.reviews.filter((r) => r.status !== 'confirmed');
  const done = data.reviews.filter((r) => r.status === 'confirmed');

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Waiting for you</CardTitle>
        {waiting.length === 0 ? <Empty>Nothing to review. A draft appears here when each shift ends.</Empty> : null}
        <ReviewList reviews={waiting} onOpen={setOpenDate} />
      </Card>
      <Card>
        <CardTitle>Confirmed</CardTitle>
        {done.length === 0 ? <Empty>No confirmed reviews in the last 60 days.</Empty> : null}
        <ReviewList reviews={done} onOpen={setOpenDate} />
      </Card>
      {selected ? (
        <Sheet open onClose={() => setOpenDate(null)} title={`Shift review: ${formatDate(selected.shift_date, true)}`} wide>
          <ReviewForm review={selected} placementId={data.placement_id} zone={data.time_zone} onDone={() => setOpenDate(null)} />
        </Sheet>
      ) : null}
    </div>
  );
}

function ReviewList({ reviews, onOpen }: { reviews: ShiftReview[]; onOpen: (date: string) => void }) {
  const { operatorZone } = usePortal();
  return (
    <ul className="space-y-2">
      {reviews.map((review) => (
        <li key={review.id}>
          <button
            type="button"
            onClick={() => onOpen(review.shift_date)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 text-left text-sm hover:bg-white/[0.06]"
          >
            <span className="min-w-0">
              <span className="block text-neutral-200">{formatDate(review.shift_date)}</span>
              <span className="block truncate text-xs text-neutral-500">
                {review.status === 'open' && review.confirm_by
                  ? `Open until ${formatDateTime(review.confirm_by, operatorZone)}`
                  : review.status === 'unconfirmed'
                    ? 'The recorded numbers stand as your record. You can still confirm or correct it.'
                    : review.report?.variance_explanation
                      ? 'Confirmed with corrections'
                      : 'Confirmed as recorded'}
              </span>
            </span>
            <Badge tone={STATUS[review.status].tone}>{STATUS[review.status].label}</Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReviewForm({
  review,
  placementId,
  zone,
  onDone,
}: {
  review: ShiftReview;
  placementId: string;
  zone: string;
  onDone: () => void;
}) {
  const { readOnly } = usePortal();
  const action = useAction();
  const confirmed = review.status === 'confirmed' && review.report;
  const [correcting, setCorrecting] = useState(!confirmed);
  const initial = Object.fromEntries(
    FIELDS.map((f) => {
      const fromReport = confirmed ? (review.report as Record<string, unknown>)[f.key] : null;
      const value = fromReport ?? f.system(review);
      return [f.key, value === null || value === undefined ? '' : String(value)];
    }),
  ) as Record<string, string>;
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [reason, setReason] = useState('');
  const [blockers, setBlockers] = useState<{ control: BlockerControl; note: string }[]>([]);
  const [wentWell, setWentWell] = useState(review.reflection.went_well ?? '');
  const [differently, setDifferently] = useState(review.reflection.differently ?? '');
  const [inWay, setInWay] = useState(review.reflection.in_way ?? '');

  const changed = FIELDS.filter((f) => {
    const sys = f.system(review);
    return sys !== null && sys !== undefined && values[f.key] !== '' && values[f.key] !== String(sys);
  });
  const missing = FIELDS.filter((f) => !f.time && (f.system(review) === null || f.system(review) === undefined) && values[f.key] === '');
  const needsReason = changed.length > 0 || Boolean(confirmed);

  const submit = () => {
    const entered: ReviewEntry = {};
    for (const f of FIELDS) {
      const raw = values[f.key];
      if (raw === '') continue;
      (entered as Record<string, unknown>)[f.key] = f.time ? raw : Number(raw);
    }
    action.run(
      () =>
        confirmShiftAction({
          placementId,
          shiftDate: review.shift_date,
          entered,
          reason,
          blockers,
          wentWell,
          differently,
          inWay,
        }),
      (result) => result.ok && onDone(),
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-neutral-500">
        Shift {formatDateTime(review.starts_at, zone)} to {formatDateTime(review.ends_at, zone)}
        {review.period_closed ? ' · The pay period is closed, so your manager makes any correction.' : ''}
      </p>

      {!review.system.tracking ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-neutral-300">
          Lead tracking is not connected for this client yet. Bookings and escalations were captured; please enter the rest.
        </p>
      ) : null}
      {review.system.ambiguous > 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs text-neutral-300">
          {review.system.ambiguous} records could not be tied to you for certain, so they were left out and a manager is reviewing
          them. They are never guessed.
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">The numbers</h3>
        <VaFieldset>
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {FIELDS.map((f) => {
              const sys = f.system(review);
              const captured = sys !== null && sys !== undefined;
              const value = values[f.key];
              const differs = captured && value !== '' && value !== String(sys);
              return (
                <li key={f.key} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200">{f.label}</p>
                    <p className="text-[11px] text-neutral-500">
                      {captured
                        ? differs
                          ? `Entered by you · captured ${sys}`
                          : 'Captured'
                        : value === ''
                          ? 'Not captured, please enter'
                          : 'Entered by you'}
                    </p>
                  </div>
                  {correcting ? (
                    <input
                      aria-label={f.label}
                      type={f.time ? 'time' : 'number'}
                      min={0}
                      inputMode={f.time ? undefined : 'numeric'}
                      value={value}
                      onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                      className={`${inputClass} w-28 text-right ${differs ? 'border-brand-500/50' : ''}`}
                    />
                  ) : (
                    <span className="text-base font-semibold tabular-nums text-white">{value || '–'}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </VaFieldset>
        {confirmed && review.report?.variance_explanation ? (
          <p className="mt-2 text-xs text-neutral-400">Your correction: {review.report.variance_explanation}</p>
        ) : null}
      </div>

      {confirmed && !correcting ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-flag-good">Confirmed{review.confirmed_at ? ` ${formatDateTime(review.confirmed_at, zone)}` : ''}.</p>
          {!review.period_closed ? (
            <VaButton type="button" onClick={() => setCorrecting(true)} className={`${btnSecondary} ${btnSizeSm}`}>
              Correct this review
            </VaButton>
          ) : null}
        </div>
      ) : (
        <VaFieldset className="space-y-5">
          {needsReason ? (
            <label className="block">
              <span className={labelClass}>{confirmed ? 'Why are you correcting it?' : 'Why are these numbers different?'}</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className={inputClass}
                placeholder="Two chats happened on WhatsApp, which is not tracked"
              />
              <span className="mt-1 block text-[11px] text-neutral-500">Both the captured and your numbers are kept.</span>
            </label>
          ) : null}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Anything that got in the way?</h3>
            {blockers.map((blocker, i) => (
              <div key={i} className="mb-2 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                <select
                  value={blocker.control}
                  onChange={(e) => setBlockers(blockers.map((b, idx) => (idx === i ? { ...b, control: e.target.value as BlockerControl } : b)))}
                  className={selectClass}
                  aria-label="Who controlled it"
                >
                  {(Object.keys(CONTROL_LABEL) as BlockerControl[]).map((key) => (
                    <option key={key} value={key}>
                      {CONTROL_LABEL[key]}
                    </option>
                  ))}
                </select>
                <input
                  value={blocker.note}
                  onChange={(e) => setBlockers(blockers.map((b, idx) => (idx === i ? { ...b, note: e.target.value } : b)))}
                  className={inputClass}
                  placeholder="Front desk did not answer live transfers"
                  aria-label="What happened"
                />
                <button type="button" onClick={() => setBlockers(blockers.filter((_, idx) => idx !== i))} className="px-2 text-neutral-400">
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setBlockers([...blockers, { control: 'mine', note: '' }])} className={`${btnSecondary} ${btnSizeSm}`}>
              Add a blocker
            </button>
            <p className="mt-1.5 text-[11px] text-neutral-500">Client-side and DA-side blockers go straight to your manager, since you cannot fix them.</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Nightly reflection (optional)</h3>
            <p className="mb-2 mt-1 text-[11px] text-neutral-500">One sentence each. Your manager can see your reflections.</p>
            <div className="space-y-2">
              <input value={wentWell} onChange={(e) => setWentWell(e.target.value)} maxLength={300} className={inputClass} placeholder="What went well today?" aria-label="What went well today?" />
              <input value={differently} onChange={(e) => setDifferently(e.target.value)} maxLength={300} className={inputClass} placeholder="What will I do differently tomorrow?" aria-label="What will I do differently tomorrow?" />
              <input value={inWay} onChange={(e) => setInWay(e.target.value)} maxLength={300} className={inputClass} placeholder="Is anything in my way?" aria-label="Is anything in my way?" />
            </div>
          </div>

          <button
            type="button"
            disabled={readOnly || action.pending || review.period_closed || missing.length > 0 || (needsReason && reason.trim().length < 5)}
            onClick={submit}
            className={`${btnPrimary} ${btnSizeSm} w-full sm:w-auto`}
          >
            {changed.length > 0 || confirmed ? 'Submit with corrections' : 'Confirm as recorded'}
          </button>
          {missing.length > 0 ? <p className="text-xs text-neutral-500">Enter: {missing.map((f) => f.label.toLowerCase()).join(', ')}.</p> : null}
        </VaFieldset>
      )}
      <Feedback message={action.message} error={action.error} />
    </div>
  );
}
