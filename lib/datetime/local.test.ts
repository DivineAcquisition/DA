import { describe, expect, it } from 'vitest';
import { isoDateInTimeZone, localDateTimeToIso } from './local';

describe('localDateTimeToIso', () => {
  it('converts Eastern Daylight Time (UTC-4) to UTC', () => {
    expect(localDateTimeToIso('2026-08-27T14:00', 'America/New_York')).toBe(
      '2026-08-27T18:00:00.000Z',
    );
  });

  it('converts Eastern Standard Time (UTC-5) to UTC', () => {
    expect(localDateTimeToIso('2026-01-15T14:00', 'America/New_York')).toBe(
      '2026-01-15T19:00:00.000Z',
    );
  });

  it('rejects a value that is not datetime-local', () => {
    expect(localDateTimeToIso('2026-08-27 14:00', 'America/New_York')).toBeNull();
    expect(localDateTimeToIso('2026-08-27T14:00:00Z', 'UTC')).toBeNull();
  });
});

describe('isoDateInTimeZone', () => {
  it('returns the calendar date in the given zone', () => {
    expect(isoDateInTimeZone('2026-08-27T18:00:00.000Z', 'America/New_York')).toBe('2026-08-27');
    expect(isoDateInTimeZone('2026-08-28T02:00:00.000Z', 'America/Los_Angeles')).toBe('2026-08-27');
  });
});
