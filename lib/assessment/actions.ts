'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  createClient,
  getSessionContext,
  supabaseConfigured,
} from '@/lib/supabase/server';
import { bookingLinkForToken } from './config';
import { sendAssessmentInviteEmail } from './email';
import { upsertTalentContact } from './ghl';

type CreatedInvite = {
  id: string;
  token: string;
  email: string;
  full_name: string;
  company_name: string | null;
  expires_at: string;
};

export type AssessmentInviteRow = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  created_at: string;
  expires_at: string;
  opened_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
  last_sent_at: string;
};

export async function sendAssessmentInviteAction(formData: FormData): Promise<ActionResult> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Supabase is not configured on this deploy.' };
  }

  const session = await getSessionContext();
  if (!session?.isAdmin) {
    return { ok: false, error: 'Admin access required.' };
  }

  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const companyName = String(formData.get('companyName') ?? '').trim() || null;
  const note = String(formData.get('note') ?? '').trim() || null;

  if (!fullName || !email) {
    return { ok: false, error: 'Name and email are required.' };
  }

  const supabase = await createClient();
  const { data, error } = await controlRpc<CreatedInvite>(supabase, 'create_assessment_invite', {
    p_email: email,
    p_full_name: fullName,
    p_company_name: companyName,
    p_note: note,
  });

  if (error || !data?.token || !data.id) {
    return { ok: false, error: readable(error) };
  }

  const bookingUrl = bookingLinkForToken(data.token);

  let resendId: string | null = null;
  try {
    const sent = await sendAssessmentInviteEmail({
      to: data.email,
      fullName: data.full_name,
      companyName: data.company_name,
      bookingUrl,
      expiresAt: data.expires_at,
    });
    resendId = sent.id;
  } catch (sendError) {
    return {
      ok: false,
      error:
        sendError instanceof Error
          ? `Invite created but email failed: ${sendError.message}`
          : 'Invite created but email failed.',
    };
  }

  const { contactId } = await upsertTalentContact({
    email: data.email,
    fullName: data.full_name,
    companyName: data.company_name,
    note,
  });

  await controlRpc(supabase, 'record_assessment_invite_delivery', {
    p_invite_id: data.id,
    p_resend_email_id: resendId,
    p_ghl_contact_id: contactId,
  });

  revalidatePath('/admin');
  return {
    ok: true,
    message: `Invite sent to ${data.email}. Link expires ${new Date(data.expires_at).toLocaleString()}.`,
  };
}

export async function assessmentSignInAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin', 'layout');
  redirect('/admin');
}

export async function assessmentSignOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/admin', 'layout');
  redirect('/admin');
}

export async function listAssessmentInvites(): Promise<AssessmentInviteRow[]> {
  if (!supabaseConfigured) return [];
  const session = await getSessionContext();
  if (!session?.isAdmin) return [];

  const supabase = await createClient();
  const { data, error } = await controlRpc<AssessmentInviteRow[]>(
    supabase,
    'list_assessment_invites',
    { p_limit: 40 },
  );

  if (error || !data) return [];
  return Array.isArray(data) ? data : [];
}

export type ValidatedInvite = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  expires_at: string;
  used_at: string | null;
};

export async function validateAssessmentToken(
  token: string,
): Promise<{ ok: true; invite: ValidatedInvite } | { ok: false; error: string }> {
  if (!supabaseConfigured) {
    return { ok: false, error: 'Booking is temporarily unavailable.' };
  }

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await controlRpc<ValidatedInvite>(supabase, 'validate_assessment_invite', {
    p_token: token,
  });

  if (error || !data) {
    return { ok: false, error: readable(error) };
  }

  return { ok: true, invite: data };
}

export async function markAssessmentUsed(token: string): Promise<void> {
  if (!supabaseConfigured || !token) return;

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await controlRpc(supabase, 'mark_assessment_invite_used', { p_token: token });
}
