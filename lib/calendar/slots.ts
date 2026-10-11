import { isoDateInTimeZone, localDateTimeToIso } from '@/lib/datetime/local';

/** Default applicant slots: weekdays, 9:00 through 16:30, every 30 minutes. */
export const SLOT_MINUTES = 30;

export type SlotOffer = {
  /** JS weekday: 0 Sunday through 6 Saturday. */
  days: readonly number[];
  /** Local times as HH:MM. */
  times: readonly string[];
};

export const WEEKDAY_HOURS: SlotOffer = {
  days: [1, 2, 3, 4, 5],
  times: Array.from({ length: 16 }, (_, index) => {
    const minutes = 9 * 60 + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }),
};
export const SLOT_LEAD_MS = 15 * 60_000;
export const SLOT_HORIZON_MS = 60 * 24 * 60 * 60 * 1000;

export const SCHEDULE_TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'UTC',
] as const;

export const DEFAULT_TIME_ZONE = 'America/New_York';

export function weekdayOf(isoDate: string): number | null {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekendDate(isoDate: string): boolean {
  const weekday = weekdayOf(isoDate);
  return weekday === null || weekday === 0 || weekday === 6;
}

export function isOfferedDate(isoDate: string, offer: SlotOffer = WEEKDAY_HOURS): boolean {
  const weekday = weekdayOf(isoDate);
  return weekday !== null && offer.days.includes(weekday);
}

export function civilToday(timeZone: string, now = new Date()): string {
  return isoDateInTimeZone(now.toISOString(), timeZone);
}

/** Monday-first weeks. Null cells pad the month. */
export function monthMatrix(year: number, monthIndex: number): (string | null)[][] {
  const startPad = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: days }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      const month = String(monthIndex + 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function slotsForDate(
  isoDate: string,
  timeZone: string,
  now = new Date(),
  offer: SlotOffer = WEEKDAY_HOURS,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !isOfferedDate(isoDate, offer)) return [];
  const earliest = now.getTime() + SLOT_LEAD_MS;
  const latest = now.getTime() + SLOT_HORIZON_MS;
  const slots: string[] = [];
  for (const time of offer.times) {
    const iso = localDateTimeToIso(`${isoDate}T${time}`, timeZone);
    if (!iso) continue;
    const at = new Date(iso).getTime();
    if (at < earliest || at > latest) continue;
    slots.push(iso);
  }
  return slots;
}

export function isOfferedSlot(
  iso: string,
  timeZone: string,
  now = new Date(),
  offer: SlotOffer = WEEKDAY_HOURS,
): boolean {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return false;
  const date = isoDateInTimeZone(at.toISOString(), timeZone);
  return slotsForDate(date, timeZone, now, offer).some((slot) => new Date(slot).getTime() === at.getTime());
}

export function formatSlotTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

export function formatSlotWhen(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  });
}
