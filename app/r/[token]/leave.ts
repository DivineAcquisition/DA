'use server';

import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

export async function leaveFeedback(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'so_report_leave', {
    p_token: token,
    p_rating: Number(formData.get('rating')),
    p_working: String(formData.get('working') ?? ''),
    p_change: String(formData.get('change') ?? ''),
    p_inaccurate: String(formData.get('inaccurate') ?? '') === 'yes',
    p_note: String(formData.get('note') ?? ''),
    p_name: String(formData.get('name') ?? ''),
  });
  const message = readable(error);
  if (error) redirect(`/r/${token}?error=${encodeURIComponent(message || 'That note did not send.')}`);
  redirect(`/r/${token}?thanks=1`);
}
