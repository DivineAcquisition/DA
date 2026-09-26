// DocuSeal webhook door.
//
// Order matters, and each step is deliberate:
//   1. Log the raw payload before anything reads it, so a crash further down
//      never loses what DocuSeal sent.
//   2. Verify X-Docuseal-Signature against da_settings.docuseal_webhook_secret.
//      A failure is rejected with 401 and stays in the log, unprocessed, with
//      the reason: a record of anything trying to forge a request.
//   3. Hand the verified event to da_process_docuseal_event(), which finds the
//      agreement by SUBMISSION id and only ever moves its status forward.
//
// Once the payload is logged and verified, every outcome answers 200, errors
// included. A retry cannot fix a data mismatch; a person reading the logged
// error can.
//
// Signing, per DocuSeal's source (lib/webhook_urls/signatures.rb):
//   X-Docuseal-Signature: <unix seconds>.<hex HMAC-SHA256(secret, "<ts>.<raw body>")>
// with a five-minute tolerance either side.

import { createClient } from 'npm:@supabase/supabase-js@2';

const TOLERANCE_SECONDS = 5 * 60;

// Only these headers are kept. DocuSeal can also send a custom secret header
// the account owner names, and that must never reach the log.
const LOGGED_HEADERS = [
  'content-type',
  'content-length',
  'user-agent',
  'x-docuseal-signature',
  'x-forwarded-for',
  'x-real-ip',
];

type Json = Record<string, unknown>;

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  secret: string,
  rawBody: string,
  header: string | null,
): Promise<string | null> {
  if (!secret) return 'no webhook secret is configured in da_settings';
  if (!header) return 'missing X-Docuseal-Signature header';

  const dot = header.indexOf('.');
  const ts = Number(header.slice(0, dot));
  const provided = header.slice(dot + 1).trim().toLowerCase();
  if (dot < 1 || !Number.isInteger(ts) || !provided) return 'malformed X-Docuseal-Signature header';

  const now = Math.floor(Date.now() / 1000);
  if (ts < now - TOLERANCE_SECONDS) return 'signature timestamp is too old';
  if (ts > now + TOLERANCE_SECONDS) return 'signature timestamp is in the future';

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = toHex(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${rawBody}`)),
  );
  return timingSafeEqual(expected, provided) ? null : 'signature does not match';
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/** Pull what the agreement needs out of a verified DocuSeal event. */
function readEvent(payload: Json) {
  const eventType = str(payload.event_type) ?? '';
  const data = (payload.data ?? {}) as Json;
  const submission = (data.submission ?? {}) as Json;
  const documents = Array.isArray(data.documents) ? (data.documents as Json[]) : [];
  const firstDocUrl = str(documents.find((d) => str(d?.url))?.url);

  const isForm = eventType.startsWith('form.');
  const isSubmission = eventType.startsWith('submission.');

  // form.* carries a submitter: its own id is the SIGNER, the submission is
  // data.submission_id. submission.* carries the submission as data.
  const submissionId = isForm
    ? str(data.submission_id) ?? str(submission.id)
    : isSubmission
      ? str(data.id)
      : null;

  const eventAt =
    (eventType === 'form.viewed' || eventType === 'form.started'
      ? str(data.opened_at)
      : eventType === 'form.completed' || eventType === 'submission.completed'
        ? str(data.completed_at)
        : eventType === 'form.declined'
          ? str(data.declined_at)
          : null) ?? str(payload.timestamp);

  const submissionCompleted = isForm
    ? str(submission.status) === 'completed'
    : eventType === 'submission.completed';

  const signedDocumentUrl = isForm
    ? str(submission.combined_document_url) ?? firstDocUrl
    : str(data.combined_document_url) ?? firstDocUrl;

  const auditLogUrl = isForm ? str(submission.audit_log_url) ?? str(data.audit_log_url) : str(data.audit_log_url);

  return { eventType, submissionId, eventAt, submissionCompleted, signedDocumentUrl, auditLogUrl };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const rawBody = await req.text();
  let payload: Json;
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Json) : {};
  } catch {
    payload = { raw: rawBody };
  }

  const headers: Record<string, string> = {};
  for (const name of LOGGED_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers[name] = value;
  }

  // 1. Log first.
  const logged = await supabase.rpc('da_log_webhook_payload', {
    p_payload: payload,
    p_headers: headers,
  });
  if (logged.error || !logged.data) {
    // Nothing is recorded, so ask DocuSeal to retry rather than lose it.
    console.error('[docuseal-webhook] could not log payload', logged.error?.message);
    return json({ error: 'could not record the webhook' }, 500);
  }
  const logId = logged.data as string;

  const markLog = (processed: boolean, error: string | null) =>
    supabase.rpc('da_mark_webhook_log', { p_log_id: logId, p_processed: processed, p_error: error });

  // 2. Verify.
  const secret = await supabase.rpc('da_get_webhook_secret');
  const failure = await verifySignature(
    secret.error ? '' : String(secret.data ?? '').trim(),
    rawBody,
    req.headers.get('x-docuseal-signature'),
  );
  if (failure) {
    await markLog(false, `signature verification failed: ${failure}`);
    return json({ error: 'unauthorized', logId }, 401);
  }

  // 3. Apply. Any failure from here is recorded and still answered with 200.
  try {
    if (typeof payload.raw === 'string') {
      await markLog(false, 'payload is not JSON');
      return json({ ok: false, logId });
    }

    const event = readEvent(payload);
    const result = await supabase.rpc('da_process_docuseal_event', {
      p_log_id: logId,
      p_event_type: event.eventType,
      p_submission_id: event.submissionId,
      p_event_at: event.eventAt,
      p_submission_completed: event.submissionCompleted,
      p_signed_document_url: event.signedDocumentUrl,
      p_audit_log_url: event.auditLogUrl,
    });
    if (result.error) throw new Error(result.error.message);

    return json({ ok: true, outcome: result.data, logId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markLog(false, `processing failed: ${message}`);
    return json({ ok: false, logId });
  }
});
