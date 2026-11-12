'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail } from '@/lib/email/service';
import { createClient } from '@/lib/supabase/server';
import { serviceRoleClient } from '@/lib/workspace/db';
import { resolveStripeKey } from '@/lib/stripe/connection';
import { chargeWeek } from './stripe-charge';
import { clientTotal, operatorEarnings, operatorStatement, round2, weekLabel, weeklyReceipt, type WeekData, type WeekEntry } from './week';
import { loadWeekCharge } from './week-data';

export type WeekChargeInput = {
  placementId: string;
  week: string;
  hours: Record<string, number>;
  hourlyRate: number | null;
  operatorPay: number;
  commission: number;
  managementFee: number;
  note: string;
};

export type WeekChargeResult = { ok: true; message: string } | { ok: false; error: string };

function finite(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function save(input: WeekChargeInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const pay = finite(input.operatorPay);
  const commission = finite(input.commission ?? 0);
  const fee = finite(input.managementFee);
  if (pay == null || pay < 0) return { ok: false, error: 'Enter the week’s pay.' };
  if (commission == null || commission < 0) return { ok: false, error: 'Enter the commission, or 0.' };
  if (fee == null || fee < 0) return { ok: false, error: 'Enter the management fee.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'so_week_charge_save', {
    p_placement_id: input.placementId,
    p_week: input.week,
    p_days: Object.entries(input.hours ?? {}).map(([date, hours]) => ({ date, hours: finite(hours) ?? 0 })),
    p_hourly_rate: input.hourlyRate == null ? null : finite(input.hourlyRate),
    p_operator_pay: round2(pay),
    p_commission: round2(commission),
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
  return { ok: true, message: 'Saved.' };
}

/** The saved week, as the emails read it. */
function entryFrom(data: WeekData): WeekEntry | null {
  const charge = data.charge;
  if (!charge) return null;
  return {
    hours: Object.fromEntries(charge.days.map((day) => [day.date, Number(day.hours) || 0])),
    hourlyRate: charge.hourly_rate == null ? null : Number(charge.hourly_rate),
    operatorPay: Number(charge.operator_pay) || 0,
    commission: Number(charge.commission) || 0,
    managementFee: Number(charge.management_fee) || 0,
    note: charge.note ?? '',
  };
}

/** The signed-in admin who sends, copied on both emails. Their real login, never an account they are viewing as. */
async function adminCopy(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.trim().toLowerCase() ?? '';
  return email.includes('@') ? email : null;
}

function withCopy(list: string[], copy: string | null, exclude: string[]): string[] {
  const out = new Set(list.map((email) => email.toLowerCase()));
  if (copy) out.add(copy);
  for (const email of exclude) out.delete(email.toLowerCase());
  return [...out];
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** Save, then load the week back through the admin-checked function. */
async function savedWeek(input: WeekChargeInput): Promise<{ ok: true; data: WeekData; entry: WeekEntry } | { ok: false; error: string }> {
  const saved = await save(input);
  if (!saved.ok) return saved;
  const loaded = await loadWeekCharge(input.placementId, input.week);
  const data = loaded.data;
  if (!data?.placement || !data.charge) return { ok: false, error: loaded.error ?? 'The week did not load.' };
  return { ok: true, data, entry: entryFrom(data)! };
}

/**
 * Charge the client's card on file for the week (pay + commission + the
 * management fee), then email the receipt. A charged week is not charged
 * again; sending again only resends the receipt.
 */
export async function chargeAndSendClientAction(input: WeekChargeInput): Promise<WeekChargeResult> {
  const week = await savedWeek(input);
  if (!week.ok) return week;
  const { data, entry } = week;
  const charge = data.charge!;
  const admin = serviceRoleClient();
  if (!admin) return { ok: false, error: 'The server is missing its database key (SUPABASE_SERVICE_ROLE_KEY).' };

  const to = data.recipients.to ?? [];
  const cc = withCopy(data.recipients.cc ?? [], await adminCopy(), to);
  if (to.length === 0) return { ok: false, error: 'This client has no email on file. Add a contact email to the client, then send.' };

  const total = clientTotal(entry);
  let charged = charge.charged_at
    ? { amount: Number(charge.charged_amount ?? total), at: charge.charged_at, invoiceUrl: charge.stripe_invoice_url }
    : null;

  if (!charged && total > 0) {
    const { data: customer } = await admin.rpc('week_charge_stripe_customer', { p_charge_id: charge.id });
    if (typeof customer !== 'string' || !customer) {
      return { ok: false, error: 'This client is not linked to a Stripe customer, so there is no card to charge.' };
    }
    const stripeKey = await resolveStripeKey();
    if (!stripeKey) return { ok: false, error: 'Stripe is not connected: STRIPE_SECRET_KEY is not set on the server. See Account, Stripe.' };
    const weekText = weekLabel(data.week_start, data.week_end);
    const operator = data.placement!.operator_name;
    const result = await chargeWeek({
      apiKey: stripeKey.key,
      customerId: customer,
      chargeId: charge.id,
      fingerprint: fingerprint({ total, pay: entry.operatorPay, commission: entry.commission, fee: entry.managementFee }),
      description: `Divine Acquisition: ${operator}, Sales Operator, week of ${weekText}`,
      lines: [
        { description: `${operator}, Sales Operator pay: ${weekText}`, amountCents: Math.round(entry.operatorPay * 100) },
        { description: `Commission earnings: ${weekText}`, amountCents: Math.round(entry.commission * 100) },
        { description: `Divine Acquisition management fee: ${weekText}`, amountCents: Math.round(entry.managementFee * 100) },
      ],
      existingInvoiceId: charge.stripe_invoice_id,
      metadata: { weekly_charge_id: charge.id, placement_id: data.placement!.id, week_start: data.week_start },
    });
    if (!result.ok) {
      await admin
        .from('weekly_charge')
        .update({ stripe_invoice_id: result.invoiceId, stripe_status: result.status, charge_error: result.error.slice(0, 1000) })
        .eq('id', charge.id);
      revalidatePath('/workspace/billing');
      return { ok: false, error: `The card was not charged: ${result.error} The receipt was not sent.` };
    }
    const at = new Date().toISOString();
    charged = { amount: round2(result.amountPaid / 100), at, invoiceUrl: result.hostedUrl };
    await admin
      .from('weekly_charge')
      .update({
        stripe_invoice_id: result.invoiceId,
        stripe_status: result.status,
        stripe_invoice_url: result.hostedUrl,
        charged_amount: charged.amount,
        charged_at: at,
        charge_error: null,
      })
      .eq('id', charge.id);
  }

  const receipt = weeklyReceipt(data, entry, charged);
  const result = await sendAppEmail({
    purpose: 'client',
    to,
    cc,
    subject: receipt.subject,
    html: receipt.html,
    text: receipt.text,
    template: 'client.weekly_receipt',
    idempotencyKey: idempotencyKey(['weekly-charge', charge.id, fingerprint({ entry, to, cc, charged, days: data.days.map((day) => [day.date, day.status, day.wins]) })]),
    event: 'client.weekly_receipt',
    related: { placementId: data.placement!.id, relatedType: 'weekly_charge', relatedId: charge.id },
    payload: { weekStart: data.week_start, total, charged: Boolean(charged) },
  });

  revalidatePath('/workspace/billing');
  const chargedText = charged ? `Charged ${money2(charged.amount)}. ` : '';
  if (!result.ok && result.status !== 'queued') {
    return { ok: false, error: `${chargedText}The receipt email did not send: ${result.error ?? result.status}. Try sending again; the card will not be charged twice.` };
  }
  await admin
    .from('weekly_charge')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_to: to,
      sent_cc: cc,
      send_count: (charge.send_count ?? 0) + 1,
      email_log_id: result.logId,
    })
    .eq('id', charge.id);
  return { ok: true, message: `${chargedText}Receipt ${result.status === 'queued' ? 'queued' : 'sent'} to ${to.join(', ')}${cc.length ? `, copied to ${cc.join(', ')}` : ''}.` };
}

/** Email the operator their pay: hours and pay per shift, and commission if any. Never the fee or the client total. */
export async function sendOperatorStatementAction(input: WeekChargeInput): Promise<WeekChargeResult> {
  const week = await savedWeek(input);
  if (!week.ok) return week;
  const { data, entry } = week;
  const charge = data.charge!;
  const to = data.placement!.operator_email;
  if (!to) return { ok: false, error: 'This operator has no email on file.' };

  const statement = operatorStatement(data, entry);
  const cc = withCopy([], await adminCopy(), [to]);
  const result = await sendAppEmail({
    purpose: 'team',
    to,
    cc,
    subject: statement.subject,
    html: statement.html,
    text: statement.text,
    template: 'operator.pay_statement',
    idempotencyKey: idempotencyKey(['operator-pay', charge.id, fingerprint({ hours: entry.hours, pay: entry.operatorPay, commission: entry.commission, to, cc })]),
    event: 'operator.pay_statement',
    related: { placementId: data.placement!.id, relatedType: 'weekly_charge', relatedId: charge.id },
    payload: { weekStart: data.week_start, earned: operatorEarnings(entry) },
  });
  if (!result.ok && result.status !== 'queued') {
    return { ok: false, error: `The pay statement did not send: ${result.error ?? result.status}` };
  }
  const admin = serviceRoleClient();
  if (admin) {
    await admin
      .from('weekly_charge')
      .update({
        operator_sent_at: new Date().toISOString(),
        operator_sent_to: to,
        operator_send_count: (charge.operator_send_count ?? 0) + 1,
        operator_email_log_id: result.logId,
      })
      .eq('id', charge.id);
  }
  revalidatePath('/workspace/billing');
  return { ok: true, message: `Pay statement ${result.status === 'queued' ? 'queued' : 'sent'} to ${to}${cc.length ? `, copied to ${cc.join(', ')}` : ''}.` };
}

function money2(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
