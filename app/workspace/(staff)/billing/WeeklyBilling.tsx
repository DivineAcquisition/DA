'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Clock, Mail, Receipt, Sparkles } from 'lucide-react';
import {
  MANAGEMENT_FEE,
  STATUS_LABEL,
  dayLabel,
  hoursLabel,
  metricValue,
  money,
  num,
  payFromRate,
  round2,
  shiftWeek,
  startingHours,
  totalHours,
  weekLabel,
  weekTotals,
  weeklyReceipt,
  type WeekData,
  type WeekDay,
} from '@/lib/billing/week';
import { saveWeekChargeAction, sendWeekChargeAction, type WeekChargeInput } from '@/lib/billing/week-actions';
import { DeskHeader, Pill, Section, area, field, primary, secondary, type Tone } from '../components/desk';

const STATUS_TONE: Record<string, Tone> = {
  submitted: 'good',
  late: 'warn',
  missed: 'bad',
  excused: 'neutral',
  draft: 'warn',
  not_started: 'neutral',
  none: 'neutral',
  upcoming: 'neutral',
};

function dayOutputs(day: WeekDay): string {
  const logged = weekTotals([day]).filter((row) => !row.pending && (row.value ?? 0) > 0);
  if (!logged.length) return day.future ? '' : 'Nothing logged';
  return logged
    .slice(0, 3)
    .map((row) => `${metricValue(row)} ${row.label.toLowerCase()}`)
    .join(' · ')
    .concat(logged.length > 3 ? ` · +${logged.length - 3} more` : '');
}

function text(value: number | null): string {
  return value == null ? '' : String(value);
}

