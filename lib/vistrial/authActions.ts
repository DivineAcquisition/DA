'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { teamUrl } from '@/lib/team/url';

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function hubSignInAction(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/vistrial', 'layout');
  redirect('/vistrial');
}

export async function hubSignOutAction(): Promise<void> {
  const supabase = await createClient();
  // Signing out ends any View As session first, so none outlives the sign-in.
  await controlRpc(supabase, 'end_impersonation', {});
  await supabase.auth.signOut();
  revalidatePath('/vistrial', 'layout');
  redirect('/vistrial');
}

/**
 * Sends a password reset link. The link returns to team.divineacquisition.io,
 * whichever address the request came from. The answer is the same whether or
 * not the email has an account, so the form cannot be used to probe for one.
 */
export async function hubResetRequestAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter the email you sign in with.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: teamUrl('/vistrial/auth/callback', '?next=/reset-password'),
  });
  return { ok: true };
}

/** Sets a new password for the session the reset link opened. */
export async function hubSetPasswordAction(formData: FormData): Promise<AuthResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 12) return { ok: false, error: 'Use at least 12 characters.' };
  if (password !== confirm) return { ok: false, error: 'The two passwords do not match.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/vistrial', 'layout');
  redirect('/vistrial');
}
