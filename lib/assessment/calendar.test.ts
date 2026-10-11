import { afterEach, describe, expect, it, vi } from 'vitest';
import { calendarEventBody, readCalendarConfig } from './calendar';

describe('calendar connection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is not configured until a service account or a user refresh token is present', () => {
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_EMAIL', '');
    vi.stubEnv('GOOGLE_DRIVE_CLIENT_EMAIL', '');
    vi.stubEnv('GOOGLE_CALENDAR_PRIVATE_KEY', '');
    vi.stubEnv('GOOGLE_DRIVE_PRIVATE_KEY', '');
    vi.stubEnv('GOOGLE_CALENDAR_SUBJECT_EMAIL', '');
    vi.stubEnv('GOOGLE_DRIVE_SUBJECT_EMAIL', '');
    vi.stubEnv('GOOGLE_CALENDAR_OAUTH_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET', '');
    vi.stubEnv('GOOGLE_CALENDAR_REFRESH_TOKEN', '');
    expect(readCalendarConfig()).toBeNull();
  });

  it('uses Malik’s calendar and a user refresh token when that is what is connected', () => {
    vi.stubEnv('GOOGLE_CALENDAR_CLIENT_EMAIL', '');
    vi.stubEnv('GOOGLE_DRIVE_CLIENT_EMAIL', '');
    vi.stubEnv('GOOGLE_CALENDAR_PRIVATE_KEY', '');
    vi.stubEnv('GOOGLE_DRIVE_PRIVATE_KEY', '');
    vi.stubEnv('GOOGLE_CALENDAR_SUBJECT_EMAIL', '');
    vi.stubEnv('GOOGLE_DRIVE_SUBJECT_EMAIL', '');
    vi.stubEnv('GOOGLE_CALENDAR_OAUTH_CLIENT_ID', 'client');
    vi.stubEnv('GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET', 'secret');
    vi.stubEnv('GOOGLE_CALENDAR_REFRESH_TOKEN', 'refresh');
    vi.stubEnv('GOOGLE_CALENDAR_ID', '');
    const config = readCalendarConfig();
    expect(config?.kind).toBe('oauth');
    expect(config?.calendarId).toBe('malik@divineacquisition.io');
  });

  it('does not ask Google to email an invite when our messages own delivery', () => {
    const body = calendarEventBody(
      {
        summary: 'Audit',
        description: 'Audit',
        startsAt: '2026-10-15T18:00:00.000Z',
        endsAt: '2026-10-15T18:30:00.000Z',
        timeZone: 'America/New_York',
        attendeeEmails: ['jordan@example.com'],
        notifyAttendees: false,
      },
      'request-1',
    );
    expect(body.sendUpdates).toBe('none');
    expect(body.reminders.overrides).toEqual([]);
  });
});
