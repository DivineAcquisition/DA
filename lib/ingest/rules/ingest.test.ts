import { describe, expect, it } from 'vitest';
import type { IngestEvent, RollupEnvelope } from '../types';
import { orGap, readFreshness } from './freshness';
import {
  isSignatureFresh,
  MAX_SIGNATURE_AGE_SECONDS,
  parseProviderSlug,
  parseSignatureHeader,
  readCredential,
  recordableHeaders,
} from './providers';
import {
  ATTENTION_RANK,
  INGEST_STATUS_LABELS,
  isQuiet,
  needsAttention,
  sortByAttention,
  whatToDo,
} from './status';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = Date.parse('2026-07-29T12:00:00.000Z');

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

let eventSeq = 0;
function event(overrides: Partial<IngestEvent> = {}): IngestEvent {
  eventSeq += 1;
  return {
    id: `ev-${eventSeq}`,
    provider: 'gohighlevel',
    endpoint_id: 'door-1',
    dedupe_key: `wh-${eventSeq}`,
    external_event_id: `wh-${eventSeq}`,
    raw_body: '{"type":"ContactCreate"}',
    payload: { type: 'ContactCreate' },
    event_type: 'ContactCreate',
    account_ref: 'loc-1',
    case_file_id: 'cf-1',
    status: 'processed',
    handler: 'ingest_handle_lead',
    error: null,
    attempts: 1,
    received_at: '2026-07-29T11:00:00.000Z',
    processed_at: '2026-07-29T11:00:01.000Z',
    replayed_at: null,
    ...overrides,
  };
}

