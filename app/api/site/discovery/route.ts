import { NextResponse } from 'next/server';

import { parseDiscovery } from '@/lib/site/forms';
import { recordDiscovery } from '@/lib/site/inquiry';

export const dynamic = 'force-dynamic';

/** Pre-discovery questionnaire from divineacquisition.io/discovery. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = parseDiscovery(body);
  if (!parsed.ok) {
    if (parsed.error === 'honeypot') return NextResponse.json({ ok: true });
    return NextResponse.json(parsed, { status: 400 });
  }

  const recorded = await recordDiscovery(parsed.value);
  if (!recorded.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not submit your answers just now. Please try again in a moment, or email malik@divineacquisition.io.',
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
