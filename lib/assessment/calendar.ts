import { createSign } from 'node:crypto';

/**
 * Google Calendar + Meet for assessment bookings.
 * Reuses the Drive service-account JWT pattern with calendar scopes and
 * domain-wide delegation (GOOGLE_CALENDAR_SUBJECT_EMAIL / GOOGLE_DRIVE_SUBJECT_EMAIL).
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

type CalendarConfig = {
  clientEmail: string;
  privateKey: string;
  subjectEmail: string;
  calendarId: string;
};

export function readCalendarConfig(): CalendarConfig | null {
  const clientEmail =
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = (
    process.env.GOOGLE_CALENDAR_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY
  )?.replace(/\\n/g, '\n');
  const subjectEmail =
    process.env.GOOGLE_CALENDAR_SUBJECT_EMAIL || process.env.GOOGLE_DRIVE_SUBJECT_EMAIL;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  if (!clientEmail || !privateKey || !subjectEmail) return null;

  return { clientEmail, privateKey, subjectEmail, calendarId };
}

export const calendarConfigured = () => readCalendarConfig() !== null;

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken: { token: string; expiresAt: number; subject: string } | null = null;

async function getAccessToken(config: CalendarConfig): Promise<string> {
  if (
    cachedToken &&
    cachedToken.subject === config.subjectEmail &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
      sub: config.subjectEmail,
    }),
  );
  const signature = base64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(config.privateKey));

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`calendar_auth_failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    subject: config.subjectEmail,
  };
  return cachedToken.token;
}

export type CreatedCalendarEvent = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
};

export async function createAssessmentCalendarEvent(input: {
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendeeEmails: string[];
}): Promise<CreatedCalendarEvent> {
  const config = readCalendarConfig();
  if (!config) throw new Error('calendar_not_configured');

  const token = await getAccessToken(config);
  const requestId = crypto.randomUUID();

  const uniqueAttendees = [...new Set(input.attendeeEmails.map((e) => e.toLowerCase().trim()).filter(Boolean))];

  const body = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt, timeZone: input.timeZone },
    end: { dateTime: input.endsAt, timeZone: input.timeZone },
    attendees: uniqueAttendees.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 30 }],
    },
  };

  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events`,
  );
  url.searchParams.set('conferenceDataVersion', '1');
  url.searchParams.set('sendUpdates', 'all');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`calendar_create_failed: ${response.status} ${await response.text()}`);
  }

  const event = (await response.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };

  const meetFromEntry =
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri ?? null;

  return {
    eventId: event.id,
    meetUrl: event.hangoutLink ?? meetFromEntry,
    htmlLink: event.htmlLink ?? null,
  };
}
