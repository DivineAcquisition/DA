import { after } from 'next/server';
import { processDelivery, receiveDelivery } from '@/lib/ingest/receive';
import {
  isSignatureFresh,
  parseProviderSlug,
  readCredential,
  recordableHeaders,
} from '@/lib/ingest/rules/providers';

/**
 * The machine doors: /api/webhooks/ghl/<key> and /api/webhooks/payments/<key>.
 *
 * The key in the path is the public half of the door's credential. It says which
 * door was knocked on so the secret to check against can be found before the body
 * is parsed; the secret or signature itself arrives in a header and is verified in
 * Postgres, where it lives.
 *
 * The order below is the ingestion contract:
 *
 *   receive  authenticates, writes the raw body, deduplicates, and returns
 *   respond  202, immediately — a slow acknowledgement triggers a retry storm
 *   after()  processes
 *
 * Nothing is lost if the last step never runs. The delivery is already logged, so
 * cron drains anything still queued a minute later.
 */

export const dynamic = 'force-dynamic';

// The body has to be read as text, not JSON: a signature covers the exact bytes
// that were sent, and re-serialising a parsed object would not reproduce them.
// It is also the only way a payload that is not JSON can still be logged.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string; key: string }> },
) {
  const { provider: slug, key } = await params;

  const provider = parseProviderSlug(slug);
  if (!provider) {
    return Response.json({ error: 'unknown_provider' }, { status: 404 });
  }

  const body = await request.text();
  const credential = readCredential(provider, request.headers);

  if (!credential.secret && !credential.signature) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  // A signature covers "<timestamp>.<body>". Checking the age here means a request
  // captured off the wire stops being useful after five minutes, and it costs no
  // database round trip to refuse one.
  if (!isSignatureFresh(credential.signedAt, Date.now())) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  let outcome;
  try {
    outcome = await receiveDelivery({
      endpointKey: key,
      body,
      credential,
      headers: recordableHeaders(request.headers),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: request.headers.get('user-agent'),
    });
  } catch (error) {
    // The database could not be reached. This is the one case that must not
    // acknowledge: a 5xx is what makes the provider retry, and a retry is how the
    // delivery survives. Acknowledging here would lose it silently.
    console.error('ingest_receive', slug, error);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }

  if (!outcome.ok) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  if (outcome.processToken) {
    const { eventId, processToken } = outcome;
    after(() => processDelivery(eventId, processToken));
  }

  return Response.json(
    { received: true, event_id: outcome.eventId, duplicate: outcome.duplicate },
    { status: 202 },
  );
}

/**
 * Providers verify a URL before they will save it, and some send a GET to do so.
 * Answering without the credential would confirm that a key exists, so this says
 * only that something is listening.
 */
export async function GET() {
  return Response.json({ listening: true }, { status: 200 });
}
