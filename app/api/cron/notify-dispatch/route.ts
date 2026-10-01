import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { RESEND_CC, RESEND_REPLY_TO } from '@/lib/assessment/config';
import { buildTeamEmail, type MailMessage } from '@/lib/team/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Claimed = {
  from_name: string;
  from_address: string;
  reply_to: string | null;
  base_url: string;
  messages: MailMessage[];
};

type Attempt = { notification_id: string; channel: string; status: 'delivered' | 'failed' | 'skipped'; detail: string };

/**
 * Vercel Cron (every 5 minutes): emails VA notifications from
 * notify.divineacquisition.io through Resend. Immediate messages go at once;
 * normal ones are batched into one digest per VA during their working hours
 * (the database decides both). Every attempt, success or failure, is recorded
 * in notification_attempt. Discord and WhatsApp are recognised but not built,
 * so a VA who prefers them gets email, and that is recorded too.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  const resendKey = process.env.RESEND_API_KEY?.trim() || '';
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required' }, { status: 500 });
  }
  // Without a sender, nothing is claimed: messages wait instead of being lost.
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY is not set; nothing claimed' }, { status: 503 });
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Replies must reach a person, never a no-reply address. Order: the address an
  // admin set in Team settings, then TEAM_REPLY_TO, then the monitored address the
  // other Resend senders already use (RESEND_REPLY_TO, then the first RESEND_CC).
  const { data: setting } = await supabase.from('team_setting').select('reply_to').eq('id', 1).maybeSingle();
  const replyTo =
    (setting?.reply_to as string | null) ||
    process.env.TEAM_REPLY_TO?.trim() ||
    RESEND_REPLY_TO ||
    RESEND_CC[0] ||
    '';
  if (!replyTo) {
    return NextResponse.json({ ok: false, error: 'No monitored reply-to address is set; nothing claimed' }, { status: 503 });
  }

  const { data, error } = await supabase.rpc('notify_claim_emails', { p_limit: 100 });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const claimed = data as Claimed;

  const resend = new Resend(resendKey);
  const from = `${claimed.from_name} <${claimed.from_address}>`;
  const attempts: Attempt[] = [];
  let sent = 0;

  for (const message of claimed.messages) {
    const ids = message.items.map((item) => item.id);
    const preferred = message.preferred_channel ?? 'email';
    if (preferred === 'discord' || preferred === 'whatsapp') {
      for (const id of ids) {
        attempts.push({ notification_id: id, channel: preferred, status: 'skipped', detail: `${preferred} is not connected yet; sent by email instead` });
      }
    }
    try {
      const mail = buildTeamEmail(message, claimed.base_url);
      const result = await resend.emails.send({
        from,
        to: [message.to],
        replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (result.error) throw new Error(result.error.message);
      sent += 1;
      for (const id of ids) {
        attempts.push({
          notification_id: id,
          channel: 'email',
          status: 'delivered',
          detail: `${message.kind === 'digest' ? 'Daily digest' : 'Sent'} via Resend${result.data?.id ? ` (${result.data.id})` : ''}`,
        });
      }
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Send failed';
      for (const id of ids) attempts.push({ notification_id: id, channel: 'email', status: 'failed', detail });
    }
  }

  if (attempts.length > 0) {
    const { error: recordError } = await supabase.rpc('notify_record_attempts', { p_attempts: attempts });
    if (recordError) return NextResponse.json({ ok: false, error: recordError.message, sent }, { status: 500 });
  }

  return NextResponse.json({ ok: true, messages: claimed.messages.length, sent, attempts: attempts.length });
}
