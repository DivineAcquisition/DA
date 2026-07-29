import type { RollupEnvelope } from '../types';

/**
 * Reading a cached figure.
 *
 * Section 5: a cache is a performance decision and never a correctness one, so
 * when a rollup is stale the interface says so rather than showing a wrong number
 * confidently. That only holds if every read produces the sentence as well as the
 * value, which is what this does.
 */

export type Freshness = {
  stale: boolean;
  neverComputed: boolean;
  ageSeconds: number | null;
  /** The sentence to put next to the figures. */
  label: string;
  /** Whether the last refresh failed, so the value is old for a known reason. */
  failing: boolean;
};

function ago(seconds: number): string {
  if (seconds < 60) return 'moments ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function readFreshness<T>(envelope: RollupEnvelope<T> | null, nowMs: number): Freshness {
  if (!envelope || envelope.never_computed || !envelope.computed_at) {
    return {
      stale: true,
      neverComputed: true,
      ageSeconds: null,
      // Not "0 clients". A rollup that has never run knows nothing, and saying so
      // is different from reporting an empty result.
      label: 'Not computed yet',
      failing: false,
    };
  }

  // Trust the clock the value was written by, not the one the envelope was read
  // with: age_seconds is computed in the same transaction as computed_at.
  const ageSeconds =
    envelope.age_seconds ??
    Math.max(0, Math.round((nowMs - new Date(envelope.computed_at).getTime()) / 1000));

  const failing = Boolean(envelope.last_error);

  if (failing) {
    return {
      stale: true,
      neverComputed: false,
      ageSeconds,
      label: `Stale — the last refresh failed, showing figures from ${ago(ageSeconds)}`,
      failing: true,
    };
  }

  if (envelope.stale) {
    return {
      stale: true,
      neverComputed: false,
      ageSeconds,
      label: `Stale — computed ${ago(ageSeconds)}`,
      failing: false,
    };
  }

  return {
    stale: false,
    neverComputed: false,
    ageSeconds,
    label: `Computed ${ago(ageSeconds)}`,
    failing: false,
  };
}

/**
 * A gap and a zero mean different things, so a figure that was never measured is
 * rendered as an em dash rather than as 0. Section 11 requires this of reports;
 * it is just as true of a dashboard.
 */
export function orGap(value: number | null | undefined, format: (value: number) => string): string {
  return value === null || value === undefined ? '—' : format(value);
}
