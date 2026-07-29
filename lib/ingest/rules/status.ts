import type { IngestEvent, IngestStatus } from '../types';

/**
 * What an ingestion state means, and what it asks of an admin.
 *
 * The point of storing an unattributable or unhandled delivery is that somebody
 * acts on it. A status nobody can read is only marginally better than a dropped
 * payload, so each one carries the sentence that says what to do next.
 */

export const INGEST_STATUS_LABELS: Record<IngestStatus, string> = {
  received: 'Awaiting processing',
  processed: 'Processed',
  unattributed: 'No client',
  unknown_type: 'No handler',
  failed: 'Failed',
};

/** Highest first, so the queue leads with the thing that costs money. */
export const ATTENTION_RANK: Record<IngestStatus, number> = {
  failed: 4,
  unattributed: 3,
  unknown_type: 2,
  received: 1,
  processed: 0,
};

export function needsAttention(status: IngestStatus): boolean {
  return status === 'failed' || status === 'unattributed' || status === 'unknown_type';
}

/** The remedy, not the diagnosis. Each of these is a different admin action. */
export function whatToDo(event: Pick<IngestEvent, 'status' | 'account_ref' | 'event_type'>): string {
  switch (event.status) {
    case 'unattributed':
      return event.account_ref
        ? `Map the sending account ${event.account_ref} to a client, and every event queued behind it is processed.`
        : 'The payload named no account. Attribute this delivery to a client by hand.';
    case 'unknown_type':
      return `Nothing handles ${event.event_type ?? 'this type'} yet. Usually a workflow was added without one. Add the handler, then replay.`;
    case 'failed':
      return 'The payload is on record. Fix the cause and replay it.';
    case 'received':
      return 'Logged and queued. It processes within a minute even if nothing else touches it.';
    case 'processed':
      return 'Nothing to do.';
  }
}

export function sortByAttention<T extends { status: IngestStatus; received_at: string }>(
  events: T[],
): T[] {
  return [...events].sort((a, b) => {
    const rank = ATTENTION_RANK[b.status] - ATTENTION_RANK[a.status];
    if (rank !== 0) return rank;
    return b.received_at.localeCompare(a.received_at);
  });
}

/**
 * Whether a door has gone quiet.
 *
 * Silence is the failure mode nobody notices: a broken workflow produces no
 * error, just an absence, and the client's dashboard keeps showing last week's
 * numbers as though they were current. A door that has never delivered is not
 * yet silent — it was only just opened.
 */
export const QUIET_AFTER_HOURS = 24;

export function isQuiet(
  lastEventAt: string | null,
  nowMs: number,
  quietAfterHours = QUIET_AFTER_HOURS,
): boolean {
  if (!lastEventAt) return false;
  return nowMs - new Date(lastEventAt).getTime() > quietAfterHours * 3600_000;
}
