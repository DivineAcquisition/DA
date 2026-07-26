/**
 * Date helpers. Everything works on `YYYY-MM-DD` strings in UTC so that pay
 * proration and period boundaries never drift with the viewer's time zone.
 */

export const toDay = (value: string | Date): string =>
  (value instanceof Date ? value.toISOString() : value).slice(0, 10);

export const dayToUtc = (day: string): number => Date.parse(`${toDay(day)}T00:00:00.000Z`);

export function addDays(day: string, count: number): string {
  return toDay(new Date(dayToUtc(day) + count * 86400000));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToUtc(to) - dayToUtc(from)) / 86400000);
}

/** Inclusive day count, so a single-day range is 1. */
export function inclusiveDays(from: string, to: string): number {
  return Math.max(0, daysBetween(from, to) + 1);
}

export function addMonths(day: string, count: number): string {
  const date = new Date(dayToUtc(day));
  const targetMonth = date.getUTCMonth() + count;
  const anchor = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, 1));
  const lastDayOfTarget = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return toDay(
    new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(date.getUTCDate(), lastDayOfTarget)),
    ),
  );
}

export const monthKey = (day: string): string => toDay(day).slice(0, 7);

export function daysInMonth(day: string): number {
  const date = new Date(dayToUtc(day));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function monthStart(day: string): string {
  return `${monthKey(day)}-01`;
}

export function monthEnd(day: string): string {
  return `${monthKey(day)}-${String(daysInMonth(day)).padStart(2, '0')}`;
}

/** Overlapping inclusive day count between two ranges. 0 when disjoint. */
export function overlapDays(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = Math.max(dayToUtc(aStart), dayToUtc(bStart));
  const end = Math.min(dayToUtc(aEnd), dayToUtc(bEnd));
  if (end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

export function isWithin(day: string, start: string, end: string): boolean {
  const value = dayToUtc(day);
  return value >= dayToUtc(start) && value <= dayToUtc(end);
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let day = toDay(start); dayToUtc(day) <= dayToUtc(end); day = addDays(day, 1)) {
    out.push(day);
  }
  return out;
}

export function isWeekend(day: string): boolean {
  const weekday = new Date(dayToUtc(day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 3600000;
}

/**
 * Builds the two pay periods for a month: the 1st to the 15th, and the 16th to
 * the last day. The second closes the month, which is when monthly items settle.
 */
export function payPeriodsForMonth(day: string): { start: string; end: string; closesMonth: boolean }[] {
  const key = monthKey(day);
  return [
    { start: `${key}-01`, end: `${key}-15`, closesMonth: false },
    { start: `${key}-16`, end: monthEnd(day), closesMonth: true },
  ];
}
