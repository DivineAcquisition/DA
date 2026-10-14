/**
 * Pure rules for the sales-operator onboarding sections that are more than a
 * single text box: the Divine Acquisition login, the hours grid, and the
 * labels the placement packet prints. The database is the source of truth
 * when an answer is saved.
 */

export const DA_LOGIN_DOMAIN = 'divineacquisition.io';

export const WEEK_DAYS = [
  { value: 'mon', label: 'Monday', short: 'Mon' },
  { value: 'tue', label: 'Tuesday', short: 'Tue' },
  { value: 'wed', label: 'Wednesday', short: 'Wed' },
  { value: 'thu', label: 'Thursday', short: 'Thu' },
  { value: 'fri', label: 'Friday', short: 'Fri' },
  { value: 'sat', label: 'Saturday', short: 'Sat' },
  { value: 'sun', label: 'Sunday', short: 'Sun' },
] as const;

export const WEEKLY_HOURS = [
  { value: 'part_time_4_5', label: 'Part time - 4 to 5 hours', hours: [4, 5] },
  { value: 'full_time_6_8', label: 'Full time - 6 to 8 hours', hours: [6, 7, 8] },
] as const;

const WORD: Record<string, string> = {
  hvac: 'HVAC',
  saas: 'SaaS',
  va: 'VA',
  sdr: 'SDR',
};

export const YEARS_LABELS: Record<string, string> = {
  none: 'None yet',
  under_1: 'Less than 1 year',
  y1_2: '1-2 years',
  y3_5: '3-5 years',
  y6_10: '6-10 years',
  y10_plus: 'More than 10 years',
};

export const ROLE_LABELS: Record<string, string> = {
  sdr: 'SDR',
  appointment_setter: 'Appointment setter',
  closer: 'Closer',
  va: 'VA',
  other: 'Other',
};

export const VERTICAL_LABELS: Record<string, string> = {
  med_spa: 'Med Spa',
  home_services: 'Home Services',
  coaches_consultants: 'Coaches and Consultants',
  no_preference: 'No preference',
};

export const PAYOUT_ONBOARDING_LABELS: Record<string, string> = {
  wise: 'Wise',
  remitly: 'Remitly',
};

export const YES_NO: Record<string, string> = { yes: 'Yes', no: 'No' };

export function weeklyLabel(value: string): string {
  return WEEKLY_HOURS.find((item) => item.value === value)?.label ?? '';
}

export function allowedDurations(weekly: string): number[] {
  return [...(WEEKLY_HOURS.find((item) => item.value === weekly)?.hours ?? [])];
}

export function clockLabel(hhmm: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const shown = hour % 12 || 12;
  return `${shown}:${match[2]} ${suffix}`;
}

function endFor(start: string, hours: number): string | null {
  const match = /^(\d{2}):00$/.exec(start);
  if (!match) return null;
  const end = Number(match[1]) + hours;
  if (end > 23) return null;
  return `${String(end).padStart(2, '0')}:00`;
}

export function startOptions(weekly: string): string[] {
  const durations = allowedDurations(weekly);
  const starts: string[] = [];
  for (let hour = 6; hour <= 20; hour += 1) {
    const start = `${String(hour).padStart(2, '0')}:00`;
    if (durations.some((hours) => endFor(start, hours))) starts.push(start);
  }
  return starts;
}

export function endOptions(start: string, weekly: string): string[] {
  return allowedDurations(weekly)
    .map((hours) => endFor(start, hours))
    .filter((value): value is string => Boolean(value));
}

export type ScheduleDay = { day: string; start: string; end: string };

export function parseSchedule(raw: string): ScheduleDay[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as { days?: Array<{ day?: unknown; start?: unknown; end?: unknown }> };
    if (!parsed || !Array.isArray(parsed.days)) return [];
    return parsed.days.flatMap((day) => {
      if (typeof day.day !== 'string' || typeof day.start !== 'string' || typeof day.end !== 'string') return [];
      return [{ day: day.day, start: day.start, end: day.end }];
    });
  } catch {
    return [];
  }
}

export function scheduleText(raw: string): string {
  return parseSchedule(raw)
    .map((day) => {
      const name = WEEK_DAYS.find((item) => item.value === day.day)?.short;
      if (!name || !day.start || !day.end) return '';
      return `${name} ${day.start}-${day.end}`;
    })
    .filter(Boolean)
    .join('; ');
}

export function choiceList(value: string, labels?: Record<string, string>): string {
  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (labels?.[token]) return labels[token];
      return token
        .split('_')
        .map((word) => WORD[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    })
    .join(', ');
}

/** Toggle a multi-select value. The exclusive choice, when set, replaces every other choice. */
export function toggleMulti(current: string, value: string, exclusive?: string | null): string {
  const selected = new Set(current.split(',').map((token) => token.trim()).filter(Boolean));
  if (exclusive && value === exclusive) {
    return selected.has(exclusive) && selected.size === 1 ? '' : exclusive;
  }
  if (exclusive) selected.delete(exclusive);
  if (selected.has(value)) selected.delete(value);
  else selected.add(value);
  return [...selected].join(',');
}
