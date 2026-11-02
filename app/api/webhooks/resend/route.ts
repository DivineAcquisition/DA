import { NextResponse } from 'next/server';
import { ingestResendEvent } from '@/lib/email/ingest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Resend delivery events. The signing secret is RESEND_WEBHOOK_SECRET. */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'RESEND_WEBHOOK_SECRET is not set' }, { status: 503 });
  }
  const payload = await request.text();
  const headers = {
    id: request.headers.get('svix-id') || request.headers.get('webhook-id') || '',
    timestamp: request.headers.get('svix-timestamp') || request.headers.get('webhook-timestamp') || '',
    signature: request.headers.get('svix-signature') || request.headers.get('webhook-signature') || '',
  };
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return NextResponse.json({ ok: false, error: 'Missing signature' }, { status: 400 });
  }
  let event: { type?: string; data?: unknown };
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY?.trim() || 're_webhook_verify');
    event = resend.webhooks.verify({ payload, headers, webhookSecret: secret }) as { type?: string; data?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 });
  }
  const result = await ingestResendEvent(headers.id, event);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
