'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { inApp } from '@/lib/academy/comms';
import { createClient } from '@/lib/supabase/server';

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function academySignInAction(formData: FormData): Promise<AuthResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error) {
    const wrong = /invalid login credentials/i.test(error.message);
    return { ok: false, error: wrong ? inApp.signIn.wrongLogin : error.message };
  }
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

