import { NextResponse } from 'next/server';
import { parseSalesReview, salesReviewNote } from '@/lib/acq/sales-review';
import { recordSalesReviewLead } from '@/lib/go/contact';
import { SOURCE_TAGS, TAGS } from '@/lib/ghl/tags';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = parseSalesReview(body);
  if (!parsed.ok) {
    if (parsed.error === 'honeypot') return NextResponse.json({ ok: true });
    return NextResponse.json({ ok: false, error: parsed.error, field: parsed.field }, { status: 400 });
  }

  try {
    await recordSalesReviewLead({
      firstName: parsed.lead.firstName,
      email: parsed.lead.email,
      phone: parsed.lead.phone,
      company: parsed.lead.company,
      note: salesReviewNote(parsed.lead),
      tags: [SOURCE_TAGS.salesOperations, TAGS.smsConsent],
    });
  } catch (error) {
    console.error('sales operations review', error);
    return NextResponse.json(
      { ok: false, error: 'We could not send that request. Try again in a moment.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
