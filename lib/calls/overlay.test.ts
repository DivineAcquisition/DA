import { describe, expect, it } from 'vitest';
import { mapDebriefRecord, mapLeadRecord } from './map';
import { overlayCallsOnProfile, recordingPrefillFrom } from './overlay';
import type { LeadProfile, ProspectCall } from './types';

function profile(overrides: Partial<LeadProfile> = {}): LeadProfile {
  return {
    lead: mapLeadRecord({
      id: 'recbhuwRMsnk618TH',
      fields: {
        'Lead Name': 'Jordan',
        Email: 'won@example.com',
        'Google Meet URL': '',
      },
    }),
    touches: [],
    debriefs: [],
    history: [],
    onboarding: null,
    incomingCall: null,
    pendingAirtableSend: false,
    ...overrides,
  };
}

function call(overrides: Partial<ProspectCall> = {}): ProspectCall {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    airtableLeadId: 'recbhuwRMsnk618TH',
    email: 'won@example.com',
    fullName: 'Jordan',
    kind: 'booking',
    source: 'ghl',
    externalRef: 'apt-1001',
    occurredAt: '2026-09-04T18:00:00.000Z',
    meetUrl: '',
    recordingUrl: '',
    transcript: '',
    googleEventId: '',
    payload: {},
    airtableTouchId: '',
    airtableDebriefId: '',
    airtableSyncedAt: null,
    airtableSyncError: null,
    ...overrides,
  };
}

describe('overlayCallsOnProfile', () => {
  it('fills an empty Meet URL from a booked call that arrived through Supabase', () => {
    const overlaid = overlayCallsOnProfile(profile(), [
      call({ meetUrl: 'https://meet.google.com/aaa-bbbb-ccc' }),
    ]);
    expect(overlaid.lead.googleMeetUrl).toBe('https://meet.google.com/aaa-bbbb-ccc');
    expect(overlaid.incomingCall?.meetUrl).toBe('https://meet.google.com/aaa-bbbb-ccc');
    expect(overlaid.incomingCall?.source).toBe('ghl');
  });

  it('does not replace a recording Airtable already has', () => {
    const existing = mapDebriefRecord({
      id: 'recDebrief0000001',
      fields: {
        'Recording Link': 'https://drive.google.com/file/d/airtable',
        Transcript: '',
      },
    });
    const overlaid = overlayCallsOnProfile(profile({ debriefs: [existing] }), [
      call({
        kind: 'audit',
        airtableDebriefId: 'recDebrief0000001',
        recordingUrl: 'https://drive.google.com/file/d/supabase',
        transcript: 'hello from supabase',
      }),
    ]);
    expect(overlaid.debriefs[0].recordingLink).toBe('https://drive.google.com/file/d/airtable');
    expect(overlaid.debriefs[0].transcript).toBe('hello from supabase');
  });

  it('flags a pending Airtable send when a row has no sync stamp or has an error', () => {
    const pending = overlayCallsOnProfile(profile(), [call({ meetUrl: 'https://meet.google.com/x' })]);
    expect(pending.pendingAirtableSend).toBe(true);

    const failed = overlayCallsOnProfile(profile(), [
      call({
        meetUrl: 'https://meet.google.com/x',
        airtableSyncedAt: '2026-09-04T18:01:00.000Z',
        airtableSyncError: 'Airtable 422',
      }),
    ]);
    expect(failed.pendingAirtableSend).toBe(true);

    const sent = overlayCallsOnProfile(profile(), [
      call({
        meetUrl: 'https://meet.google.com/x',
        airtableSyncedAt: '2026-09-04T18:01:00.000Z',
      }),
    ]);
    expect(sent.pendingAirtableSend).toBe(false);
  });
});

describe('recordingPrefillFrom', () => {
  it('prefers an existing Airtable recording, then incoming recording, then Meet', () => {
    expect(
      recordingPrefillFrom(
        { meetUrl: 'https://meet.google.com/x', recordingUrl: 'https://drive.google.com/a', transcript: '', occurredAt: '', source: 'ghl', synced: false },
        'https://meet.google.com/lead',
        'https://drive.google.com/existing',
      ),
    ).toBe('https://drive.google.com/existing');
    expect(
      recordingPrefillFrom(
        { meetUrl: 'https://meet.google.com/x', recordingUrl: 'https://drive.google.com/a', transcript: '', occurredAt: '', source: 'ghl', synced: false },
        'https://meet.google.com/lead',
        '',
      ),
    ).toBe('https://drive.google.com/a');
    expect(
      recordingPrefillFrom(
        { meetUrl: 'https://meet.google.com/x', recordingUrl: '', transcript: '', occurredAt: '', source: 'calendar', synced: true },
        'https://meet.google.com/lead',
        '',
      ),
    ).toBe('https://meet.google.com/x');
  });
});
