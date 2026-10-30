import { NextResponse } from 'next/server';
import { cleaningLeadNote, parseCleaningLead } from '@/lib/cleaning/lead';
import { recordCleaningAuditLead } from '@/lib/go/contact';
import { REVENUE_FIT_TAGS, SOURCE_TAGS, SPEND_QUALIFIED_TAGS, TAGS, nicheTag } from '@/lib/ghl/tags';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = parseCleaningLead(body);
  if (!parsed.ok) {
    if (parsed.error === 'honeypot') {
      return NextResponse.json({ ok: true, eventId: crypto.randomUUID() });
    }
    return NextResponse.json({ ok: false, error: parsed.error, field: parsed.field }, { status: 400 });
  }

  const { lead } = parsed;
  const tags = [
    SOURCE_TAGS.cleaning,
    nicheTag('cleaning'),
    TAGS.smsConsent,
    lead.underRevenueFloor ? REVENUE_FIT_TAGS.no : REVENUE_FIT_TAGS.yes,
    lead.adBudget === 'Yes' ? SPEND_QUALIFIED_TAGS.yes : lead.budgetNotYet ? SPEND_QUALIFIED_TAGS.no : '',
  ].filter(Boolean);

  try {
    await recordCleaningAuditLead({
      firstName: lead.firstName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      note: cleaningLeadNote(lead),
      tags,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'We could not submit that just now. Try again in a moment.' },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    eventId: crypto.randomUUID(),
    monthlyRevenue: lead.monthlyRevenue,
    recurringShare: lead.recurringShare,
  });
}
