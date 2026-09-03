import type { IncomingCall, LeadProfile, ProspectCall } from './types';

function latestIncoming(calls: ProspectCall[]): IncomingCall | null {
  const ranked = [...calls].sort((a, b) => {
    const at = a.occurredAt || a.id;
    const bt = b.occurredAt || b.id;
    return bt.localeCompare(at);
  });
  for (const call of ranked) {
    if (!call.meetUrl && !call.recordingUrl && !call.transcript) continue;
    return {
      meetUrl: call.meetUrl,
      recordingUrl: call.recordingUrl,
      transcript: call.transcript,
      occurredAt: call.occurredAt,
      source: call.source,
      synced: Boolean(call.airtableSyncedAt) && !call.airtableSyncError,
    };
  }
  return null;
}

/**
 * CRM fields stay live from Airtable. Call artifacts that arrived through
 * Supabase fill empty Meet / recording / transcript slots rather than replacing
 * what Airtable already has.
 */
export function overlayCallsOnProfile(profile: LeadProfile, calls: ProspectCall[]): LeadProfile {
  const incomingCall = latestIncoming(calls);
  const lead = { ...profile.lead };
  if (!lead.googleMeetUrl && incomingCall?.meetUrl) {
    lead.googleMeetUrl = incomingCall.meetUrl;
  }

  const debriefs = profile.debriefs.map((debrief) => {
    const match = calls.find((call) => call.airtableDebriefId === debrief.recordId);
    if (!match) return debrief;
    return {
      ...debrief,
      recordingLink: debrief.recordingLink || match.recordingUrl || match.meetUrl,
      transcript: debrief.transcript || match.transcript,
    };
  });

  const touches = profile.touches.map((touch) => {
    const match = calls.find((call) => call.airtableTouchId === touch.recordId);
    if (!match) return touch;
    return {
      ...touch,
      recordingLink: touch.recordingLink || match.recordingUrl || match.meetUrl,
      transcript: touch.transcript || match.transcript,
    };
  });

  return {
    ...profile,
    lead,
    touches,
    debriefs,
    incomingCall,
    pendingAirtableSend: calls.some((call) => !call.airtableSyncedAt || Boolean(call.airtableSyncError)),
  };
}

export function recordingPrefillFrom(
  incoming?: IncomingCall | null,
  leadMeetUrl = '',
  existing = '',
): string {
  return existing || incoming?.recordingUrl || incoming?.meetUrl || leadMeetUrl || '';
}
