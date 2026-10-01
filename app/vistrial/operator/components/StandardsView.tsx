'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { raiseDisputeAction, standardItemsAction } from '@/lib/portal/actions';
import { formatDate, formatDateTime, formatMonth } from '@/lib/portal/time';
import type { Dispute, StandardItem, StandardItems, StandardRow, StandardsData, StandardStatus } from '@/lib/portal/types';
import { Badge, inputClass, type Tone } from '../../components/ui';
import { Card, CardTitle, Empty, Feedback, Sheet, useAction, usePortal, VaButton } from './portal';

export const STATUS_LABEL: Record<StandardStatus, { label: string; tone: Tone }> = {
  on_track: { label: 'On track', tone: 'good' },
  at_risk: { label: 'At risk', tone: 'brand' },
  below: { label: 'Below', tone: 'neutral' },
  not_measured: { label: 'Not yet measured', tone: 'neutral' },
};

export function formatStandard(value: number | null, unit: string): string {
  if (value === null || value === undefined) return '–';
  if (unit === 'percent') return `${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}%`;
  return `${value} ${unit}`;
}

function targetText(row: { target: number | null; unit: string; direction?: string; key: string }): string {
  if (row.key === 'va_escalation_discipline') return 'Required matters escalated, never improvised';
  if (row.key === 'va_booking_quota') return row.target ? `${row.target} bookings this month (your Placement Order)` : 'The quota in your Placement Order';
  if (row.key === 'va_shift_coverage') return 'Every shift worked or noticed in advance';
  if (row.key === 'va_reviews_confirmed') return 'Every worked shift has a confirmed review';
  if (row.key === 'va_productive_time') return 'The weekly threshold in your Placement Order';
  return row.target === null ? '' : `${formatStandard(row.target, row.unit)} for the month`;
}

