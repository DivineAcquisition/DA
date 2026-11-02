'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { sendRecoveryEmail } from '@/lib/email/recovery';
import { newPasswordError, passwordResetEmailError, type PasswordResult } from './password';

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const hostHeader = (h.get('x-forwarded-host') || h.get('host') || 'localhost').split(',')[0]?.trim() || 'localhost';
  const hostname = hostHeader.split(':')[0];
  const proto = h.get('x-forwarded-proto') || (hostname === 'localhost' || hostname === '127.0.0.1' ? 'http' : 'https');
  return `${proto}://${hostHeader}`;
}

/**
 * Sends a reset link and gives the same answer whether or not the address has
 * an account. `callbackPath` is chosen by the surface, never by the form.
 * The message goes out through Resend. Supabase only mints the one-time link.
 */
export async function sendPasswordReset(formData: FormData, callbackPath: string): Promise<PasswordResult> {
  const email = String(formData.get('email') ?? '').trim();
  const invalid = passwordResetEmailError(email);
  if (invalid) return { ok: false, error: invalid };
  if (!callbackPath.startsWith('/') || callbackPath.startsWith('//')) {
    return { ok: false, error: 'Enter the email you sign in with.' };
  }
  const origin = await requestOrigin();
  return sendRecoveryEmail({ email, redirectTo: `${origin}${callbackPath}` });
}

/** Saves the password from a recovery session, then opens that surface's home. */
export async function saveNewPassword(formData: FormData, nextPath: string): Promise<PasswordResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const invalid = newPasswordError(password, confirm);
  if (invalid) return { ok: false, error: invalid };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'That link has expired. Request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  revalidatePath(nextPath, 'layout');
  redirect(nextPath);
}

const callback = (prefix: string) => `${prefix}/auth/callback?next=${encodeURIComponent(`${prefix}/reset-password`)}`;

export async function requestDaReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/da'));
}
export async function saveDaPassword(formData: FormData) {
  return saveNewPassword(formData, '/da');
}

export async function requestCallsReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/calls'));
}
export async function saveCallsPassword(formData: FormData) {
  return saveNewPassword(formData, '/calls');
}

export async function requestAdReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/ad'));
}
export async function saveAdPassword(formData: FormData) {
  return saveNewPassword(formData, '/ad');
}

export async function requestAdminReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/admin'));
}
export async function saveAdminPassword(formData: FormData) {
  return saveNewPassword(formData, '/admin');
}

export async function requestAcctReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/acct'));
}
export async function saveAcctPassword(formData: FormData) {
  return saveNewPassword(formData, '/acct');
}

export async function requestAcademyReset(formData: FormData) {
  return sendPasswordReset(formData, callback('/academy'));
}
export async function saveAcademyPassword(formData: FormData) {
  return saveNewPassword(formData, '/academy');
}
