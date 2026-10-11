type Zoned = { year: number; month: number; day: number; hour: number; minute: number; weekday: string };

export function zonedParts(date: Date, timeZone: string): Zoned {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  let hour = Number(read('hour'));
  if (hour === 24) hour = 0;
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour,
    minute: Number(read('minute')),
    weekday: read('weekday'),
  };
}

/** 9 PM to 7 AM local. 7:00 is open. 21:00 is quiet. */
export function isQuietHours(date: Date, timeZone: string): boolean {
  const { hour } = zonedParts(date, timeZone);
  return hour >= 21 || hour < 7;
}

export function isWeekend(date: Date, timeZone: string): boolean {
  const { weekday } = zonedParts(date, timeZone);
  return weekday === 'Sat' || weekday === 'Sun';
}

export type SendWindow = 'waking' | 'business' | 'sms';

function inWindow(date: Date, timeZone: string, mode: SendWindow, weekendOk: boolean): boolean {
  const { hour, weekday } = zonedParts(date, timeZone);
  const weekend = weekday === 'Sat' || weekday === 'Sun';
  if (mode === 'business') return !weekend && hour >= 9 && hour < 17;
  if (mode === 'sms') return hour >= 7 && hour < 21 && (weekendOk || !weekend);
  return hour >= 7 && hour < 21;
}

/** Next moment the window is open, or `now` when it already is. */
export function nextWindow(now: Date, timeZone: string, mode: SendWindow, weekendOk = false): Date {
  if (inWindow(now, timeZone, mode, weekendOk)) return now;
  for (let step = 1; step <= 14 * 24 * 4; step += 1) {
    const candidate = new Date(now.getTime() + step * 15 * 60 * 1000);
    if (inWindow(candidate, timeZone, mode, weekendOk)) return candidate;
  }
  return now;
}

const CLOSED = new Set(['on_hold', 'withdrawn', 'completed', 'unsigned']);

export function nudgeBlock(input: {
  status?: string;
  agreementSigned?: boolean;
  unansweredNudges?: number;
  lastNudgeAt?: string | null;
  now: Date;
}): string | null {
  if (input.agreementSigned === false || (input.status && CLOSED.has(input.status))) return 'not_nudgeable';
  if ((input.unansweredNudges ?? 0) >= 3) return 'nudge_cap';
  if (input.lastNudgeAt) {
    const elapsed = input.now.getTime() - new Date(input.lastNudgeAt).getTime();
    if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return 'nudge_interval';
  }
  return null;
}