function envelope<T>(overrides: Partial<RollupEnvelope<T>> = {}): RollupEnvelope<T> {
  return {
    key: 'cross_client',
    payload: null,
    computed_at: '2026-07-29T11:55:00.000Z',
    fresh_for_seconds: 900,
    age_seconds: 300,
    stale: false,
    never_computed: false,
    last_error: null,
    last_error_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Which door was knocked on
// ---------------------------------------------------------------------------

describe('provider slugs', () => {
  it('accepts the short form the workflow URL uses and the long form', () => {
    expect(parseProviderSlug('ghl')).toBe('gohighlevel');
    expect(parseProviderSlug('GoHighLevel')).toBe('gohighlevel');
    expect(parseProviderSlug('payments')).toBe('payments');
  });

  it('refuses anything else rather than defaulting to a provider', () => {
    // Guessing here would let a request be checked against the wrong door's
    // credential rules.
    expect(parseProviderSlug('stripe')).toBeNull();
    expect(parseProviderSlug('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reading the credential
//
// Verification happens in Postgres, where the secret is. These tests cover the
// part that decides what is even handed over to be verified.
// ---------------------------------------------------------------------------

describe('signature headers', () => {
  it('reads a bare hex digest', () => {
    expect(parseSignatureHeader('AABBCC')).toEqual({ signature: 'aabbcc', signedAt: null });
  });

  it('reads the timestamped form and keeps the timestamp the digest covers', () => {
    expect(parseSignatureHeader('t=1780000000,v1=deadbeef')).toEqual({
      signature: 'deadbeef',
      signedAt: '1780000000',
    });
  });

  it('takes the first signature when a rotation sends two', () => {
    const parsed = parseSignatureHeader('t=1780000000,v1=aaaa,v1=bbbb');
    expect(parsed?.signature).toBe('aaaa');
  });

  it('falls back through the scheme names a processor might use', () => {
    expect(parseSignatureHeader('t=1,v0=abc')?.signature).toBe('abc');
    expect(parseSignatureHeader('sha256=abc')?.signature).toBe('abc');
  });

  it('returns nothing for a header it cannot read, rather than a partial guess', () => {
    // A half-understood header would be checked against a digest assembled from
    // hope, which is worse than refusing at the door.
    expect(parseSignatureHeader('v1=not-hex')).toBeNull();
    expect(parseSignatureHeader('garbage')).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });

  it('ignores a timestamp that is not a timestamp but keeps the signature', () => {
    expect(parseSignatureHeader('t=soon,v1=abcd')).toEqual({ signature: 'abcd', signedAt: null });
  });
});

describe('reading a request', () => {
  it('takes a GoHighLevel secret from either header spelling', () => {
    expect(readCredential('gohighlevel', headers({ 'x-vistrial-secret': ' s3cret ' })).secret).toBe('s3cret');
    expect(readCredential('gohighlevel', headers({ 'x-webhook-secret': 's3cret' })).secret).toBe('s3cret');
  });

  it('takes a bearer token, for a workflow configured as an authenticated request', () => {
    expect(readCredential('gohighlevel', headers({ authorization: 'Bearer s3cret' })).secret).toBe('s3cret');
  });

  it('prefers the explicit header over the bearer token', () => {
    const credential = readCredential(
      'gohighlevel',
      headers({ 'x-vistrial-secret': 'explicit', authorization: 'Bearer bearer' }),
    );
    expect(credential.secret).toBe('explicit');
  });

  it('reads a processor signature and the timestamp it signed', () => {
    const credential = readCredential('payments', headers({ 'stripe-signature': 't=1780000000,v1=abcd' }));
    expect(credential).toEqual({ secret: null, signature: 'abcd', signedAt: '1780000000' });
  });

  it('reports nothing when nothing was presented', () => {
    expect(readCredential('gohighlevel', headers({}))).toEqual({
      secret: null,
      signature: null,
      signedAt: null,
    });
  });
});

describe('signature age', () => {
  it('accepts a signature from moments ago', () => {
    expect(isSignatureFresh(String(NOW / 1000 - 30), NOW)).toBe(true);
  });

  it('refuses one old enough to have been captured and replayed', () => {
    expect(isSignatureFresh(String(NOW / 1000 - MAX_SIGNATURE_AGE_SECONDS - 1), NOW)).toBe(false);
  });

  it('accepts a clock that runs slightly fast', () => {
    expect(isSignatureFresh(String(NOW / 1000 + 60), NOW)).toBe(true);
  });

  it('lets a provider that signs no timestamp through, because there is nothing to check', () => {
    // The signature itself still has to verify in Postgres; this is only about
    // age, and absence of a timestamp is a property of the provider.
    expect(isSignatureFresh(null, NOW)).toBe(true);
  });

  it('refuses a timestamp that is not a number', () => {
    expect(isSignatureFresh('soon', NOW)).toBe(false);
  });
});

describe('what gets logged with the delivery', () => {
  it('keeps the diagnostic headers', () => {
    const kept = recordableHeaders(
      headers({ 'content-type': 'application/json', 'user-agent': 'GHL/1.0' }),
    );
    expect(kept).toEqual({ 'content-type': 'application/json', 'user-agent': 'GHL/1.0' });
  });

  it('does not keep the credential or the cookies', () => {
    // The delivery log is readable by a manager inside their scope, so it must not
    // become a place secrets are stored in the clear.
    const kept = recordableHeaders(
      headers({
        'x-vistrial-secret': 's3cret',
        authorization: 'Bearer s3cret',
        'stripe-signature': 't=1,v1=abc',
        cookie: 'session=abc',
        'content-type': 'application/json',
      }),
    );
    expect(kept).toEqual({ 'content-type': 'application/json' });
  });
});

// ---------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------

describe('ingestion states', () => {
  it('names the three states that need somebody', () => {
    expect(needsAttention('failed')).toBe(true);
    expect(needsAttention('unattributed')).toBe(true);
    expect(needsAttention('unknown_type')).toBe(true);
  });

  it('does not treat a queued delivery as a problem', () => {
    // It processes within a minute whether or not anybody looks at it.
    expect(needsAttention('received')).toBe(false);
    expect(needsAttention('processed')).toBe(false);
  });

  it('has a label for every state', () => {
    for (const status of ['received', 'processed', 'unattributed', 'unknown_type', 'failed'] as const) {
      expect(INGEST_STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it('leads with failures, then unattributed, then unhandled types', () => {
    expect(ATTENTION_RANK.failed).toBeGreaterThan(ATTENTION_RANK.unattributed);
    expect(ATTENTION_RANK.unattributed).toBeGreaterThan(ATTENTION_RANK.unknown_type);
    expect(ATTENTION_RANK.unknown_type).toBeGreaterThan(ATTENTION_RANK.received);
    expect(ATTENTION_RANK.received).toBeGreaterThan(ATTENTION_RANK.processed);
  });

  it('sorts a mixed queue by what costs money first, then by most recent', () => {
    const queue = sortByAttention([
      event({ status: 'processed', received_at: '2026-07-29T11:00:00.000Z' }),
      event({ status: 'unknown_type', received_at: '2026-07-29T09:00:00.000Z' }),
      event({ status: 'failed', received_at: '2026-07-29T08:00:00.000Z' }),
      event({ status: 'unattributed', received_at: '2026-07-29T10:00:00.000Z' }),
      event({ status: 'unattributed', received_at: '2026-07-29T10:30:00.000Z' }),
    ]);

    expect(queue.map((item) => item.status)).toEqual([
      'failed',
      'unattributed',
      'unattributed',
      'unknown_type',
      'processed',
    ]);
    expect(queue[1].received_at).toBe('2026-07-29T10:30:00.000Z');
  });

  it('does not mutate the queue it was given', () => {
    const original = [event({ status: 'processed' }), event({ status: 'failed' })];
    const before = original.map((item) => item.id);
    sortByAttention(original);
    expect(original.map((item) => item.id)).toEqual(before);
  });
});

describe('what to do about it', () => {
  it('points an unattributed event at the account mapping that would clear it', () => {
    const advice = whatToDo(event({ status: 'unattributed', account_ref: 'loc-999' }));
    expect(advice).toContain('loc-999');
  });

  it('asks for a hand attribution when the payload named no account at all', () => {
    const advice = whatToDo(event({ status: 'unattributed', account_ref: null }));
    expect(advice).toContain('by hand');
  });

  it('names the type that has no handler', () => {
    expect(whatToDo(event({ status: 'unknown_type', event_type: 'NewThing' }))).toContain('NewThing');
  });

  it('says the payload survived a failure, because that is the point of logging first', () => {
    expect(whatToDo(event({ status: 'failed' }))).toContain('on record');
  });
});

describe('a door going quiet', () => {
  it('flags one that has stopped delivering', () => {
    // A broken workflow produces no error, only an absence, and the client's
    // dashboard keeps showing last week's numbers as though they were current.
    expect(isQuiet('2026-07-27T12:00:00.000Z', NOW)).toBe(true);
  });

  it('does not flag one that delivered this morning', () => {
    expect(isQuiet('2026-07-29T06:00:00.000Z', NOW)).toBe(false);
  });

  it('does not call a door that has never delivered quiet', () => {
    // It was only just opened. Nothing has had a chance to arrive.
    expect(isQuiet(null, NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reading a cached figure
// ---------------------------------------------------------------------------

describe('rollup freshness', () => {
  it('reports a recent rollup as current, and says how recent', () => {
    const freshness = readFreshness(envelope({ age_seconds: 240 }), NOW);
    expect(freshness.stale).toBe(false);
    expect(freshness.label).toBe('Computed 4 minutes ago');
  });

  it('says a rollup that has never run knows nothing', () => {
    // Distinctly not "0 clients". A missing cache is not an empty result.
    const freshness = readFreshness(envelope({ never_computed: true, computed_at: null }), NOW);
    expect(freshness.neverComputed).toBe(true);
    expect(freshness.stale).toBe(true);
    expect(freshness.label).toBe('Not computed yet');
  });

  it('treats a missing envelope the same way', () => {
    expect(readFreshness(null, NOW).neverComputed).toBe(true);
  });

  it('says so when the value is past its window', () => {
    const freshness = readFreshness(envelope({ stale: true, age_seconds: 7200 }), NOW);
    expect(freshness.stale).toBe(true);
    expect(freshness.label).toBe('Stale — computed 2 hours ago');
  });

  it('separates "old" from "the refresh is failing"', () => {
    // Both are stale, but only one of them is going to keep getting worse.
    const freshness = readFreshness(
      envelope({ stale: true, age_seconds: 3600, last_error: 'statement timeout' }),
      NOW,
    );
    expect(freshness.failing).toBe(true);
    expect(freshness.label).toContain('the last refresh failed');
  });

  it('reports a failing refresh as stale even while inside its freshness window', () => {
    const freshness = readFreshness(envelope({ stale: false, last_error: 'boom' }), NOW);
    expect(freshness.stale).toBe(true);
  });

  it('falls back to the reader clock when the database did not send an age', () => {
    const freshness = readFreshness(
      envelope({ age_seconds: null, computed_at: '2026-07-29T11:00:00.000Z' }),
      NOW,
    );
    expect(freshness.ageSeconds).toBe(3600);
  });

  it('describes ages across the scales an admin actually sees', () => {
    expect(readFreshness(envelope({ age_seconds: 5 }), NOW).label).toBe('Computed moments ago');
    expect(readFreshness(envelope({ age_seconds: 60 }), NOW).label).toBe('Computed 1 minute ago');
    expect(readFreshness(envelope({ stale: true, age_seconds: 172800 }), NOW).label).toBe(
      'Stale — computed 2 days ago',
    );
  });
});

describe('a gap is not a zero', () => {
  it('renders a figure that was never measured as a gap', () => {
    expect(orGap(null, (value) => `${value}`)).toBe('—');
    expect(orGap(undefined, (value) => `${value}`)).toBe('—');
  });

  it('renders a measured zero as zero, because that is a different statement', () => {
    expect(orGap(0, (value) => `${value}`)).toBe('0');
  });
});
