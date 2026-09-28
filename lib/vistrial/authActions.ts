'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

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
