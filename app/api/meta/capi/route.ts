import { NextResponse } from 'next/server';
import { sendRoofingCapi } from '@/lib/acq/meta-capi';
import { isRoofingCapiEvent } from '@/lib/acq/roofing-pixel';

export const dynamic = 'force-dynamic';

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip')?.trim() || undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Browser PageView mirror. Lead and Schedule are sent from the server
 * after a real form or booking, so this route cannot be used to invent them.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const eventName = text(body.eventName, 40) || '';
  const eventId = text(body.eventId, 128) || '';
  if (eventName !== 'PageView' || !isRoofingCapiEvent(eventName) || eventId.length < 8) {
    return NextResponse.json({ ok: false, error: 'Unsupported event.' }, { status: 400 });
  }

  const result = await sendRoofingCapi({
    eventName,
    eventId,
    eventSourceUrl: text(body.eventSourceUrl, 500),
    fbp: text(body.fbp, 200),
    fbc: text(body.fbc, 300),
    fbclid: text(body.fbclid, 200),
    clientIp: clientIp(request),
    userAgent: request.headers.get('user-agent') || undefined,
    customData: { content_name: 'Lead Leak Audit', content_category: 'roofing' },
  });

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
