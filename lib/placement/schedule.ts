/** Shift clocks and the availability the operator gave during onboarding. */

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const total = (Number(match[1]) * 60 + Number(match[2]) + minutes) % (24 * 60);
  const normalized = (total + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function addMonths(isoDate: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const day = Number(match[3]);
  const stamp = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1));
  const last = new Date(Date.UTC(stamp.getUTCFullYear(), stamp.getUTCMonth() + 1, 0)).getUTCDate();
  stamp.setUTCDate(Math.min(day, last));
  return stamp.toISOString().slice(0, 10);
}

/** Read a clock in one zone and say what time that is in another. */
export function clockInZone(date: string, time: string, fromZone: string, toZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffsetMinutes(new Date(utcGuess), fromZone);
  if (offset === null) return null;
  const instant = new Date(utcGuess - offset * 60_000);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: toZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
    const h = parts.find((part) => part.type === 'hour')?.value ?? '';
    const m = parts.find((part) => part.type === 'minute')?.value ?? '';
    if (!h || !m) return null;
    const hour = h === '24' ? '00' : h.padStart(2, '0');
    return `${hour}:${m.padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function zoneOffsetMinutes(instant: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(instant);
    const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'));
    return Math.round((asUtc - instant.getTime()) / 60_000);
  } catch {
    return null;
  }
}

export function parseWorkDays(value: unknown): number[] {
  const text = Array.isArray(value) ? value.join(',') : String(value ?? '');
  const lower = text.toLowerCase();
  const days = new Set<number>();
  for (let index = 0; index < WEEKDAYS.length; index += 1) {
    if (lower.includes(WEEKDAYS[index]) || lower.includes(WEEKDAYS[index].slice(0, 3))) days.add(index + 1);
  }
  for (const match of lower.matchAll(/\b([1-7])\b/g)) days.add(Number(match[1]));
  if (/mon(?:day)?\s*(?:to|–|-)\s*fri/.test(lower)) [1, 2, 3, 4, 5].forEach((day) => days.add(day));
  return [...days].sort((a, b) => a - b);
}

export function parseWorkHours(value: unknown): { start: string; end: string } | null {
  const text = String(value ?? '');
  const matches = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
  if (matches.length < 2) return null;
  const clock = (match: RegExpMatchArray) => {
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? '0');
    const marker = (match[3] ?? '').toLowerCase();
    if (marker === 'pm' && hour < 12) hour += 12;
    if (marker === 'am' && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };
  const start = clock(matches[0]);
  const end = clock(matches[1]);
  if (!start || !end) return null;
  return { start, end };
}

export function availabilityWarnings(input: {
  workingDays: number[];
  shiftStart: string;
  shiftEnd: string;
  shiftZone: string;
  operatorZone: string | null;
  workDays: unknown;
  workHours: unknown;
  onDate: string;
}): string[] {
  const warnings: string[] = [];
  const availableDays = parseWorkDays(input.workDays);
  if (availableDays.length > 0) {
    const outside = input.workingDays.filter((day) => !availableDays.includes(day));
    if (outside.length > 0) warnings.push('A working day is outside the days they gave in onboarding.');
  }
  const hours = parseWorkHours(input.workHours);
  const zone = input.operatorZone || input.shiftZone;
  if (hours && zone) {
    const start = clockInZone(input.onDate, input.shiftStart, input.shiftZone, zone);
    const end = clockInZone(input.onDate, input.shiftEnd, input.shiftZone, zone);
    if (start && end && (start < hours.start || end > hours.end)) {
      warnings.push(`The shift is outside the hours they gave (${hours.start}–${hours.end} in their time zone).`);
    }
  }
  return warnings;
}
