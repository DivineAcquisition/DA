'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { ok: true } | { ok: false; error: string };

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const hostHeader = h.get('host') || 'training.divineacquisition.io';
  const hostname = hostHeader.split(':')[0];
  const proto = h.get('x-forwarded-proto') || (hostname === 'localhost' || hostname === '127.0.0.1' ? 'http' : 'https');
  return `${proto}://${hostHeader}`;
}

export async function academySignInAction(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/academy', 'layout');
  redirect('/academy');
}

export async function academySignOutAction(): Promise<void> {
  const supabase = await createClient();
  await controlRpc(supabase, 'end_impersonation', {});
  await supabase.auth.signOut();
  revalidatePath('/academy', 'layout');
  redirect('/academy');
}

/**
 * The reset link returns to this host. Supabase only honors it when the
 * training callback is on the project's redirect allow-list.
 */
export async function academyResetAction(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Enter the email you sign in with.' };
  const supabase = await createClient();
  const origin = await requestOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/academy/auth/callback?next=${encodeURIComponent('/academy')}`,
  });
  return { ok: true };
}
