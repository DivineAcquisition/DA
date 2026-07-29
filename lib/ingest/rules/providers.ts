import type { IngestProvider } from '../types';

/**
 * How each provider presents its credential.
 *
 * Verification itself happens in Postgres, because that is where the secret
 * lives: ingest_receive() compares a digest or recomputes the HMAC, and the key
 * never reaches the application. What is left for this side is reading the
 * request — which header carries what, and whether a signed timestamp is recent
 * enough to be worth checking at all.
 */

/** The path segment each provider is configured against, and what it means. */
const PROVIDER_BY_SLUG: Record<string, IngestProvider> = {
  ghl: 'gohighlevel',
  gohighlevel: 'gohighlevel',
  payments: 'payments',
};

export function parseProviderSlug(slug: string): IngestProvider | null {
  return PROVIDER_BY_SLUG[slug.toLowerCase()] ?? null;
}

/**
 * GoHighLevel workflows post a static value in a header, so both spellings are
 * accepted: a bare header for a webhook step and a bearer token for anything
 * configured as an authenticated request.
 *
 * The payment processor signs the body and puts the digest and the timestamp it
 * signed with in one header.
 */
const SECRET_HEADERS = ['x-vistrial-secret', 'x-webhook-secret'];
const SIGNATURE_HEADERS = ['stripe-signature', 'x-vistrial-signature', 'x-signature'];

export type Credential = {
  /** Present for a shared-secret door. */
  secret: string | null;
  /** Present for a signed door, lower-cased hex. */
  signature: string | null;
  /** The timestamp the signature covers, when the provider signs one. */
  signedAt: string | null;
};

/**
 * Signature headers come in two shapes: a bare hex digest, or the comma-separated
 * `t=<unix>,v1=<hex>` form. Anything else yields nothing rather than a partial
 * guess, so an unrecognised header is refused at the door instead of being
 * checked against a value assembled by hope.
 */
export function parseSignatureHeader(raw: string | null | undefined): {
  signature: string;
  signedAt: string | null;
} | null {
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;

  if (!value.includes('=')) {
    return /^[0-9a-f]+$/i.test(value) ? { signature: value.toLowerCase(), signedAt: null } : null;
  }

  const parts = new Map<string, string>();
  for (const pair of value.split(',')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    // A header may carry several signatures during a secret rotation. The first
    // of each name is used; Postgres compares against the one current secret.
    if (name && !parts.has(name)) parts.set(name, pair.slice(index + 1).trim());
  }

  const signature = parts.get('v1') ?? parts.get('v0') ?? parts.get('sha256');
  if (!signature || !/^[0-9a-f]+$/i.test(signature)) return null;

  const signedAt = parts.get('t') ?? null;
  return {
    signature: signature.toLowerCase(),
    signedAt: signedAt && /^\d+$/.test(signedAt) ? signedAt : null,
  };
}

export function readCredential(provider: IngestProvider, headers: Headers): Credential {
  let secret: string | null = null;

  for (const name of SECRET_HEADERS) {
    const value = headers.get(name);
    if (value && value.trim()) {
      secret = value.trim();
      break;
    }
  }

  if (!secret) {
    const authorization = headers.get('authorization');
    const bearer = authorization?.match(/^Bearer\s+(.+)$/i);
    if (bearer) secret = bearer[1].trim();
  }

  let parsed: { signature: string; signedAt: string | null } | null = null;
  for (const name of SIGNATURE_HEADERS) {
    parsed = parseSignatureHeader(headers.get(name));
    if (parsed) break;
  }

  // The provider is not asked to pick: whichever credential arrived is passed
  // through, and the door's configured auth_mode decides which one counts.
  void provider;

  return {
    secret,
    signature: parsed?.signature ?? null,
    signedAt: parsed?.signedAt ?? null,
  };
}

/**
 * A signature covers "<timestamp>.<body>", which stops it being lifted off one
 * request and replayed on another — but only if the timestamp is checked. Five
 * minutes is enough for a slow delivery and short enough that a captured request
 * is no longer useful.
 */
export const MAX_SIGNATURE_AGE_SECONDS = 300;

export function isSignatureFresh(
  signedAt: string | null,
  nowMs: number,
  maxAgeSeconds = MAX_SIGNATURE_AGE_SECONDS,
): boolean {
  // A provider that signs no timestamp cannot be checked for age. That is a
  // property of the provider, not a failure, so it passes here and the signature
  // itself still has to verify.
  if (!signedAt) return true;

  const seconds = Number(signedAt);
  if (!Number.isFinite(seconds)) return false;

  const skew = Math.abs(nowMs / 1000 - seconds);
  return skew <= maxAgeSeconds;
}

/**
 * Which headers are worth keeping on the event. The whole set is not: it carries
 * cookies and the credential itself, and the delivery log is read by managers.
 */
const RECORDED_HEADERS = [
  'content-type',
  'user-agent',
  'x-request-id',
  'x-forwarded-for',
  'x-vistrial-event',
];

export function recordableHeaders(headers: Headers): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const name of RECORDED_HEADERS) {
    const value = headers.get(name);
    if (value) kept[name] = value;
  }
  return kept;
}
