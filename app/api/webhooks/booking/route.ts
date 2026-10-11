import { NextResponse } from 'next/server';
import { adaptPayload } from '@/lib/booking-messages/adapt';
import { webhookAuthorized } from '@/lib/booking-messages/auth';
import { readBookingMessageConfig } from '@/lib/booking-messages/config';
import { recordBookingEvent, rejectWebhook } from '@/lib/booking-messages/transport';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Calendar-agnostic booking door. A shared secret or an HMAC of the raw body
 * is required. The same event delivered twice is a no-op.
 */
export async function POST(request: Request) {
  const settings = readBookingMessageConfig();
  const raw = await request.text();
  const secretHeader = request.headers.get('x-booking-secret') ?? '';
  const signatureHeader = request.headers.get('x-booking-signature') ?? '';
  if (!webhookAuthorized({ secretHeader, signatureHeader, body: raw, secret: settings.webhookSecret })) {
    await rejectWebhook(settings.webhookSecret ? 'bad_signature' : 'webhook_secret_missing');
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    await rejectWebhook('invalid_json');
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const adapted = adaptPayload(body);
  if (!adapted.ok) {
    await rejectWebhook(adapted.error);
    return NextResponse.json({ ok: false, error: adapted.error }, { status: 400 });
  }

  const recorded = await recordBookingEvent(adapted.event);
  if (!recorded.ok) {
    return NextResponse.json({ ok: false, error: recorded.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, duplicate: recorded.duplicate, unmatched: recorded.unmatched });
}
