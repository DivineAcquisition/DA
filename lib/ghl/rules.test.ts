import { describe, expect, it } from 'vitest';
import {
  agencyProbes,
  allOff,
  backoffMs,
  classifyOutcome,
  ghlAppUrl,
  locationProbes,
  loggablePath,
  permissionDiff,
  readMessages,
  readShape,
  readUsers,
  redact,
  scopeHeld,
  splitName,
  throttleMs,
  withLocation,
  withoutLocations,
} from './rules';

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe('GHL outcomes', () => {
  it('reads a missing scope apart from a bad token', () => {
    expect(classifyOutcome(401, { message: 'The token is not authorized for this scope.' })).toBe('scope_missing');
    expect(classifyOutcome(401, { message: 'Invalid JWT' })).toBe('auth_failed');
    expect(classifyOutcome(403, 'Forbidden')).toBe('auth_failed');
    expect(classifyOutcome(429, null)).toBe('rate_limited');
    expect(classifyOutcome(404, null)).toBe('not_found');
    expect(classifyOutcome(422, null)).toBe('client_error');
    expect(classifyOutcome(502, null)).toBe('server_error');
    expect(classifyOutcome(null, 'fetch failed')).toBe('network');
    expect(classifyOutcome(200, {})).toBe('ok');
  });

  it('treats a write-scope probe that reached the record lookup as held', () => {
    expect(scopeHeld('not_found')).toBe(true);
    expect(scopeHeld('client_error')).toBe(true);
    expect(scopeHeld('scope_missing')).toBe(false);
    expect(scopeHeld('server_error')).toBeNull();
  });

  it('probes every required scope', () => {
    expect(locationProbes('LOC').map((p) => p.scope)).toEqual([
      'locations.readonly', 'users.readonly', 'contacts.readonly', 'contacts.write', 'conversations.readonly',
      'conversations/message.readonly', 'opportunities.readonly', 'calendars.readonly',
      'locations/customFields.readonly', 'locations/tags.readonly',
    ]);
    expect(agencyProbes('CO').map((p) => p.scope)).toEqual(['locations.readonly', 'users.readonly', 'users.write']);
    // Probes never delete and never create.
    expect([...locationProbes('L'), ...agencyProbes('C')].every((p) => p.method === 'GET' || p.method === 'PUT')).toBe(true);
  });
});

