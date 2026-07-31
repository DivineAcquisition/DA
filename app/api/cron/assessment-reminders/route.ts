import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { sendAssessmentBookingReminderEmail } from '@/lib/assessment/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type DueBooking = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  starts_at: string;
  time_zone: string;
  duration_minutes: number;
  google_meet_url: string | null;
  google_html_link: string | null;
};

/**
 * Vercel Cron (every 5 minutes) claims due assessment bookings and emails the
 * 30-minute reminder. Authenticated with CRON_SECRET.
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
    return NextResponse.json(
      { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is required for reminders' },
      { status: 500 },
    );
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('claim_due_assessment_reminders', { p_limit: 20 });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const due = (Array.isArray(data) ? data : []) as DueBooking[];
  const results: { id: string; email: string; ok: boolean; error?: string }[] = [];

  for (const booking of due) {
    try {
      const sent = await sendAssessmentBookingReminderEmail({
        to: booking.email,
        fullName: booking.full_name,
        companyName: booking.company_name,
        startsAt: booking.starts_at,
        timeZone: booking.time_zone,
        durationMinutes: booking.duration_minutes,
        meetUrl: booking.google_meet_url,
        calendarUrl: booking.google_html_link,
      });

      await supabase.rpc('record_assessment_booking_reminder', {
        p_booking_id: booking.id,
        p_reminder_email_id: sent.id,
      });

      results.push({ id: booking.id, email: booking.email, ok: true });
    } catch (sendError) {
      // Claim stamped reminder_sent_at early; clear it so the next cron can retry.
      await supabase
        .from('assessment_booking')
        .update({ reminder_sent_at: null })
        .eq('id', booking.id);
      results.push({
        id: booking.id,
        email: booking.email,
        ok: false,
        error: sendError instanceof Error ? sendError.message : 'send failed',
      });
    }
  }

  return NextResponse.json({ ok: true, claimed: due.length, results });
}