export default function WeeklyBilling({ data }: { data: WeekData }) {
  const router = useRouter();
  const placement = data.placement!;
  const charge = data.charge;

  const [hours, setHours] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.days.map((day) => [day.date, String(startingHours(day, placement.shift_hours, charge))])),
  );
  const startRate = charge ? (charge.hourly_rate == null ? null : Number(charge.hourly_rate)) : data.last_rate == null ? null : Number(data.last_rate);
  const [rate, setRate] = useState(text(startRate));
  const startHours = totalHours(Object.fromEntries(Object.entries(hours).map(([key, value]) => [key, num(value) ?? 0])));
  const [pay, setPay] = useState(() => (charge ? String(Number(charge.operator_pay)) : text(payFromRate(startHours, startRate))));
  const [payTouched, setPayTouched] = useState(() => (charge ? payFromRate(Number(charge.hours_total), startRate) !== Number(charge.operator_pay) : false));
  const [fee, setFee] = useState(() => String(charge ? Number(charge.management_fee) : MANAGEMENT_FEE));
  const [note, setNote] = useState(charge?.note ?? '');
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const hourValues = useMemo(() => Object.fromEntries(Object.entries(hours).map(([key, value]) => [key, num(value) ?? 0])), [hours]);
  const hoursTotal = totalHours(hourValues);
  const rateValue = num(rate);
  const computedPay = payFromRate(hoursTotal, rateValue);
  const payValue = payTouched ? (num(pay) ?? 0) : (computedPay ?? num(pay) ?? 0);
  const feeValue = num(fee) ?? 0;
  const total = round2(payValue + feeValue);
  const totals = useMemo(() => weekTotals(data.days), [data.days]);

  const entry = { hours: hourValues, hourlyRate: rateValue, operatorPay: payValue, managementFee: feeValue, note };
  const receipt = useMemo(() => weeklyReceipt(data, entry), [data, hourValues, rateValue, payValue, feeValue, note]); // eslint-disable-line react-hooks/exhaustive-deps

  const input = (): WeekChargeInput => ({
    placementId: placement.id,
    week: data.week_start,
    hours: hourValues,
    hourlyRate: rateValue,
    operatorPay: payValue,
    managementFee: feeValue,
    note,
  });

  const touch = () => {
    setDirty(true);
    setMessage(null);
  };

  const go = (seat: string, week: string) => router.push(`/workspace/billing?seat=${seat}&week=${week}`);

  const onSave = () =>
    start(async () => {
      const result = await saveWeekChargeAction(input());
      setMessage(result.ok ? { tone: 'good', text: result.message } : { tone: 'bad', text: result.error });
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });

  const to = data.recipients.to;
  const cc = data.recipients.cc;
  const onSend = () => {
    if (!to.length) return;
    const ok = window.confirm(`Email the receipt for ${weekLabel(data.week_start, data.week_end)} to ${to.join(', ')}? The total is ${money(total)}.`);
    if (!ok) return;
    start(async () => {
      const result = await sendWeekChargeAction(input());
      setMessage(result.ok ? { tone: 'good', text: result.message } : { tone: 'bad', text: result.error });
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  };

  const status = dirty ? 'unsaved' : (charge?.status ?? 'new');
  const statusPill =
    status === 'sent' ? (
      <Pill tone="good">Sent {charge?.sent_at ? new Date(charge.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</Pill>
    ) : status === 'draft' ? (
      <Pill tone="warn">Saved, not sent</Pill>
    ) : status === 'unsaved' ? (
      <Pill tone="brand">Unsaved changes</Pill>
    ) : (
      <Pill>Not started</Pill>
    );

  const isThisWeek = data.today >= data.week_start && data.today <= data.week_end;

  return (
    <div>
      <DeskHeader
        crumb="Billing"
        title="Weekly billing"
        description="Enter the week's hours and pay. The client gets a receipt with the hours, what got done from the end-of-day reports, and the management fee."
        actions={statusPill}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          aria-label="Seat"
          className={`${field} min-w-[240px]`}
          value={placement.id}
          onChange={(event) => go(event.target.value, data.week_start)}
        >
          {data.placements.map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.operator_name} · {seat.client_name}
              {seat.status !== 'active' ? ` (${seat.status})` : ''}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <Link aria-label="Previous week" href={`/workspace/billing?seat=${placement.id}&week=${shiftWeek(data.week_start, -1)}`} className={secondary}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <span className="min-w-[150px] px-2 text-center text-sm tabular-nums text-white">{weekLabel(data.week_start, data.week_end)}</span>
          <Link aria-label="Next week" href={`/workspace/billing?seat=${placement.id}&week=${shiftWeek(data.week_start, 1)}`} className={secondary}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
        {!isThisWeek ? (
          <Link href={`/workspace/billing?seat=${placement.id}`} className="text-sm text-brand-200 hover:text-white">
            This week
          </Link>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="space-y-5">
          <Section
            title="Hours"
            icon={Clock}
            hint={
              placement.shift_hours != null
                ? `A reported day starts at the shift length, ${hoursLabel(placement.shift_hours)} (${placement.shift_start}–${placement.shift_end}). Change any day.`
                : 'Enter the hours for each day.'
            }
            aside={<span className="text-sm tabular-nums text-white">{hoursLabel(hoursTotal)}</span>}
          >
            {data.days.length === 0 ? (
              <p className="text-sm text-neutral-400">No working days this week.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.days.map((day) => (
                  <li key={day.date} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="w-28 shrink-0">
                      <p className="text-sm text-white">{dayLabel(day.date)}</p>
                      <div className="mt-1">
                        <Pill tone={STATUS_TONE[day.status] ?? 'neutral'}>{STATUS_LABEL[day.status] ?? day.status}</Pill>
                      </div>
                    </div>
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-neutral-400">{dayOutputs(day)}</p>
                    <label className="flex items-center gap-2 text-[13px] text-neutral-500">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={24}
                        step={0.25}
                        aria-label={`Hours on ${dayLabel(day.date)}`}
                        className={`${field} w-20 text-right tabular-nums`}
                        value={hours[day.date] ?? ''}
                        onChange={(event) => {
                          setHours((current) => ({ ...current, [day.date]: event.target.value }));
                          touch();
                        }}
                      />
                      hrs
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Pay and fee" icon={Receipt} hint="The client is charged the operator's pay plus the management fee.">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-[13px] text-neutral-400">
                Hourly rate
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-neutral-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    placeholder="Optional"
                    className={`${field} w-full pl-6 tabular-nums`}
                    value={rate}
                    onChange={(event) => {
                      setRate(event.target.value);
                      touch();
                    }}
                  />
                </div>
              </label>
              <label className="block text-[13px] text-neutral-400">
                Operator pay for the week
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-neutral-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    className={`${field} w-full pl-6 tabular-nums`}
                    value={payTouched || computedPay == null ? pay : String(computedPay)}
                    onChange={(event) => {
                      setPay(event.target.value);
                      setPayTouched(true);
                      touch();
                    }}
                  />
                </div>
                {payTouched && computedPay != null && computedPay !== payValue ? (
                  <button
                    type="button"
                    className="mt-1 text-[12px] text-brand-200 hover:text-white"
                    onClick={() => {
                      setPayTouched(false);
                      touch();
                    }}
                  >
                    Use {hoursLabel(hoursTotal)} × {money(rateValue ?? 0)} = {money(computedPay)}
                  </button>
                ) : rateValue != null ? (
                  <span className="mt-1 block text-[12px] text-neutral-500">
                    {hoursLabel(hoursTotal)} × {money(rateValue)}
                  </span>
                ) : null}
              </label>
              <label className="block text-[13px] text-neutral-400">
                Management fee
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-neutral-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    className={`${field} w-full pl-6 tabular-nums`}
                    value={fee}
                    onChange={(event) => {
                      setFee(event.target.value);
                      touch();
                    }}
                  />
                </div>
              </label>
            </div>
            <label className="mt-4 block text-[13px] text-neutral-400">
              Note to the client <span className="text-neutral-600">(optional, shown at the top)</span>
              <textarea
                className={`${area} mt-1.5 w-full`}
                maxLength={2000}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  touch();
                }}
              />
            </label>
            <dl className="mt-5 space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.015] px-4 py-3 text-sm">
              <div className="flex justify-between text-neutral-300">
                <dt>Operator pay</dt>
                <dd className="tabular-nums">{money(payValue)}</dd>
              </div>
              <div className="flex justify-between text-neutral-300">
                <dt>Management fee</dt>
                <dd className="tabular-nums">{money(feeValue)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/[0.08] pt-2 text-base font-medium text-white">
                <dt>Client is charged</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Outputs this week" icon={Sparkles} hint="Summed from the end-of-day reports. Only numbers above zero go on the receipt.">
            {totals.length === 0 ? (
              <p className="text-sm text-neutral-400">Nothing logged yet this week.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {totals.map((row) => (
                  <div key={`${row.group}:${row.label}`} className="rounded-xl border border-white/[0.08] px-3 py-2.5">
                    <p className="truncate text-[11px] uppercase tracking-[0.08em] text-neutral-500" title={`${row.group} · ${row.label}`}>
                      {row.label}
                    </p>
                    <p className={`mt-1 text-base tabular-nums ${row.pending ? 'text-neutral-500' : 'text-white'}`}>
                      {row.pending ? 'Pending sync' : metricValue(row)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Section title="Receipt" icon={Mail} hint="This is the email the client gets.">
            <dl className="mb-3 space-y-1 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-8 shrink-0 text-neutral-500">To</dt>
                <dd className="min-w-0 break-words text-white">{to.length ? to.join(', ') : <span className="text-flag-critical">No client email on file</span>}</dd>
              </div>
              {cc.length ? (
                <div className="flex gap-2">
                  <dt className="w-8 shrink-0 text-neutral-500">CC</dt>
                  <dd className="min-w-0 break-words text-neutral-300">{cc.join(', ')}</dd>
                </div>
              ) : null}
            </dl>
            <iframe
              title="Receipt preview"
              sandbox=""
              srcDoc={receipt.html}
              className="h-[640px] w-full rounded-xl border border-white/[0.08] bg-[#07070b]"
            />
            {message ? (
              <p role="status" className={`mt-3 text-sm ${message.tone === 'good' ? 'text-flag-good' : 'text-flag-critical'}`}>
                {message.text}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={pending} onClick={onSave}>
                Save
              </button>
              <button type="button" className={primary} disabled={pending || !to.length || total <= 0 || status === 'sent'} onClick={onSend}>
                <Mail className="size-4" aria-hidden />
                {status === 'sent' ? 'Sent' : charge?.sent_at ? 'Send the update' : 'Send to client'}
              </button>
            </div>
            {charge?.status === 'sent' && charge.sent_to.length ? (
              <p className="mt-2 text-[12px] text-neutral-500">
                Last sent to {charge.sent_to.join(', ')}
                {charge.send_count > 1 ? ` · ${charge.send_count} sends` : ''}.
              </p>
            ) : null}
          </Section>
        </div>
      </div>
    </div>
  );
}
