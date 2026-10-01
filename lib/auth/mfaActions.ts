'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type MfaResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** Start enrolling an authenticator app. Any half-finished factor is cleared first. */
export async function adminMfaEnrollAction(): Promise<MfaResult<{ factorId: string; qr: string; secret: string }>> {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Admin ${Date.now()}` });
  if (error || !data) return { ok: false, error: error?.message ?? 'Two-factor setup could not start.' };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

/** Verify a code: finishes enrolment, or lifts this session to aal2. */
export async function adminMfaVerifyAction(factorId: string, code: string): Promise<MfaResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') });
  if (error) return { ok: false, error: 'That code did not match. Use the newest code from your authenticator app.' };
  revalidatePath('/', 'layout');
  return { ok: true };
}
