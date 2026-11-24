/**
 * Weekly billing: the operator's pay for a week plus DA's management fee,
 * sent to the client as a receipt built from that week's end-of-day reports.
 * Pure functions, so the desk can preview the exact email it will send.
 */
import { EMAIL_BRAND, FONT_BODY, FONT_HEAD, escapeHtml, renderEmailHtml } from '@/lib/email/layout';

export const MANAGEMENT_FEE = 100;

export type WeekNumber = {
  group: string;
  label: string;
  unit: string;
  display: 'number' | 'pending_sync';
  value: number | null;
};

export type WeekDay = {
  date: string;
  working: boolean;
  future: boolean;
  eod_id: string | null;
  status: string;
  hours_worked: number | null;
  hours_start: string | null;
  hours_end: string | null;
  break_minutes: number | null;
  wins: string;
  blockers: string;
  needs_help: boolean;
  was_late: boolean;
  numbers: WeekNumber[];
};

export type WeekCharge = {
  id: string;
  days: Array<{ date: string; hours: number }>;
  hours_total: number;
  hourly_rate: number | null;
  operator_pay: number;
  commission: number;
  management_fee: number;
  total: number;
  note: string | null;
  status: 'draft' | 'sent';
  sent_at: string | null;
  sent_to: string[];
  send_count: number;
  updated_at: string;
  stripe_invoice_id: string | null;
  stripe_status: string | null;
  stripe_invoice_url: string | null;
  charged_amount: number | null;
  charged_at: string | null;
  charge_error: string | null;
  operator_sent_at: string | null;
  operator_sent_to: string | null;
  operator_send_count: number;
};

export type WeekHistory = {
  week_start: string;
  /** 7 for the weekly periods before 9 Nov 2026, 14 for the 2-week pay periods. */
  period_days: number;
  hours_total: number;
  operator_pay: number;
  commission: number;
  management_fee: number;
  total: number;
  status: 'draft' | 'sent';
  charged_at: string | null;
  stripe_status: string | null;
  operator_sent_at: string | null;
};

export type WeekPlacement = {
  id: string;
  operator_name: string;
  operator_email: string | null;
  stripe_linked: boolean;
  client_name: string;
  time_zone: string;
  shift_start: string;
  shift_end: string;
  shift_hours: number | null;
  working_days: number[];
};

export type WeekData = {
  placements: Array<{ id: string; operator_name: string; client_name: string; status: string }>;
  placement: WeekPlacement | null;
  /** The pay period: its first Monday, its last day, and its length in days. */
  week_start: string;
  week_end: string;
  period_days: number;
  /** First Monday of the period before and after this one. */
  prev_start: string;
  next_start: string;
  today: string;
  days: WeekDay[];
  recipients: { to: string[]; cc: string[] };
  last_rate: number | null;
  charge: WeekCharge | null;
  history: WeekHistory[];
};

/** What DA Admin enters on the desk. */
export type WeekEntry = {
  hours: Record<string, number>;
  hourlyRate: number | null;
  operatorPay: number;
  commission: number;
  managementFee: number;
  note: string;
};

/** What the client is charged: pay + commission + the management fee. */
export function clientTotal(entry: Pick<WeekEntry, 'operatorPay' | 'commission' | 'managementFee'>): number {
  return round2(entry.operatorPay + entry.commission + entry.managementFee);
}

/** What the operator earns: pay + commission. Never includes the management fee. */
export function operatorEarnings(entry: Pick<WeekEntry, 'operatorPay' | 'commission'>): number {
  return round2(entry.operatorPay + entry.commission);
}

/**
 * The week's pay split across shifts by hours, to the cent. Remainders go to
 * the shifts with the largest fractions, so the shifts always add up to the
 * week's pay exactly.
 */
