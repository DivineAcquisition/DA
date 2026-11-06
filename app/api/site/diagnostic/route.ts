import { NextResponse } from 'next/server';

import { parseDiagnosticRequest } from '@/lib/site/forms';
import { diagnosticBookingConfigured, recordDiagnosticRequest } from '@/lib/site/inquiry';

export const dynamic = 'force-dynamic';

/** Sales Operations Diagnostic request from divineacquisition.io/diagnostic. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = parseDiagnosticRequest(body);
  if (!parsed.ok) {
    // Bots fill the hidden field. They get a quiet success and nothing is stored.
    if (parsed.error === 'honeypot') return NextResponse.json({ ok: true, inquiryId: null, booking: false });
    return NextResponse.json(parsed, { status: 400 });
  }

  const recorded = await recordDiagnosticRequest(parsed.value);
  if (!recorded.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not submit your request just now. Please try again in a moment, or email malik@divineacquisition.io.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    inquiryId: recorded.inquiryId,
    booking: diagnosticBookingConfigured(),
  });
}
