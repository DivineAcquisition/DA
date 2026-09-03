import { after } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { inboundRecordInput, parseInboundCall } from '@/lib/calls/inbound';
import { receiveProspectCall, readPipelineCallSecret } from '@/lib/calls/store';
import { sendProspectCallToAirtable } from '@/lib/calls/sync';
import { serviceClient } from '@/lib/workspace/db';

export const dynamic = 'force-dynamic';

/**
 * GHL / calendar call door.
 *
 * Call data lands in Supabase first (da_prospect_call), then this route
 * forwards it to DA Pipeline Airtable. Contact-only events are ignored.
 *
 * Auth: DA_PIPELINE_CALL_WEBHOOK_SECRET, or da_settings.pipeline_call_webhook_secret
 * when the env var is empty. Header x-webhook-secret / x-pipeline-call-secret /
 * Authorization Bearer / ?secret=.
 */
function providedSecret(request: Request): string {
  const header =
    request.headers.get('x-pipeline-call-secret') ??
    request.headers.get('x-webhook-secret') ??
    request.headers.get('x-ghl-secret') ??
    '';
  if (header.trim()) return header.trim();
  const auth = request.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  try {
    return new URL(request.url).searchParams.get('secret')?.trim() ?? '';
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const supabase = serviceClient();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabase || !serviceKey) {
    return Response.json({ error: 'not configured' }, { status: 503 });
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

  const { data: logId } = await controlRpc<string>(supabase, 'da_log_webhook_payload', {
    p_payload: payload,
    p_headers: headerEntries,
  });

  const envSecret = process.env.DA_PIPELINE_CALL_WEBHOOK_SECRET?.trim() ?? '';
  const settingsSecret = (await readPipelineCallSecret()).trim();
  const expected = envSecret || settingsSecret;
  const provided = providedSecret(request);

  if (!expected || !provided || provided !== expected) {
    return Response.json({ error: 'unauthorized', logId }, { status: 401 });
  }

  const parsed = parseInboundCall(payload);
  if (!parsed.ok) {
    if (parsed.reason === 'ignored') {
      return Response.json({ ok: true, ignored: true, reason: parsed.error, logId }, { status: 200 });
    }
    return Response.json({ error: parsed.error, logId }, { status: 400 });
  }

  let saved;
  try {
    saved = await receiveProspectCall(provided, inboundRecordInput(parsed.call), supabase);
  } catch (error) {
    console.error('pipeline_call_receive', error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : 'Could not receive the call in Supabase.',
        logId,
      },
      { status: 503 },
    );
  }

  after(() =>
    sendProspectCallToAirtable(saved, true).catch((error) => {
      console.error('pipeline_call_airtable', saved.id, error);
    }),
  );

  return Response.json(
    { received: true, id: saved.id, kind: saved.kind, logId },
    { status: 202 },
  );
}

export async function GET() {
  return Response.json({ listening: true }, { status: 200 });
}