export function shiftPay(hours: Record<string, number>, pay: number): Record<string, number> {
  const dates = Object.keys(hours).sort();
  const total = dates.reduce((sum, date) => sum + Math.max(0, Number(hours[date]) || 0), 0);
  const cents = Math.round(round2(pay) * 100);
  const out: Record<string, number> = Object.fromEntries(dates.map((date) => [date, 0]));
  if (total <= 0 || cents <= 0) return out;
  const shares = dates.map((date) => {
    const exact = (cents * Math.max(0, Number(hours[date]) || 0)) / total;
    return { date, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let left = cents - shares.reduce((sum, item) => sum + item.floor, 0);
  for (const item of [...shares].sort((a, b) => b.frac - a.frac || a.date.localeCompare(b.date))) {
    if (left <= 0) break;
    if (item.frac > 0) {
      item.floor += 1;
      left -= 1;
    }
  }
  for (const item of shares) out[item.date] = item.floor / 100;
  return out;
}

export type WeekTotal = { group: string; label: string; unit: string; value: number | null; pending: boolean };

const WORKED = new Set(['submitted', 'late']);

export const STATUS_LABEL: Record<string, string> = {
  not_started: 'No report',
  draft: 'Draft',
  submitted: 'Submitted',
  late: 'Submitted late',
  missed: 'Missed',
  excused: 'Excused',
  none: 'No report',
  upcoming: 'Upcoming',
};

export function round2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Hours to start from: what was saved, else the EOD's hours, else the shift on a reported day. */
export function startingHours(day: WeekDay, shiftHours: number | null, saved?: WeekCharge | null): number {
  const kept = saved?.days.find((item) => item.date === day.date);
  if (kept) return num(kept.hours) ?? 0;
  const reported = num(day.hours_worked);
  if (reported != null) return reported;
  if (WORKED.has(day.status) && shiftHours != null) return shiftHours;
  return 0;
}

export function totalHours(hours: Record<string, number>): number {
  return round2(Object.values(hours).reduce((sum, value) => sum + (num(value) ?? 0), 0));
}

export function payFromRate(hours: number, rate: number | null): number | null {
  return rate == null ? null : round2(hours * rate);
}

/** The week's outputs, summed per metric across the days. GHL numbers that never synced stay pending. */
export function weekTotals(days: WeekDay[]): WeekTotal[] {
  const order: string[] = [];
  const map = new Map<string, WeekTotal>();
  for (const day of days) {
    for (const metric of day.numbers ?? []) {
      const key = `${metric.group}\u0000${metric.label}`;
      let row = map.get(key);
      if (!row) {
        row = { group: metric.group, label: metric.label, unit: metric.unit, value: null, pending: true };
        map.set(key, row);
        order.push(key);
      }
      const value = metric.display === 'number' ? num(metric.value) : null;
      if (value != null) {
        row.value = round2((row.value ?? 0) + value);
        row.pending = false;
      }
    }
  }
  return order.map((key) => map.get(key)!);
}

/** The outputs worth showing a client: logged and above zero. */
export function receiptOutputs(days: WeekDay[]): WeekTotal[] {
  return weekTotals(days).filter((row) => !row.pending && (row.value ?? 0) > 0);
}

export function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(round2(value));
}

export function hoursLabel(value: number): string {
  const rounded = round2(value);
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')} ${rounded === 1 ? 'hr' : 'hrs'}`;
}

export function metricValue(row: Pick<WeekTotal, 'unit' | 'value'>): string {
  const value = row.value ?? 0;
  if (row.unit === 'minutes') return value >= 60 ? `${round2(value / 60)} hrs` : `${value} min`;
  if (row.unit === 'seconds') return value >= 60 ? `${round2(value / 60)} min` : `${value} sec`;
  if (row.unit === 'percent') return `${value}%`;
  if (row.unit === 'currency') return money(value);
  return new Intl.NumberFormat('en-US').format(value);
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function dayLabel(iso: string, style: 'short' | 'long' = 'short'): string {
  return parseDay(iso).toLocaleDateString('en-US', {
    weekday: style === 'long' ? 'long' : 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function weekLabel(start: string, end: string): string {
  const a = parseDay(start);
  const b = parseDay(end);
  const first = `${MONTHS[a.getUTCMonth()]} ${a.getUTCDate()}`;
  const last = a.getUTCMonth() === b.getUTCMonth() ? `${b.getUTCDate()}` : `${MONTHS[b.getUTCMonth()]} ${b.getUTCDate()}`;
  return `${first} – ${last}, ${b.getUTCFullYear()}`;
}

/** The last day of the period that starts on this Monday (a week unless told otherwise). */
export function weekEnd(start: string, periodDays = 7): string {
  const date = parseDay(start);
  date.setUTCDate(date.getUTCDate() + Math.max(1, periodDays) - 1);
  return date.toISOString().slice(0, 10);
}

/** How the period reads in a sentence: "week" or "two weeks". */
export function periodWord(periodDays: number | null | undefined): 'week' | 'two weeks' {
  return (periodDays ?? 7) > 7 ? 'two weeks' : 'week';
}

/** The Monday that starts the week holding this day. */
export function mondayOf(iso: string): string {
  const date = parseDay(iso);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** The days split into calendar weeks, in order, so a 2-week period can show a subtotal per week. */
export function daysByWeek<T extends { date: string }>(days: T[]): Array<{ monday: string; days: T[] }> {
  const out: Array<{ monday: string; days: T[] }> = [];
  for (const day of days) {
    const monday = mondayOf(day.date);
    const last = out[out.length - 1];
    if (last && last.monday === monday) last.days.push(day);
    else out.push({ monday, days: [day] });
  }
  return out;
}

export function shiftWeek(iso: string, weeks: number): string {
  const date = parseDay(iso);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString().slice(0, 10);
}

// Email ----------------------------------------------------------------------

const E = {
  panel: '#0a0910',
  border: '#24222f',
  rule: '#1d1b27',
  heading: '#ffffff',
  body: '#c9c8d3',
  muted: '#8a8898',
  accent: EMAIL_BRAND.accent,
  lavender: '#c3b6fe',
} as const;

function label(text: string): string {
  return `<p style="margin:0 0 10px;font-family:${FONT_HEAD};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${E.muted};">${escapeHtml(text)}</p>`;
}

function panel(inner: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${E.panel};border:1px solid ${E.border};border-radius:14px;">${inner}</table>`;
}

function row(left: string, right: string, opts: { first?: boolean; strong?: boolean; sub?: string } = {}): string {
  const border = opts.first ? '' : `border-top:1px solid ${E.rule};`;
  const size = opts.strong ? '20px' : '15px';
  const weight = opts.strong ? '700' : '400';
  const font = opts.strong ? FONT_HEAD : FONT_BODY;
  const sub = opts.sub
    ? `<br /><span style="font-family:${FONT_BODY};font-size:13px;color:${E.muted};">${escapeHtml(opts.sub)}</span>`
    : '';
  return `<tr>
<td style="padding:14px 18px;${border}font-family:${font};font-size:${size};font-weight:${weight};line-height:1.45;color:${opts.strong ? E.heading : E.body};">${escapeHtml(left)}${sub}</td>
<td align="right" style="padding:14px 18px;${border}font-family:${font};font-size:${size};font-weight:${weight};line-height:1.45;color:${E.heading};white-space:nowrap;">${escapeHtml(right)}</td>
</tr>`;
}

export type Receipt = { subject: string; preheader: string; html: string; text: string };

/** How the client paid, once the card was charged. */
export type ReceiptCharge = { amount: number; at: string | null; invoiceUrl: string | null } | null;

function space(): string {
  return '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>';
}

function noteHtml(note: string): string {
  return note.trim()
    ? `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${E.body};">${escapeHtml(note.trim()).replace(/\n/g, '<br />')}</p>`
    : '';
}

/** A week's subtotal line inside a 2-week period's shift list. */
function weekRow(left: string, right: string, first: boolean): string {
  const border = first ? '' : `border-top:1px solid ${E.border};`;
  return `<tr>
<td style="padding:12px 18px 10px;${border}font-family:${FONT_HEAD};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${E.lavender};">${escapeHtml(left)}</td>
<td align="right" style="padding:12px 18px 10px;${border}font-family:${FONT_HEAD};font-size:13px;font-weight:700;color:${E.lavender};white-space:nowrap;">${escapeHtml(right)}</td>
</tr>`;
}

/**
 * One row per shift: the day, its EOD status, hours and that shift's pay. A
 * 2-week period is split by week, each with its hours and pay.
 */
function shiftRows(data: WeekData, entry: WeekEntry): { html: string; text: string[] } {
  const pays = shiftPay(entry.hours, entry.operatorPay);
  const days = data.days.filter((day) => (num(entry.hours[day.date]) ?? 0) > 0 || !day.future);
  const weeks = daysByWeek(days);
  const split = weeks.length > 1;
  const html: string[] = [];
  const text: string[] = [];
  for (const [weekIndex, week] of weeks.entries()) {
    const weekHours = round2(week.days.reduce((sum, day) => sum + (num(entry.hours[day.date]) ?? 0), 0));
    const weekPay = round2(week.days.reduce((sum, day) => sum + (pays[day.date] ?? 0), 0));
    if (split) {
      const heading = `Week ${weekIndex + 1}: ${weekLabel(week.monday, weekEnd(week.monday))}`;
      html.push(weekRow(`${heading} · ${hoursLabel(weekHours)}`, money(weekPay), weekIndex === 0));
      text.push(`${weekIndex ? '\n' : ''}${heading}: ${hoursLabel(weekHours)}, ${money(weekPay)}`);
    }
    for (const [index, day] of week.days.entries()) {
      const hours = num(entry.hours[day.date]) ?? 0;
      html.push(
        row(dayLabel(day.date, 'long'), money(pays[day.date] ?? 0), {
          first: !split && weekIndex === 0 && index === 0,
          sub: hours > 0 ? hoursLabel(hours) : `${STATUS_LABEL[day.status] ?? day.status} · 0 hrs`,
        }),
      );
      text.push(`- ${dayLabel(day.date, 'long')}: ${hoursLabel(hours)}, ${money(pays[day.date] ?? 0)}`);
    }
  }
  return { html: html.join('') || row(`No shifts this ${periodWord(data.period_days) === 'week' ? 'week' : 'pay period'}`, money(0), { first: true }), text };
}

/** The client's receipt: pay per shift, commission, the management fee, the total, and the week's work. */
export function weeklyReceipt(data: WeekData, entry: WeekEntry, charged: ReceiptCharge = null): Receipt {
  const placement = data.placement;
  const operator = placement?.operator_name || 'Your operator';
  const client = placement?.client_name || 'your team';
  const week = weekLabel(data.week_start, data.week_end);
  const hours = totalHours(entry.hours);
  const pay = round2(entry.operatorPay);
  const commission = round2(entry.commission);
  const fee = round2(entry.managementFee);
  const total = clientTotal(entry);
  const outputs = receiptOutputs(data.days);
  const shifts = shiftRows(data, entry);
  const span = periodWord(data.period_days);
  const twoWeeks = span === 'two weeks';
  const kind = twoWeeks ? 'Pay period receipt' : 'Weekly receipt';
  const these = twoWeeks ? 'these two weeks' : 'this week';
  const payDetail =
    entry.hourlyRate != null && payFromRate(hours, entry.hourlyRate) === pay
      ? `${hoursLabel(hours)} × ${money(entry.hourlyRate)}/hr`
      : `${hoursLabel(hours)} worked`;

  const subject = `${kind}: ${operator} for ${client}, ${week}`;
  const preheader = charged
    ? `${money(total)} charged for ${week}: ${hoursLabel(hours)} from ${operator} over ${these}.`
    : `${money(total)} for ${week}: ${hoursLabel(hours)} from ${operator} over ${these}.`;

  const charges = panel(
    row(`${operator}, Sales Operator`, money(pay), { first: true, sub: payDetail }) +
      row('Commission earnings', money(commission), { sub: commission > 0 ? `From results ${these}` : `None ${these}` }) +
      row('Divine Acquisition management fee', money(fee), { sub: twoWeeks ? 'Per 2-week pay period' : undefined }) +
      row(charged ? 'Charged to your card on file' : `Total for ${twoWeeks ? these : 'the week'}`, money(total), { strong: true }),
  );

  const paid = charged
    ? `<p style="margin:12px 0 0;font-family:${FONT_BODY};font-size:14px;line-height:1.6;color:${E.muted};">Charged ${escapeHtml(money(charged.amount))} to the card on file${
        charged.invoiceUrl
          ? `. <a href="${escapeHtml(charged.invoiceUrl)}" style="color:${E.accent};text-decoration:none;">View the Stripe receipt</a>`
          : ''
      }.</p>`
    : '';

  const outputRows = outputs.length
    ? panel(outputs.map((item, index) => row(item.label, metricValue(item), { first: index === 0, sub: item.group })).join(''))
    : `<p style="margin:0;font-family:${FONT_BODY};font-size:15px;color:${E.muted};">No outputs were logged ${these}.</p>`;

  const wins = data.days.filter((day) => day.wins.trim());
  const winsHtml = wins.length
    ? panel(
        wins
          .map((day, index) => {
            const border = index === 0 ? '' : `border-top:1px solid ${E.rule};`;
            return `<tr><td style="padding:14px 18px;${border}">
<p style="margin:0 0 6px;font-family:${FONT_HEAD};font-size:13px;font-weight:700;color:${E.lavender};">${escapeHtml(dayLabel(day.date, 'long'))}</p>
<p style="margin:0;font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${E.body};">${escapeHtml(day.wins.trim()).replace(/\n/g, '<br />')}</p>
</td></tr>`;
          })
          .join(''),
      )
    : '';

  const bodyHtml = [
    noteHtml(entry.note),
    label(twoWeeks ? 'This pay period’s charge' : 'This week’s charge'),
    charges,
    paid,
    space(),
    label('Pay by shift'),
    panel(shifts.html),
    space(),
    label(twoWeeks ? 'What got done, both weeks' : 'What got done'),
    outputRows,
    winsHtml ? space() + label('Wins from the end-of-day reports') + winsHtml : '',
  ].join('');

  const html = renderEmailHtml({
    subject,
    preheader,
    eyebrow: kind,
    title: `${money(total)} for ${week}`,
    paragraphs: [
      twoWeeks
        ? `Here are the two weeks for ${client}: ${operator}'s hours and pay by shift for each week, what was done, and the charge. It comes from the end-of-day reports.`
        : `Here is the week for ${client}: ${operator}'s hours and pay by shift, what was done, and the charge. It comes from the end-of-day reports.`,
    ],
    bodyHtml,
    footer: { reason: `You received this because ${operator} is the operator Divine Acquisition placed with ${client}.` },
  });

  const text = [
    `${kind}: ${week}`,
    '',
    `${operator}, Sales Operator: ${money(pay)} (${payDetail})`,
    `Commission earnings: ${money(commission)}`,
    `Divine Acquisition management fee: ${money(fee)}`,
    `${charged ? 'Charged to your card on file' : `Total for ${twoWeeks ? these : 'the week'}`}: ${money(total)}`,
    charged?.invoiceUrl ? `Stripe receipt: ${charged.invoiceUrl}` : '',
    '',
    entry.note.trim(),
    '',
    'Pay by shift',
    ...shifts.text,
    '',
    'What got done',
    ...(outputs.length ? outputs.map((item) => `- ${item.label}: ${metricValue(item)}`) : [`- No outputs were logged ${these}.`]),
    ...(wins.length ? ['', 'Wins', ...wins.map((day) => `- ${dayLabel(day.date, 'long')}: ${day.wins.trim()}`)] : []),
    '',
    'Divine Acquisition',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');

  return { subject, preheader, html, text };
}

/**
 * The operator's pay statement: hours and pay per shift, commission when they
 * earned any, and their total. It never shows the management fee or what the
 * client is charged.
 */
export function operatorStatement(data: WeekData, entry: WeekEntry): Receipt {
  const placement = data.placement;
  const name = placement?.operator_name || 'there';
  const first = name.split(/\s+/)[0] || name;
  const client = placement?.client_name || 'your client';
  const week = weekLabel(data.week_start, data.week_end);
  const hours = totalHours(entry.hours);
  const pay = round2(entry.operatorPay);
  const commission = round2(entry.commission);
  const earned = operatorEarnings(entry);
  const shifts = shiftRows(data, entry);
  const twoWeeks = periodWord(data.period_days) === 'two weeks';
  const these = twoWeeks ? 'these two weeks' : 'the week';

  const subject = `Your pay for ${week}: ${money(earned)}`;
  const preheader = `${hoursLabel(hours)} with ${client}, ${money(earned)} for ${week}.`;
  const summary = panel(
    row('Pay for your shifts', money(pay), { first: true, sub: hoursLabel(hours) }) +
      (commission > 0 ? row('Commission earned', money(commission)) : '') +
      row(`Your total for ${these}`, money(earned), { strong: true }),
  );
  const bodyHtml = [label('Your pay'), summary, space(), label('Pay by shift'), panel(shifts.html)].join('');

  const html = renderEmailHtml({
    subject,
    preheader,
    eyebrow: 'Pay statement',
    title: `${money(earned)} for ${week}`,
    paragraphs: [
      twoWeeks
        ? `Hi ${first}, here is your pay for the two weeks of ${week} with ${client}: your hours and pay by shift, week by week.`
        : `Hi ${first}, here is your pay for the week of ${week} with ${client}: your hours and pay by shift.`,
    ],
    bodyHtml,
    footer: { reason: `You received this because you are a Divine Acquisition Sales Operator placed with ${client}.` },
  });

  const text = [
    `Your pay for ${week}`,
    '',
    `Pay for your shifts: ${money(pay)} (${hoursLabel(hours)})`,
    commission > 0 ? `Commission earned: ${money(commission)}` : '',
    `Your total for ${these}: ${money(earned)}`,
    '',
    'Pay by shift',
    ...shifts.text,
    '',
    'Divine Acquisition',
  ]
    .filter((line) => line !== '' || true)
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');

  return { subject, preheader, html, text };
}
