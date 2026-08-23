import { NextResponse } from 'next/server';
import { submitLead } from '@/lib/acq/submit-lead';
import type { QualificationInput } from '@/lib/acq/qualify';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: QualificationInput;
  try {
    body = (await request.json()) as QualificationInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const host = request.headers.get('host') ?? undefined;
  const result = await submitLead(body, host);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
