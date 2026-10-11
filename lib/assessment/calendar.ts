import { createSign } from 'node:crypto';

/**
 * Google Calendar + Meet.
 * Reuses the Drive service-account JWT pattern with calendar scopes and
 * domain-wide delegation (GOOGLE_CALENDAR_SUBJECT_EMAIL / GOOGLE_DRIVE_SUBJECT_EMAIL).
 * Used by talent assessment bookings and Client Acquisition internal booking.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

/**
 * Malik (DA). This is the calendar the connected Google account owns.
 * `primary` on a service account is that robot's calendar, which cannot host
 * Meet links. An explicit calendar id lands the event on Malik's calendar.
 */
export const DEFAULT_CALENDAR_ID = 'malik@divineacquisition.io';

type ServiceCalendarConfig = {
  kind: 'service';
  clientEmail: string;
  privateKey: string;
  subjectEmail: string;
  calendarId: string;
};

type OauthCalendarConfig = {
  kind: 'oauth';
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
};

export type CalendarConfig = ServiceCalendarConfig | OauthCalendarConfig;

/** Dynamic lookup so a value present only at runtime is not inlined as empty. */
function envValue(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function readCalendarConfig(): CalendarConfig | null {
  const calendarId = envValue('GOOGLE_CALENDAR_ID') || DEFAULT_CALENDAR_ID;
  const clientEmail = envValue('GOOGLE_CALENDAR_CLIENT_EMAIL') || envValue('GOOGLE_DRIVE_CLIENT_EMAIL');
  const privateKey = (envValue('GOOGLE_CALENDAR_PRIVATE_KEY') || envValue('GOOGLE_DRIVE_PRIVATE_KEY')).replace(
    /\\n/g,
    '\n',
  );
  const subjectEmail = envValue('GOOGLE_CALENDAR_SUBJECT_EMAIL') || envValue('GOOGLE_DRIVE_SUBJECT_EMAIL');
  if (clientEmail && privateKey && subjectEmail) {
    return { kind: 'service', clientEmail, privateKey, subjectEmail, calendarId };
  }

  const clientId = envValue('GOOGLE_CALENDAR_OAUTH_CLIENT_ID');
  const clientSecret = envValue('GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET');
  const refreshToken = envValue('GOOGLE_CALENDAR_REFRESH_TOKEN');
  if (clientId && clientSecret && refreshToken) {
    return { kind: 'oauth', clientId, clientSecret, refreshToken, calendarId };
  }

  return null;
}

export const calendarConfigured = () => readCalendarConfig() !== null;

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken: { token: string; expiresAt: number; cacheKey: string } | null = null;

function cacheKey(config: CalendarConfig): string {
  return config.kind === 'service' ? `service:${config.subjectEmail}` : `oauth:${config.clientId}`;
}

async function getAccessToken(config: CalendarConfig): Promise<string> {
  const key = cacheKey(config);
  if (cachedToken && cachedToken.cacheKey === key && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams();
  if (config.kind === 'oauth') {
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', config.refreshToken);
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  } else {
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
    body.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    body.set('assertion', `${header}.${claims}.${signature}`);
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    // The token response can echo credentials. Keep the status, drop the body.
    throw new Error(`calendar_auth_failed: ${response.status}`);
  }

  const tokenBody = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: tokenBody.access_token,
    expiresAt: Date.now() + tokenBody.expires_in * 1000,
    cacheKey: key,
  };
  return cachedToken.token;
}

export type CreatedCalendarEvent = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
};

export type GoogleMeetEventInput = {
  summary: string;
  description: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  attendeeEmails: string[];
  /**
   * When false, Google does not email the invite or a reminder. The booking
   * messages own confirmation and reminders, so a live send must not also
   * fire Calendar's built-in copies.
   */
  notifyAttendees?: boolean;
};

export function calendarEventBody(input: GoogleMeetEventInput, requestId: string) {
  const notify = input.notifyAttendees !== false;
  const uniqueAttendees = [...new Set(input.attendeeEmails.map((email) => email.toLowerCase().trim()).filter(Boolean))];
  return {
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
    reminders: notify
      ? {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 30 },
          ],
        }
      : { useDefault: false, overrides: [] },
    sendUpdates: notify ? 'all' : 'none',
  };
}

export async function createGoogleMeetEvent(
  input: GoogleMeetEventInput,
): Promise<CreatedCalendarEvent> {
  const config = readCalendarConfig();
  if (!config) throw new Error('calendar_not_configured');

  const token = await getAccessToken(config);
  const requestId = crypto.randomUUID();
  const built = calendarEventBody(input, requestId);
  const { sendUpdates, ...body } = built;

  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events`,
  );
  url.searchParams.set('conferenceDataVersion', '1');
  url.searchParams.set('sendUpdates', sendUpdates);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`calendar_create_failed: ${response.status}`);
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

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  const config = readCalendarConfig();
  if (!config || !eventId) return;
  const token = await getAccessToken(config);
  const url = new URL(
    `${CALENDAR_API}/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
  url.searchParams.set('sendUpdates', 'none');
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    console.error('[calendar] delete failed', response.status);
  }
}

export const createAssessmentCalendarEvent = createGoogleMeetEvent;
