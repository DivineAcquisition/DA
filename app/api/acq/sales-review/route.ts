import { NextResponse } from 'next/server';
import { parseSalesReview, salesReviewNote } from '@/lib/acq/sales-review';
import { recordSalesReviewLead } from '@/lib/go/contact';
import { answersFromNote, captureInquiry } from '@/lib/pipeline/capture';
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

  // Written to the workspace Pipeline and to GHL. Received if either took it.
  const note = salesReviewNote(parsed.lead);
  const [stored, crm] = await Promise.allSettled([
    captureInquiry({
      kind: 'sales_review',
      email: parsed.lead.email,
      fullName: parsed.lead.firstName,
      phone: parsed.lead.phone,
      company: parsed.lead.company,
      answers: answersFromNote(note),
    }),
    recordSalesReviewLead({
      firstName: parsed.lead.firstName,
      email: parsed.lead.email,
      phone: parsed.lead.phone,
      company: parsed.lead.company,
      note,
      tags: [SOURCE_TAGS.salesOperations, TAGS.smsConsent],
    }),
  ]);
  if (stored.status === 'rejected') console.error('sales operations review: pipeline', stored.reason);
  if (crm.status === 'rejected') console.error('sales operations review: ghl', crm.reason);
  if (stored.status === 'rejected' && crm.status === 'rejected') {
    return NextResponse.json(
      { ok: false, error: 'We could not send that request. Try again in a moment.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
