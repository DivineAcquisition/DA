import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { sendGhlSms } from '@/lib/acq/ghl-sms';
import { sendAcqAuditEmail, type AcqEmailKind } from '@/lib/acq/schedule-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DueReminder = {
  id: string;
  kind: 'sms' | 'email_24h' | 'email_2h';
  email: string;
  phone: string;
  full_name: string;
  coaching_niche: string;
  scheduled_for: string;
  time_zone: string;
  meet_url: string | null;
  ghl_contact_id: string | null;
};

/**
 * Email at 24 hours and 2 hours, and a GHL SMS 15 minutes before an audit.
 * Authenticated with CRON_SECRET. Runs every 5 minutes.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'service role key is required' }, { status: 500 });
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc('claim_due_acq_reminders', { p_limit: 20 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const due = (Array.isArray(data) ? data : []) as DueReminder[];
  const results: { id: string; kind: string; ok: boolean; error?: string }[] = [];

  for (const row of due) {
    try {
      if (row.kind === 'sms') {
        if (!row.ghl_contact_id) throw new Error('missing GoHighLevel contact');
        const when = row.meet_url ? ` Join: ${row.meet_url}` : ' Check your email for the meeting link.';
        await sendGhlSms(
          row.ghl_contact_id,
          `Divine Acquisition: your audit starts in 15 minutes.${when}`,
        );
      } else {
        const kind: AcqEmailKind = row.kind === 'email_24h' ? 'reminder_24h' : 'reminder_2h';
        await sendAcqAuditEmail({
          to: row.email,
          fullName: row.full_name,
          offer: row.coaching_niche,
          startsAt: row.scheduled_for,
          timeZone: row.time_zone || 'America/New_York',
          meetUrl: row.meet_url,
          kind,
        });
      }
      results.push({ id: row.id, kind: row.kind, ok: true });
    } catch (sendError) {
      await supabase.rpc('release_acq_reminder', { p_id: row.id, p_kind: row.kind });
      results.push({
        id: row.id,
        kind: row.kind,
        ok: false,
        error: sendError instanceof Error ? sendError.message : 'send failed',
      });
    }
  }

  return NextResponse.json({ ok: true, claimed: due.length, results });
}