/** My Standards: every number, calculated exactly the way DA does. */
export default function StandardsView({ data, month, months }: { data: StandardsData; month: string; months: string[] }) {
  if (data.preview) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">My Standards</h1>
        <p className="text-sm text-neutral-400">
          These are the standards you will be held to once you are placed, from your Sales Operator Agreement. You have no
          personal numbers yet.
        </p>
        {data.definitions.map((d) => (
          <Card key={d.key}>
            <CardTitle aside={d.section ? <span className="text-xs text-neutral-500">Section {d.section}</span> : null}>{d.label}</CardTitle>
            <p className="text-sm text-neutral-200">{targetText({ ...d, direction: undefined })}</p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">{d.how}</p>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">My Standards</h1>
        <div className="flex gap-1">
          {months.map((m) => (
            <Link
              key={m}
              href={`/vistrial/operator/standards?month=${m}`}
              className={`rounded-full px-3 py-1 text-xs ${m === month ? 'bg-white/[0.08] text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {formatMonth(m)}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-sm text-neutral-400">
        Calculated the same way for you, your manager and DA. Anything outside your control is shown and left out.
      </p>
      {data.standards.map((row) => (
        <StandardCard key={row.key} row={row} month={month} trend={data.trend} disputes={data.disputes} />
      ))}
      <DisputeHistory disputes={data.disputes} standards={data.standards} />
    </div>
  );
}

function StandardCard({
  row,
  month,
  trend,
  disputes,
}: {
  row: StandardRow;
  month: string;
  trend: Extract<StandardsData, { preview: false }>['trend'];
  disputes: Dispute[];
}) {
  const [open, setOpen] = useState(false);
  const status = STATUS_LABEL[row.status];
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{row.label}</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            {targetText(row)}
            {row.section ? ` · Section ${row.section}` : ''}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold tabular-nums text-white">{row.measured ? formatStandard(row.value, row.unit) : '–'}</p>
        {row.measured && row.denominator !== null && row.unit === 'percent' ? (
          <p className="pb-1 text-xs text-neutral-500">
            {row.numerator} of {row.denominator}
          </p>
        ) : null}
        {row.measured && row.key === 'va_booking_quota' ? <p className="pb-1 text-xs text-neutral-500">of {row.denominator}</p> : null}
      </div>
      {row.note ? <p className="mt-2 text-xs text-neutral-400">{row.note}</p> : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {trend.map((t) => {
          const past = t.rows?.[row.key];
          return (
            <span key={t.month} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] text-neutral-400">
              {formatMonth(t.month)}: {past && past.value !== null ? formatStandard(past.value, row.unit) : 'not measured'}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-neutral-500">How it is calculated: {row.how}</p>
      {row.key !== 'va_productive_time' || row.measured ? (
        <button type="button" onClick={() => setOpen(true)} className={`${btnSecondary} ${btnSizeSm} mt-3`}>
          See what is counted
        </button>
      ) : null}
      {open ? <ItemsSheet row={row} month={month} disputes={disputes} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function ItemsSheet({ row, month, disputes, onClose }: { row: StandardRow; month: string; disputes: Dispute[]; onClose: () => void }) {
  const [items, setItems] = useState<StandardItems | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<StandardItem | null>(null);

  useEffect(() => {
    let live = true;
    standardItemsAction(row.key, month).then((result) => {
      if (!live) return;
      if (result.ok) setItems(result.data ?? null);
      else setError(result.error);
    });
    return () => {
      live = false;
    };
  }, [row.key, month]);

  const counted = items?.items.filter((i) => i.counted) ?? [];
  const excluded = items?.items.filter((i) => !i.counted) ?? [];
  const disputable = items ? ['lead', 'shift', 'booking'].includes(items.kind) : false;
  const disputeFor = (item: StandardItem) => disputes.find((d) => d.item_id === item.id && d.standard_key === row.key);

  return (
    <Sheet open onClose={onClose} title={row.label} wide>
      {error ? <Feedback error={error} /> : null}
      {!items && !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
      {items ? (
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Counted ({counted.length})</h3>
            {counted.length === 0 ? <Empty>Nothing counted yet this month.</Empty> : null}
            <ItemList items={counted} kind={items.kind} disputable={disputable} disputeFor={disputeFor} onDispute={setDisputing} />
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Left out, and why ({excluded.length})</h3>
            {excluded.length === 0 ? <Empty>Nothing was left out.</Empty> : null}
            <ItemList items={excluded} kind={items.kind} disputable={false} disputeFor={disputeFor} onDispute={setDisputing} />
          </section>
        </div>
      ) : null}
      {disputing ? <DisputeForm row={row} month={month} item={disputing} onClose={() => setDisputing(null)} /> : null}
    </Sheet>
  );
}

function ItemList({
  items,
  kind,
  disputable,
  disputeFor,
  onDispute,
}: {
  items: StandardItem[];
  kind: StandardItems['kind'];
  disputable: boolean;
  disputeFor: (item: StandardItem) => Dispute | undefined;
  onDispute: (item: StandardItem) => void;
}) {
  const { operatorZone } = usePortal();
  return (
    <ul className="space-y-1.5">
      {items.map((item) => {
        const dispute = disputeFor(item);
        return (
          <li key={item.id} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-neutral-200">{describe(item, kind, operatorZone)}</p>
                {item.excluded_reason ? <p className="text-xs text-neutral-500">{item.excluded_reason}</p> : null}
                {dispute ? (
                  <p className="text-xs text-neutral-400">
                    Dispute {dispute.status === 'open' ? 'waiting for your manager' : `${dispute.status}: ${dispute.decision_reason}`}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.counted ? (
                  <Badge tone={item.met ? 'good' : 'neutral'}>{item.met ? 'Met' : 'Missed'}</Badge>
                ) : (
                  <Badge tone="neutral">Left out</Badge>
                )}
                {disputable && !dispute && item.counted && !item.met ? (
                  <VaButton type="button" onClick={() => onDispute(item)} className="text-xs text-brand-200 underline">
                    Dispute
                  </VaButton>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function describe(item: StandardItem, kind: StandardItems['kind'], zone: string): string {
  switch (kind) {
    case 'lead':
      return `${item.label ?? 'Lead'} · in ${item.at ? formatDateTime(item.at, zone) : ''}${
        item.response_minutes !== null && item.response_minutes !== undefined ? ` · first reply after ${item.response_minutes} min` : ' · no reply recorded'
      }`;
    case 'shift':
      return `Shift on ${item.date ? formatDate(item.date) : ''}${item.late_notice ? ' · late notice' : ''}`;
    case 'booking':
      return `${item.label ?? 'Booking'} · ${item.at ? formatDateTime(item.at, zone) : ''}`;
    case 'finding':
      return `${item.date ? formatDate(item.date) : ''}: ${item.label ?? ''}${item.recorded_by ? ` (recorded by ${item.recorded_by})` : ''}`;
    case 'week':
      return `Week of ${item.date ? formatDate(item.date) : ''}: ${item.minutes} minutes${item.threshold ? ` of ${item.threshold}` : ''}`;
    default:
      return item.label ?? '';
  }
}

function DisputeForm({ row, month, item, onClose }: { row: StandardRow; month: string; item: StandardItem; onClose: () => void }) {
  const [text, setText] = useState('');
  const action = useAction();
  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm font-semibold text-white">Dispute this item</p>
      <p className="mt-1 text-xs text-neutral-400">
        Your manager approves it (the item is left out, with their reason) or declines it (with their reason). Either way it stays on
        your record.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className={`${inputClass} mt-3`}
        placeholder="The customer replied on another channel first"
      />
      <div className="mt-3 flex gap-2">
        <VaButton
          type="button"
          disabled={action.pending || text.trim().length < 5}
          onClick={() =>
            action.run(() => raiseDisputeAction({ standardKey: row.key, itemId: item.id, month, explanation: text }), (r) => r.ok && onClose())
          }
          className={`${btnSecondary} ${btnSizeSm}`}
        >
          Send to my manager
        </VaButton>
        <button type="button" onClick={onClose} className="text-xs text-neutral-400">
          Cancel
        </button>
      </div>
      <Feedback message={action.message} error={action.error} />
    </div>
  );
}

function DisputeHistory({ disputes, standards }: { disputes: Dispute[]; standards: StandardRow[] }) {
  if (disputes.length === 0) return null;
  const label = (key: string) => standards.find((s) => s.key === key)?.label ?? key;
  return (
    <Card>
      <CardTitle>Your disputes</CardTitle>
      <ul className="space-y-2">
        {disputes.map((d) => (
          <li key={d.id} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-neutral-200">
                {label(d.standard_key)}: {d.item_label}
              </span>
              <Badge tone={d.status === 'approved' ? 'good' : 'neutral'}>
                {d.status === 'open' ? 'Waiting' : d.status === 'approved' ? 'Approved' : 'Declined'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-500">You said: {d.explanation}</p>
            {d.decision_reason ? (
              <p className="mt-1 text-xs text-neutral-400">
                {d.decided_by}: {d.decision_reason}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
