export const APPLY_EVENT_NAMES = [
  'popup_opened',
  'step1_submitted',
  'question_answered',
  'step2_completed',
  'route_shown',
  'calendar_booked',
  'sync_failed',
] as const;

export type ApplyEventName = (typeof APPLY_EVENT_NAMES)[number];

export type ApplyEvent = {
  at: string;
  email: string;
  adName: string;
  name: ApplyEventName;
  screen?: string;
  question?: number;
  test: boolean;
};

export type ApplyDayCount = {
  ad: string;
  day: string;
  popupOpens: number;
  step1Submits: number;
  step2Completions: number;
  calendar: number;
  closed: number;
  later: number;
  bookings: number;
  dropOffAfterOpen: number;
  dropOffAfterStep1: number;
  dropOffAfterStep2: number;
  failures: number;
};

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Counts real applications. Test rows are left out of every number. */
export function countApplications(events: readonly ApplyEvent[]): ApplyDayCount[] {
  const groups = new Map<string, ApplyDayCount>();
  for (const event of events) {
    if (event.test) continue;
    const day = dayKey(event.at);
    const ad = event.adName || 'direct';
    const key = `${day}|${ad}`;
    const row =
      groups.get(key) ??
      {
        ad,
        day,
        popupOpens: 0,
        step1Submits: 0,
        step2Completions: 0,
        calendar: 0,
        closed: 0,
        later: 0,
        bookings: 0,
        dropOffAfterOpen: 0,
        dropOffAfterStep1: 0,
        dropOffAfterStep2: 0,
        failures: 0,
      };
    if (event.name === 'popup_opened') row.popupOpens += 1;
    if (event.name === 'step1_submitted') row.step1Submits += 1;
    if (event.name === 'step2_completed') row.step2Completions += 1;
    if (event.name === 'route_shown' && event.screen === 'calendar') row.calendar += 1;
    if (event.name === 'route_shown' && event.screen === 'closed') row.closed += 1;
    if (event.name === 'route_shown' && event.screen === 'later') row.later += 1;
    if (event.name === 'calendar_booked') row.bookings += 1;
    if (event.name === 'sync_failed') row.failures += 1;
    groups.set(key, row);
  }
  return [...groups.values()]
    .map((row) => ({
      ...row,
      dropOffAfterOpen: Math.max(0, row.popupOpens - row.step1Submits),
      dropOffAfterStep1: Math.max(0, row.step1Submits - row.step2Completions),
      dropOffAfterStep2: Math.max(0, row.calendar - row.bookings),
    }))
    .sort((a, b) => (a.day === b.day ? a.ad.localeCompare(b.ad) : b.day.localeCompare(a.day)));
}
