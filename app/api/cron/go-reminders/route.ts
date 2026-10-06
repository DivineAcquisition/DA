import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { sendGhlSms } from '@/lib/acq/ghl-sms';
import { upsertStrategyContact } from '@/lib/go/contact';
import {
  formatSessionWhen,
  goReminderSms,
  sendGoSessionEmail,
  type GoEmailKind,
  type GoSmsKind,
} from '@/lib/go/reminders';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DueReminder = {
  id: string;
  kind: 'email_24h' | 'sms_24h' | 'email_2h' | 'sms_2h' | 'sms_15m';
  email: string;
  phone: string;
  full_name: string;
  scheduled_for: string;
  time_zone: string;
  meet_url: string | null;
  ghl_contact_id: string | null;
};

/**
 * Cleaning-funnel reminders: email and SMS at 24 hours and 2 hours,
 * and an SMS 15 minutes before with the Google Meet link.
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
  const { data, error } = await supabase.rpc('claim_due_go_reminders', { p_limit: 20 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const due = (Array.isArray(data) ? data : []) as DueReminder[];
  const results: { id: string; kind: string; ok: boolean; error?: string }[] = [];

  for (const row of due) {
    try {
      if (row.kind.startsWith('email_')) {
        const kind: GoEmailKind = row.kind === 'email_24h' ? 'reminder_24h' : 'reminder_2h';
        await sendGoSessionEmail({
          to: row.email,
          fullName: row.full_name,
          startsAt: row.scheduled_for,
          timeZone: row.time_zone || 'America/New_York',
          meetUrl: row.meet_url,
          kind,
          bookingId: row.id,
        });
      } else {
        let contactId = row.ghl_contact_id;
        if (!contactId) {
          contactId = await upsertStrategyContact({
            fullName: row.full_name,
            email: row.email,
            phone: row.phone,
          });
          await supabase.rpc('go_attach_strategy_booking', {
            p_id: row.id,
            p_ghl_contact_id: contactId,
          });
        }
        const when = formatSessionWhen(row.scheduled_for, row.time_zone || 'America/New_York');
        await sendGhlSms(
          contactId,
          goReminderSms({ kind: row.kind as GoSmsKind, when, meetUrl: row.meet_url }),
        );
      }
      results.push({ id: row.id, kind: row.kind, ok: true });
    } catch (sendError) {
      await supabase.rpc('release_go_reminder', { p_id: row.id, p_kind: row.kind });
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
