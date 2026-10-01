import { createClient } from '@/lib/supabase/server';

export type MfaState = 'ok' | 'enroll' | 'challenge';

/**
 * The admin app requires a second factor on every account. A session counts
 * only once it is at aal2: an account with no verified factor enrols one, an
 * account with one is challenged for it. ADMIN_MFA_REQUIRED=false turns this
 * off for local development only.
 */
export async function adminMfaState(): Promise<{ state: MfaState; factorId: string | null }> {
  if (process.env.ADMIN_MFA_REQUIRED === 'false' && process.env.NODE_ENV !== 'production') return { state: 'ok', factorId: null };
  const supabase = await createClient();
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.currentLevel === 'aal2') return { state: 'ok', factorId: null };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).find((f) => f.status === 'verified');
  return verified ? { state: 'challenge', factorId: verified.id } : { state: 'enroll', factorId: null };
}
