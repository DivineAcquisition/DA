'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, workspaceClient } from './db';
import { sendOnboardingEmail } from './email';
import { VA_SALES_OPERATOR_ONBOARDING_KEY } from './onboarding-protocol';
import { publicOnboardingUrl } from './paths';
import { signingPublicBaseUrl } from './resolve-signing';
import { createToken } from './tokens';
import type { ActionResult } from './types';

/**
 * Starts Sales Operator onboarding for one operator recipient. A pending run is
 * reused. The form opens immediately; the placement agreement stays its own step.
 */
export async function startSalesOperatorOnboardingAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const recipientId = String(formData.get('recipient_id') ?? '').trim();
  const sendEmail = formData.get('send_email') === 'on';
  if (!recipientId) return { ok: false, error: 'Choose an operator.' };

  const { data: recipient, error: recipientError } = await supabase
    .from('da_recipient')
    .select('id, full_name, email, recipient_type')
    .eq('id', recipientId)
    .maybeSingle();
  if (recipientError || !recipient) return { ok: false, error: 'That operator could not be found.' };
  if (recipient.recipient_type !== 'operator') {
    return { ok: false, error: 'Onboarding starts for a sales operator, not a client.' };
  }

  const { data: settings } = await supabase.from('da_settings').select('public_base_url').eq('id', 1).maybeSingle();
  const base = signingPublicBaseUrl(settings?.public_base_url);

  const { data: pending, error: pendingError } = await supabase
    .from('da_onboarding_submission')
    .select('id, access_token')
    .eq('recipient_id', recipientId)
    .eq('protocol_key', VA_SALES_OPERATOR_ONBOARDING_KEY)
    .eq('status', 'pending')
    .maybeSingle();
  if (pendingError) return { ok: false, error: pendingError.message };

  let token = pending?.access_token ? String(pending.access_token) : '';
  let reused = false;
  if (pending?.id) {
    reused = true;
    const { error } = await supabase
      .from('da_onboarding_submission')
      .update({ agreement_id: null })
      .eq('id', pending.id);
    if (error) return { ok: false, error: error.message };
  } else {
    token = createToken(32);
    const { error } = await supabase.from('da_onboarding_submission').insert({
      protocol_key: VA_SALES_OPERATOR_ONBOARDING_KEY,
      recipient_id: recipientId,
      access_token: token,
      status: 'pending',
    });
    if (error) return { ok: false, error: error.message };
  }

  const url = publicOnboardingUrl(base, token);
  if (sendEmail) {
    try {
      await sendOnboardingEmail({ to: recipient.email, recipientName: recipient.full_name, url });
    } catch (error) {
      revalidatePath('/workspace/onboarding');
      return {
        ok: false,
        error: error instanceof Error ? `Onboarding is ready, but the email failed: ${error.message} Link: ${url}` : `Email failed. Link: ${url}`,
      };
    }
  }

  revalidatePath('/workspace/onboarding');
  revalidatePath(`/workspace/recipients/${recipientId}`);
  return {
    ok: true,
    message: reused
      ? `Onboarding is already open for ${recipient.full_name}. The form is ready now.`
      : `Onboarding started for ${recipient.full_name}.`,
    data: { url, emailed: sendEmail },
  };
}