describe('back-off and rate limits', () => {
  it('honours Retry-After, then the reported interval, then grows', () => {
    expect(backoffMs(1, headers({ 'retry-after': '3' }))).toBe(3000);
    expect(backoffMs(1, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-interval-milliseconds': '10000' }))).toBe(10000);
    expect(backoffMs(1, null, () => 0)).toBe(500);
    expect(backoffMs(3, null, () => 0)).toBe(2000);
    expect(backoffMs(20, null, () => 0)).toBe(15000);
  });

  it('slows down only when the burst window is nearly spent', () => {
    expect(throttleMs(null, null)).toBe(0);
    expect(throttleMs(50, 10000)).toBe(0);
    expect(throttleMs(3, 10000)).toBe(10000);
  });
});

describe('what may be logged', () => {
  it('keeps ids and drops free text from the path', () => {
    expect(loggablePath('/users/search', { companyId: 'C1', query: 'ana@example.com', limit: 25 })).toBe('/users/search?companyId=C1&limit=25');
    expect(loggablePath('/contacts/abc?x=1')).toBe('/contacts/abc');
  });

  it('never lets a token through', () => {
    const token = 'pit-1a2b3c4d-5e6f-7a8b-9c0d-112233445566';
    const out = redact(`401: bad token ${token} sent as Bearer ${token}`, [token]);
    expect(out).not.toContain(token);
    expect(out).not.toContain('1a2b3c4d');
    expect(redact('Authorization: Bearer abc.def.ghi')).toBe('Authorization: Bearer [redacted]');
    expect(redact('jwt eyJhbGciOiJIUzI1NiIs.eyJzdWIiOiIxMjM0NTY3.SflKxwRJSMeKKF2QT4')).not.toContain('eyJ');
  });
});

describe('reading GHL shapes', () => {
  it('maps pipelines in stage order, fields with types, tags and calendars', () => {
    const shape = readShape(
      { pipelines: [{ id: 'p', name: 'DA Sales Pipeline', stages: [{ id: 's1', name: 'New Lead' }, { id: 's2', name: 'Contacted' }] }] },
      { customFields: [{ id: 'f', name: 'Service Requested', dataType: 'SINGLE_OPTIONS' }] },
      { tags: [{ id: 't', name: 'da-lead' }] },
      { calendars: [{ id: 'c', name: 'DA Booking Calendar' }] },
    );
    expect(shape.pipelines[0].stages.map((s) => s.name)).toEqual(['New Lead', 'Contacted']);
    expect(shape.customFields[0].dataType).toBe('SINGLE_OPTIONS');
    expect(shape.calendars).toHaveLength(1);
    expect(readShape(null, undefined, {}, [])).toEqual({ pipelines: [], customFields: [], tags: [], calendars: [] });
  });

  it('reads users with their roles and locations', () => {
    const [user] = readUsers({
      users: [{ id: 'u1', firstName: 'Ana', lastName: 'Cruz', email: 'ANA@x.test', roles: { type: 'account', role: 'user', locationIds: ['L1'] }, permissions: { settingsEnabled: false } }],
    });
    expect(user).toEqual({ id: 'u1', name: 'Ana Cruz', email: 'ana@x.test', role: 'user', type: 'account', locationIds: ['L1'], permissions: { settingsEnabled: false } });
  });

  it('turns messages into events with the human-or-automated signals and no body', () => {
    const events = readMessages(
      {
        messages: {
          messages: [
            { id: 'm1', direction: 'outbound', userId: 'u1', source: 'app', messageType: 'TYPE_SMS', dateAdded: '2026-10-01T10:00:00Z', body: 'hello' },
            { id: 'm2', direction: 'outbound', source: 'workflow', messageType: 'TYPE_SMS', dateAdded: '2026-10-01T10:01:00Z' },
            { id: 'm3', direction: 'inbound', dateAdded: '2026-10-01T10:02:00Z' },
            { id: 'm4', dateAdded: '2026-10-01T10:03:00Z' },
          ],
        },
      },
      'conv',
      'contact',
    );
    expect(events.map((e) => [e.type, e.userId, e.source])).toEqual([
      ['OutboundMessage', 'u1', 'app'],
      ['OutboundMessage', null, 'workflow'],
      ['InboundMessage', null, null],
    ]);
    expect(JSON.stringify(events)).not.toContain('hello');
    expect(events[0].contactId).toBe('contact');
  });
});

describe('provisioning helpers', () => {
  it('adds and removes locations without duplicates', () => {
    expect(withLocation(['A'], 'A')).toEqual(['A']);
    expect(withLocation(['A'], 'B')).toEqual(['A', 'B']);
    expect(withoutLocations(['A', 'B', 'C'], ['B', 'C'])).toEqual(['A']);
  });

  it('deactivation turns every flag off', () => {
    expect(allOff({ contactsEnabled: true, settingsEnabled: false })).toEqual({ contactsEnabled: false, settingsEnabled: false });
  });

  it('finds permission flags that differ, treating absent as off', () => {
    expect(permissionDiff({ contactsEnabled: true, settingsEnabled: false }, { contactsEnabled: true })).toEqual([]);
    expect(permissionDiff({ contactsEnabled: true, settingsEnabled: false }, { contactsEnabled: false, settingsEnabled: true })).toEqual([
      'contactsEnabled',
      'settingsEnabled',
    ]);
  });

  it('splits names and builds the GHL link', () => {
    expect(splitName('Ana Maria Cruz')).toEqual({ firstName: 'Ana Maria', lastName: 'Cruz' });
    expect(ghlAppUrl('https://app.gohighlevel.com/', 'L1')).toBe('https://app.gohighlevel.com/v2/location/L1/dashboard');
    expect(ghlAppUrl('https://app.gohighlevel.com', 'L1', 'c 1')).toBe('https://app.gohighlevel.com/v2/location/L1/contacts/detail/c%201');
  });
});
