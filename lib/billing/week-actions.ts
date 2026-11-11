'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail } from '@/lib/email/service';
import { createClient } from '@/lib/supabase/server';
import { serviceRoleClient } from '@/lib/workspace/db';
import { round2, weeklyReceipt, type WeekData, type WeekEntry } from './week';
import { loadWeekCharge } from './week-data';

export type WeekChargeInput = {
  placementId: string;
  week: string;
  hours: Record<string, number>;
  hourlyRate: number | null;
  operatorPay: number;
  managementFee: number;
  note: string;
};

export type WeekChargeResult = { ok: true; message: string; status: 'draft' | 'sent' } | { ok: false; error: string };

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function save(input: WeekChargeInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const pay = finite(input.operatorPay);
  const fee = finite(input.managementFee);
  if (pay == null || pay < 0) return { ok: false, error: 'Enter the week’s pay.' };
  if (fee == null || fee < 0) return { ok: false, error: 'Enter the management fee.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'so_week_charge_save', {
    p_placement_id: input.placementId,
    p_week: input.week,
    p_days: Object.entries(input.hours ?? {}).map(([date, hours]) => ({ date, hours: finite(hours) ?? 0 })),
    p_hourly_rate: input.hourlyRate == null ? null : finite(input.hourlyRate),
    p_operator_pay: round2(pay),
    p_management_fee: round2(fee),
    p_note: String(input.note ?? '').slice(0, 2000),
  });
  if (error) return { ok: false, error: readable(error) };
  return { ok: true };
}

export async function saveWeekChargeAction(input: WeekChargeInput): Promise<WeekChargeResult> {
  const saved = await save(input);
  if (!saved.ok) return saved;
  revalidatePath('/workspace/billing');
  return { ok: true, message: 'Saved.', status: 'draft' };
}

/** The saved week, as the receipt reads it. */
function entryFrom(data: WeekData): WeekEntry | null {
  const charge = data.charge;
  if (!charge) return null;
  return {
    hours: Object.fromEntries(charge.days.map((day) => [day.date, Number(day.hours) || 0])),
    hourlyRate: charge.hourly_rate == null ? null : Number(charge.hourly_rate),
    operatorPay: Number(charge.operator_pay) || 0,
    managementFee: Number(charge.management_fee) || 0,
    note: charge.note ?? '',
  };
}

/** Save the week, then email the client the receipt. Sending the same receipt twice sends it once. */
export async function sendWeekChargeAction(input: WeekChargeInput): Promise<WeekChargeResult> {
  const saved = await save(input);
  if (!saved.ok) return saved;

  const loaded = await loadWeekCharge(input.placementId, input.week);
  const data = loaded.data;
  if (!data?.placement || !data.charge) return { ok: false, error: loaded.error ?? 'The week did not load.' };
  const entry = entryFrom(data)!;
  const to = data.recipients.to ?? [];
  const cc = data.recipients.cc ?? [];
  if (to.length === 0) {
    return { ok: false, error: 'This client has no email on file. Add a contact email to the client, then send.' };
  }

  const receipt = weeklyReceipt(data, entry);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ entry, to, cc, days: data.days.map((day) => [day.date, day.status, day.wins]) }))
    .digest('hex')
    .slice(0, 16);
  const result = await sendAppEmail({
    purpose: 'client',
    to,
    cc,
    subject: receipt.subject,
    html: receipt.html,
    text: receipt.text,
    template: 'client.weekly_receipt',
    idempotencyKey: idempotencyKey(['weekly-charge', data.charge.id, fingerprint]),
    event: 'client.weekly_receipt',
    related: { placementId: data.placement.id, relatedType: 'weekly_charge', relatedId: data.charge.id },
    payload: { weekStart: data.week_start, total: round2(entry.operatorPay + entry.managementFee) },
  });

  if (!result.ok && result.status !== 'queued') {
    return { ok: false, error: result.error ? `The email did not send: ${result.error}` : 'The email did not send.' };
  }

  const admin = serviceRoleClient();
  if (admin) {
    await admin
      .from('weekly_charge')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to: to,
        sent_cc: cc,
        send_count: (data.charge.send_count ?? 0) + 1,
        email_log_id: result.logId,
      })
      .eq('id', data.charge.id);
  }
  revalidatePath('/workspace/billing');
  const where = to.join(', ');
  return {
    ok: true,
    status: 'sent',
    message: result.status === 'queued' ? `Queued for ${where}. It retries on its own.` : `Sent to ${where}.`,
  };
}
