import { NextResponse, type NextRequest } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { mapDocuSealEventToStatus, normalizeValues } from '@/lib/workspace/docuseal';
import { serviceClient } from '@/lib/workspace/db';

export const dynamic = 'force-dynamic';

/**
 * DocuSeal webhook door.
 * Verifies the shared secret from settings, logs every payload, then updates
 * the matching agreement status.
 */
export async function POST(request: NextRequest) {
  const supabase = serviceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: rawBody };
  }

  const headerEntries: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headerEntries[key] = value;
  });

  // Log every payload before processing.
  const { data: logId } = await controlRpc<string>(supabase, 'da_log_webhook_payload', {
    p_payload: payload,
    p_headers: headerEntries,
  });

  const { data: secret } = await controlRpc<string>(supabase, 'da_get_webhook_secret', {});
  const provided =
    request.headers.get('x-docuseal-secret') ??
    request.headers.get('x-webhook-secret') ??
    request.nextUrl.searchParams.get('secret') ??
    '';

  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const event =
    String(payload.event_type ?? payload.event ?? payload.type ?? '').trim() || 'unknown';
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const submissionId = String(
    data.submission_id ?? data.id ?? payload.submission_id ?? '',
  ).trim();

  const documents = (data.documents ?? payload.documents) as Array<{ url?: string }> | undefined;
  const signedUrl = documents?.find((d) => d.url)?.url ?? null;

  const status = mapDocuSealEventToStatus(event);
  if (!submissionId || !status) {
    return NextResponse.json({ ok: true, ignored: true, logId });
  }

  await controlRpc(supabase, 'da_apply_agreement_webhook', {
    p_submission_id: submissionId,
    p_status: status,
    p_signed_document_url: signedUrl,
    p_log_id: logId,
  });

  // What the signer entered becomes the recipient's known profile, which is
  // what the next agreement is auto-mapped from.
  const values = normalizeValues(data.values ?? payload.values);
  if (Object.keys(values).length > 0) {
    await controlRpc(supabase, 'da_apply_agreement_values', {
      p_submission_id: submissionId,
      p_values: values,
    });
  }

  return NextResponse.json({ ok: true, logId });
}
