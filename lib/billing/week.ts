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
  management_fee: number;
  total: number;
  note: string | null;
  status: 'draft' | 'sent';
  sent_at: string | null;
  sent_to: string[];
  send_count: number;
  updated_at: string;
};

export type WeekPlacement = {
  id: string;
  operator_name: string;
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
  week_start: string;
  week_end: string;
  today: string;
  days: WeekDay[];
  recipients: { to: string[]; cc: string[] };
  last_rate: number | null;
  charge: WeekCharge | null;
};

/** What DA Admin enters on the desk. */
export type WeekEntry = {
  hours: Record<string, number>;
  hourlyRate: number | null;
  operatorPay: number;
  managementFee: number;
  note: string;
};

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

export function weeklyReceipt(data: WeekData, entry: WeekEntry): Receipt {
  const placement = data.placement;
  const operator = placement?.operator_name || 'Your operator';
  const client = placement?.client_name || 'your team';
  const week = weekLabel(data.week_start, data.week_end);
  const hours = totalHours(entry.hours);
  const pay = round2(entry.operatorPay);
  const fee = round2(entry.managementFee);
  const total = round2(pay + fee);
  const outputs = receiptOutputs(data.days);
  const payDetail =
    entry.hourlyRate != null && payFromRate(hours, entry.hourlyRate) === pay
      ? `${hoursLabel(hours)} × ${money(entry.hourlyRate)}/hr`
      : `${hoursLabel(hours)} worked`;

  const subject = `Weekly receipt: ${operator} for ${client}, ${week}`;
  const preheader = `${money(total)} for the week of ${week}: ${hoursLabel(hours)} from ${operator}, plus the management fee.`;

  const charges = panel(
    row(`${operator}, operator`, money(pay), { first: true, sub: payDetail }) +
      row('Divine Acquisition management fee', money(fee)) +
      row('Total for the week', money(total), { strong: true }),
  );

  const dayRows = data.days
    .map((day, index) =>
      row(dayLabel(day.date, 'long'), hoursLabel(num(entry.hours[day.date]) ?? 0), {
        first: index === 0,
        sub: STATUS_LABEL[day.status] ?? day.status,
      }),
    )
    .join('');

  const outputRows = outputs.length
    ? panel(outputs.map((item, index) => row(item.label, metricValue(item), { first: index === 0, sub: item.group })).join(''))
    : `<p style="margin:0;font-family:${FONT_BODY};font-size:15px;color:${E.muted};">No outputs were logged this week.</p>`;

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

  const note = entry.note.trim()
    ? `<p style="margin:0 0 16px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${E.body};">${escapeHtml(entry.note.trim()).replace(/\n/g, '<br />')}</p>`
    : '';

  const space = '<div style="height:24px;line-height:24px;font-size:0;">&nbsp;</div>';
  const bodyHtml = [
    note,
    label('This week’s charge'),
    charges,
    space,
    label('Hours by day'),
    panel(dayRows || row('No working days this week', '0 hrs', { first: true })),
    space,
    label('What got done'),
    outputRows,
    winsHtml ? space + label('Wins from the end-of-day reports') + winsHtml : '',
  ].join('');

  const html = renderEmailHtml({
    subject,
    preheader,
    eyebrow: 'Weekly receipt',
    title: `${money(total)} for ${week}`,
    paragraphs: [`Here is the week for ${client}: ${operator}'s hours, what was done, and the charge. It comes from the end-of-day reports.`],
    bodyHtml,
    footer: { reason: `You received this because ${operator} is the operator Divine Acquisition placed with ${client}.` },
  });

  const text = [
    `Weekly receipt: ${week}`,
    '',
    `${operator}, operator: ${money(pay)} (${payDetail})`,
    `Divine Acquisition management fee: ${money(fee)}`,
    `Total for the week: ${money(total)}`,
    '',
    entry.note.trim(),
    '',
    'Hours by day',
    ...data.days.map((day) => `- ${dayLabel(day.date, 'long')}: ${hoursLabel(num(entry.hours[day.date]) ?? 0)} (${STATUS_LABEL[day.status] ?? day.status})`),
    '',
    'What got done',
    ...(outputs.length ? outputs.map((item) => `- ${item.label}: ${metricValue(item)}`) : ['- No outputs were logged this week.']),
    ...(wins.length ? ['', 'Wins', ...wins.map((day) => `- ${dayLabel(day.date, 'long')}: ${day.wins.trim()}`)] : []),
    '',
    'Divine Acquisition',
  ]
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
    .join('\n');

  return { subject, preheader, html, text };
}
