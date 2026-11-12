'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Clock, CreditCard, History, Mail, Receipt, Sparkles, UserRound } from 'lucide-react';
import {
  MANAGEMENT_FEE,
  STATUS_LABEL,
  clientTotal,
  dayLabel,
  hoursLabel,
  metricValue,
  money,
  num,
  operatorEarnings,
  operatorStatement,
  payFromRate,
  round2,
  shiftPay,
  shiftWeek,
  startingHours,
  totalHours,
  weekEnd,
  weekLabel,
  weekTotals,
  weeklyReceipt,
  type WeekData,
  type WeekDay,
} from '@/lib/billing/week';
import {
  chargeAndSendClientAction,
  saveWeekChargeAction,
  sendOperatorStatementAction,
  type WeekChargeInput,
  type WeekChargeResult,
} from '@/lib/billing/week-actions';
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

function shortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MoneyInput({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: React.ReactNode;
}) {
  return (
    <label className="block text-[13px] text-neutral-400">
      {label}
      <div className="relative mt-1.5">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-neutral-500">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          placeholder={placeholder}
          disabled={disabled}
          className={`${field} w-full pl-6 tabular-nums disabled:opacity-60`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {hint}
    </label>
  );
}

export default function WeeklyBilling({ data }: { data: WeekData }) {
  const router = useRouter();
  const placement = data.placement!;
  const charge = data.charge;
  const locked = Boolean(charge?.charged_at);

  const [hours, setHours] = useState<Record<string, string>>(() =>
    Object.fromEntries(data.days.map((day) => [day.date, String(startingHours(day, placement.shift_hours, charge))])),
  );
  const startRate = charge ? (charge.hourly_rate == null ? null : Number(charge.hourly_rate)) : data.last_rate == null ? null : Number(data.last_rate);
  const [rate, setRate] = useState(text(startRate));
  const startHours = totalHours(Object.fromEntries(Object.entries(hours).map(([key, value]) => [key, num(value) ?? 0])));
  const [pay, setPay] = useState(() => (charge ? String(Number(charge.operator_pay)) : text(payFromRate(startHours, startRate))));
  const [payTouched, setPayTouched] = useState(() => (charge ? payFromRate(Number(charge.hours_total), startRate) !== Number(charge.operator_pay) : false));
  const [commission, setCommission] = useState(() => String(charge ? Number(charge.commission ?? 0) : 0));
  const [fee, setFee] = useState(() => String(charge ? Number(charge.management_fee) : MANAGEMENT_FEE));
  const [note, setNote] = useState(charge?.note ?? '');
  const [perShift, setPerShift] = useState(placement.shift_hours != null ? String(placement.shift_hours) : '');
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<'client' | 'operator'>('client');

  const hourValues = Object.fromEntries(Object.entries(hours).map(([key, value]) => [key, num(value) ?? 0]));
  const hoursTotal = totalHours(hourValues);
  const rateValue = num(rate);
  const computedPay = payFromRate(hoursTotal, rateValue);
  const payValue = payTouched ? (num(pay) ?? 0) : (computedPay ?? num(pay) ?? 0);
  const commissionValue = num(commission) ?? 0;
  const feeValue = num(fee) ?? 0;
  const entry = { hours: hourValues, hourlyRate: rateValue, operatorPay: payValue, commission: commissionValue, managementFee: feeValue, note };
  const total = clientTotal(entry);
  const earned = operatorEarnings(entry);
  const pays = shiftPay(hourValues, payValue);
  const totals = weekTotals(data.days);
  const chargedInfo = charge?.charged_at
    ? { amount: Number(charge.charged_amount ?? total), at: charge.charged_at, invoiceUrl: charge.stripe_invoice_url }
    : null;
  const receipt = preview === 'client' ? weeklyReceipt(data, entry, chargedInfo) : operatorStatement(data, entry);

  const input = (): WeekChargeInput => ({
    placementId: placement.id,
    week: data.week_start,
    hours: hourValues,
    hourlyRate: rateValue,
    operatorPay: payValue,
    commission: commissionValue,
    managementFee: feeValue,
    note,
  });

  const touch = () => {
    setDirty(true);
    setMessage(null);
  };

  const run = (action: (input: WeekChargeInput) => Promise<WeekChargeResult>) =>
    start(async () => {
      const result = await action(input());
      setMessage(result.ok ? { tone: 'good', text: result.message } : { tone: 'bad', text: result.error });
      if (result.ok) setDirty(false);
      router.refresh();
    });

  const to = data.recipients.to;
  const operatorEmail = placement.operator_email;
  const onCharge = () => {
    if (!to.length) return;
    const question = locked
      ? `Send the receipt again to ${to.join(', ')}? The card was already charged ${money(chargedInfo?.amount ?? total)} and will not be charged again.`
      : `Charge ${money(total)} to ${placement.client_name}'s card on file, then email the receipt to ${to.join(', ')}?\n\nPay ${money(payValue)} + commission ${money(commissionValue)} + management fee ${money(feeValue)}.`;
    if (window.confirm(question)) run(chargeAndSendClientAction);
  };
  const onOperator = () => {
    if (!operatorEmail) return;
    if (window.confirm(`Email ${placement.operator_name} their pay for ${weekLabel(data.week_start, data.week_end)} (${money(earned)}) at ${operatorEmail}?`)) {
      run(sendOperatorStatementAction);
    }
  };

  const fillShifts = () => {
    const value = num(perShift);
    if (value == null || value < 0 || value > 24) return;
    setHours(Object.fromEntries(data.days.map((day) => [day.date, day.working ? String(value) : (hours[day.date] ?? '0')])));
    touch();
  };

  const clientPill = chargedInfo ? (
    <Pill tone="good">Charged {money(chargedInfo.amount)} {shortDate(chargedInfo.at)}</Pill>
  ) : charge?.charge_error ? (
    <Pill tone="bad">Charge failed</Pill>
  ) : dirty ? (
    <Pill tone="brand">Unsaved changes</Pill>
  ) : charge ? (
    <Pill tone="warn">Saved, not charged</Pill>
  ) : (
    <Pill>Not started</Pill>
  );

  const isThisWeek = data.today >= data.week_start && data.today <= data.week_end;

  return (
    <div>
      <DeskHeader
        crumb="Billing"
        title="Weekly billing"
        description="Log the week's hours and pay. The client's card is charged pay + commission + the management fee and they get a receipt. The operator gets their own statement with their pay and commission only."
        actions={clientPill}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select aria-label="Seat" className={`${field} min-w-[240px]`} value={placement.id} onChange={(event) => router.push(`/workspace/billing?seat=${event.target.value}&week=${data.week_start}`)}>
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

      {locked ? (
        <p className="panel mb-5 rounded-2xl px-5 py-3 text-sm text-neutral-300">
          This week was charged {money(chargedInfo!.amount)} on {shortDate(chargedInfo!.at)}. Hours and money are locked; refund or adjust it in Stripe.
          {charge?.stripe_invoice_url ? (
            <>
              {' '}
              <a href={charge.stripe_invoice_url} target="_blank" rel="noopener noreferrer" className="text-brand-200 hover:text-white">
                Open the Stripe invoice
              </a>
            </>
          ) : null}
        </p>
      ) : charge?.charge_error ? (
        <p className="panel mb-5 rounded-2xl px-5 py-3 text-sm text-flag-critical">Last charge attempt failed: {charge.charge_error}</p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="space-y-5">
          <Section
            title="Hours and pay by shift"
            icon={Clock}
            hint="Log each shift's hours. The week's pay is split across shifts by hours."
            aside={<span className="text-sm tabular-nums text-white">{hoursLabel(hoursTotal)}</span>}
          >
            {!locked ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-neutral-400">
                Set every working day to
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.25}
                  aria-label="Hours per shift"
                  className={`${field} w-20 text-right tabular-nums`}
                  value={perShift}
                  onChange={(event) => setPerShift(event.target.value)}
                />
                hrs
                <button type="button" className={secondary} onClick={fillShifts}>
                  Apply
                </button>
              </div>
            ) : null}
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
                        disabled={locked}
                        aria-label={`Hours on ${dayLabel(day.date)}`}
                        className={`${field} w-20 text-right tabular-nums disabled:opacity-60`}
                        value={hours[day.date] ?? ''}
                        onChange={(event) => {
                          setHours((current) => ({ ...current, [day.date]: event.target.value }));
                          touch();
                        }}
                      />
                      hrs
                    </label>
                    <span className="w-20 text-right text-sm tabular-nums text-white">{money(pays[day.date] ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Pay, commission and fee" icon={Receipt} hint="Enter the week's pay, or an hourly rate to work it out.">
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput
                label="Hourly rate"
                placeholder="Optional"
                value={rate}
                disabled={locked}
                onChange={(value) => {
                  setRate(value);
                  touch();
                }}
              />
              <MoneyInput
                label="Operator pay for the week"
                value={payTouched || computedPay == null ? pay : String(computedPay)}
                disabled={locked}
                onChange={(value) => {
                  setPay(value);
                  setPayTouched(true);
                  touch();
                }}
                hint={
                  !locked && payTouched && computedPay != null && computedPay !== payValue ? (
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
                  ) : hoursTotal > 0 ? (
                    <span className="mt-1 block text-[12px] text-neutral-500">{money(round2(payValue / hoursTotal))} per hour</span>
                  ) : null
                }
              />
              <MoneyInput
                label="Commission earnings"
                value={commission}
                disabled={locked}
                onChange={(value) => {
                  setCommission(value);
                  touch();
                }}
                hint={<span className="mt-1 block text-[12px] text-neutral-500">The operator earns it; the client pays it.</span>}
              />
              <MoneyInput
                label="Management fee"
                value={fee}
                disabled={locked}
                onChange={(value) => {
                  setFee(value);
                  touch();
                }}
                hint={<span className="mt-1 block text-[12px] text-neutral-500">On the client receipt only.</span>}
              />
            </div>
            <label className="mt-4 block text-[13px] text-neutral-400">
              Note to the client <span className="text-neutral-600">(optional, shown at the top of their receipt)</span>
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
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <dl className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.015] px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">Client is charged</p>
                <div className="flex justify-between text-neutral-300">
                  <dt>Operator pay</dt>
                  <dd className="tabular-nums">{money(payValue)}</dd>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <dt>Commission</dt>
                  <dd className="tabular-nums">{money(commissionValue)}</dd>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <dt>Management fee</dt>
                  <dd className="tabular-nums">{money(feeValue)}</dd>
                </div>
                <div className="flex justify-between border-t border-white/[0.08] pt-2 text-base font-medium text-white">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(total)}</dd>
                </div>
              </dl>
              <dl className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.015] px-4 py-3 text-sm">
                <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">Operator is paid</p>
                <div className="flex justify-between text-neutral-300">
                  <dt>Pay ({hoursLabel(hoursTotal)})</dt>
                  <dd className="tabular-nums">{money(payValue)}</dd>
                </div>
                <div className="flex justify-between text-neutral-300">
                  <dt>Commission</dt>
                  <dd className="tabular-nums">{money(commissionValue)}</dd>
                </div>
                <div className="flex justify-between border-t border-white/[0.08] pt-2 text-base font-medium text-white">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{money(earned)}</dd>
                </div>
              </dl>
            </div>
          </Section>

          <Section title="Outputs this week" icon={Sparkles} hint="Summed from the end-of-day reports. Only numbers above zero go on the client receipt.">
            {totals.length === 0 ? (
              <p className="text-sm text-neutral-400">Nothing logged this week.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {totals.map((row) => (
                  <div key={`${row.group}:${row.label}`} className="rounded-xl border border-white/[0.08] px-3 py-2.5">
                    <p className="truncate text-[11px] uppercase tracking-[0.08em] text-neutral-500" title={`${row.group} · ${row.label}`}>
                      {row.label}
                    </p>
                    <p className={`mt-1 text-base tabular-nums ${row.pending ? 'text-neutral-500' : 'text-white'}`}>{row.pending ? 'Pending sync' : metricValue(row)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Hours log" icon={History} hint="Every week saved for this seat.">
            {data.history.length === 0 ? (
              <p className="text-sm text-neutral-400">No weeks saved yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 font-medium">Week</th>
                      <th className="pb-2 text-right font-medium">Hours</th>
                      <th className="pb-2 text-right font-medium">Pay</th>
                      <th className="pb-2 text-right font-medium">Commission</th>
                      <th className="pb-2 text-right font-medium">Client total</th>
                      <th className="pb-2 pl-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.history.map((week) => (
                      <tr key={week.week_start} className={week.week_start === data.week_start ? 'text-white' : 'text-neutral-300'}>
                        <td className="py-2">
                          <Link href={`/workspace/billing?seat=${placement.id}&week=${week.week_start}`} className="hover:text-white">
                            {weekLabel(week.week_start, weekEnd(week.week_start))}
                          </Link>
                        </td>
                        <td className="py-2 text-right tabular-nums">{Number(week.hours_total)}</td>
                        <td className="py-2 text-right tabular-nums">{money(Number(week.operator_pay))}</td>
                        <td className="py-2 text-right tabular-nums">{money(Number(week.commission))}</td>
                        <td className="py-2 text-right tabular-nums">{money(Number(week.total))}</td>
                        <td className="py-2 pl-4">
                          {week.charged_at ? <Pill tone="good">Charged</Pill> : <Pill tone="warn">Not charged</Pill>}{' '}
                          {week.operator_sent_at ? <Pill tone="good">Operator paid</Pill> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Section title="Emails" icon={Mail} hint="Preview exactly what each person gets.">
            <div role="tablist" className="mb-3 flex gap-1 text-sm">
              {(
                [
                  ['client', 'Client receipt'],
                  ['operator', 'Operator pay'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={preview === value}
                  onClick={() => setPreview(value)}
                  className={`rounded-lg px-3 py-1.5 ${preview === value ? 'bg-brand-500/20 text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-3 text-[13px] text-neutral-400">
              {preview === 'client' ? (
                <>
                  To <span className="text-white">{to.length ? to.join(', ') : 'no client email on file'}</span>
                  {' · '}CC {[...data.recipients.cc, 'you'].join(', ')}
                </>
              ) : (
                <>
                  To <span className="text-white">{operatorEmail ?? 'no operator email on file'}</span> · CC you · no management fee, no client total
                </>
              )}
            </p>
            <iframe title="Email preview" sandbox="" srcDoc={receipt.html} className="h-[600px] w-full rounded-xl border border-white/[0.08] bg-[#07070b]" />
            {message ? (
              <p role="status" className={`mt-3 text-sm ${message.tone === 'good' ? 'text-flag-good' : 'text-flag-critical'}`}>
                {message.text}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondary} disabled={pending || locked} onClick={() => run(saveWeekChargeAction)}>
                Save
              </button>
              <button
                type="button"
                className={primary}
                disabled={pending || !to.length || total <= 0 || (!locked && !placement.stripe_linked)}
                onClick={onCharge}
              >
                <CreditCard className="size-4" aria-hidden />
                {locked ? 'Resend receipt' : `Charge ${money(total)} & email client`}
              </button>
              <button type="button" className={secondary} disabled={pending || !operatorEmail || earned <= 0} onClick={onOperator}>
                <UserRound className="size-4" aria-hidden />
                {charge?.operator_sent_at && !dirty ? 'Resend operator pay' : 'Email operator their pay'}
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-[12px] text-neutral-500">
              {!placement.stripe_linked ? (
                <li className="text-flag-critical">
                  This client is not linked to a Stripe customer, so the card cannot be charged.{' '}
                  <Link href="/workspace/team/stripe" className="text-brand-200 underline-offset-2 hover:underline">
                    Link it under Account, Stripe
                  </Link>
                  .
                </li>
              ) : null}
              {charge?.sent_at ? <li>Receipt last sent {shortDate(charge.sent_at)} to {charge.sent_to.join(', ')}.</li> : null}
              {charge?.operator_sent_at ? <li>Operator pay sent {shortDate(charge.operator_sent_at)} to {charge.operator_sent_to}.</li> : null}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
