import { NextResponse } from 'next/server';

import { parsePodcastRequest } from '@/lib/site/forms';
import { podcastCalendarUrl, recordPodcastRequest } from '@/lib/site/inquiry';

export const dynamic = 'force-dynamic';

/** A podcast listener's 1-on-1 request from divineacquisition.io/biv/pod. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = parsePodcastRequest(body);
  if (!parsed.ok) {
    // Bots fill the hidden field. They get a quiet success and nothing is stored.
    if (parsed.error === 'honeypot') return NextResponse.json({ ok: true, inquiryId: null, booking: false });
    return NextResponse.json(parsed, { status: 400 });
  }

  const recorded = await recordPodcastRequest(parsed.value);
  if (!recorded.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'We could not submit your request just now. Please try again in a moment, or email malik@divineacquisition.io.',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, inquiryId: recorded.inquiryId, booking: Boolean(podcastCalendarUrl()) });
}
