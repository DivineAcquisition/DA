/**
 * Interpret a `datetime-local` value (`YYYY-MM-DDTHH:mm`) as wall time in an
 * IANA zone and return a UTC ISO string.
 */
export function localDateTimeToIso(localDateTime: string, timeZone: string): string | null {
  const match = localDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  // Start from the same clock face as UTC, then correct by the zone offset twice
  // so DST boundaries land on the intended wall time.
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i += 1) {
    const offset = zoneOffsetMinutes(new Date(utc), timeZone);
    if (offset === null) return null;
    utc = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60_000;
  }
  return new Date(utc).toISOString();
}

export function isoDateInTimeZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function zoneOffsetMinutes(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      hour: 'numeric',
    }).formatToParts(date);
    const tz = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) return tz === 'GMT' || tz === 'UTC' ? 0 : null;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2]);
    const mins = Number(match[3] ?? 0);
    return sign * (hours * 60 + mins);
  } catch {
    return null;
  }
}
