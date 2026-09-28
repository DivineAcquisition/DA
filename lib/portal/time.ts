/**
 * Times in the portal are shown in the VA's own time zone, with the client's
 * alongside where it matters. All formatting goes through Intl with an explicit
 * zone, so server and browser render the same string.
 */

function safeZone(zone: string | null | undefined): string {
  if (!zone) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return 'UTC';
  }
}

export function formatTime(iso: string, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: safeZone(zone),
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, zone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: safeZone(zone),
  }).format(new Date(iso));
}

/** A calendar date ("2026-09-28"), which has no zone of its own. */
export function formatDate(day: string, withYear = false): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

export function formatMonth(day: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day.slice(0, 10)}T00:00:00Z`),
  );
}

/** The short zone name as people say it: "EDT", "GMT+8". */
export function zoneAbbreviation(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: safeZone(zone), timeZoneName: 'short' }).formatToParts(
    new Date(iso),
  );
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? zone;
}

/** "2h 15m", "40m", "3d 4h". Never negative. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export type ShiftPhase =
  | { phase: 'on_shift'; left: string }
  | { phase: 'starts_in'; in: string }
  | { phase: 'over' }
  | { phase: 'none' };

/** What the shift card says right now. */
export function shiftPhase(
  now: number,
  today: { starts_at: string; ends_at: string } | null,
  next: { starts_at: string; ends_at: string } | null,
): ShiftPhase {
  const current = next && Date.parse(next.starts_at) <= now && Date.parse(next.ends_at) > now ? next : null;
  if (current) return { phase: 'on_shift', left: formatDuration(Date.parse(current.ends_at) - now) };
  if (today && Date.parse(today.starts_at) > now) {
    return { phase: 'starts_in', in: formatDuration(Date.parse(today.starts_at) - now) };
  }
  if (today && Date.parse(today.ends_at) <= now) return { phase: 'over' };
  return { phase: 'none' };
}

export function formatMoney(amount: number | string | null | undefined): string {
  const value = Number(amount ?? 0);
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toLocaleString('en-US', {
    minimumFractionDigits: Math.round(absolute * 100) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A datetime-local input value for an ISO instant in a zone ("2026-09-28T14:30"). */
export function toLocalInput(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: safeZone(zone),
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * The instant a wall-clock time in a zone refers to. "2026-09-28T14:30" in
 * America/New_York is 18:30Z. Resolved by correcting for the zone's offset at
 * that moment, twice, which settles across a daylight-saving change.
 */
export function fromLocalInput(local: string, zone: string): string | null {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  for (let i = 0; i < 2; i += 1) {
    const shown = toLocalInput(new Date(guess).toISOString(), zone);
    const [, sy, smo, sd, sh, smi] = shown.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)!.map(Number);
    guess += wanted - Date.UTC(sy, smo - 1, sd, sh, smi);
  }
  return new Date(guess).toISOString();
}
