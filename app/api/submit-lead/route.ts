import { NextResponse } from 'next/server';
import { submitLead, type LeadRequestMeta } from '@/lib/acq/submit-lead';
import type { QualificationInput } from '@/lib/acq/qualify';

export const dynamic = 'force-dynamic';

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip')?.trim() || undefined;
}

export async function POST(request: Request) {
  let body: QualificationInput & LeadRequestMeta;
  try {
    body = (await request.json()) as QualificationInput & LeadRequestMeta;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const host = request.headers.get('host') ?? undefined;
  const meta: LeadRequestMeta = {
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent') || undefined,
    eventSourceUrl: clip(body.eventSourceUrl, 500),
    fbp: clip(body.fbp, 200),
    fbc: clip(body.fbc, 300),
  };
  const result = await submitLead(body, host, meta);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
