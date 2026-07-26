'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * The only two things a client account may create: uploads and messages. Rule 3.
 * Everything else on this surface is read-only, and RLS refuses the rest whether
 * or not an action exists for it.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

function readable(error: { message: string } | null): string {
  if (!error) return 'Something went wrong.';
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

export async function sendMessageAction(caseFileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('send_client_message', {
    p_case_file_id: caseFileId,
    p_body: String(formData.get('body') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/acct/messages');
  return { ok: true, message: 'Sent. DA will come back to you within a day.' };
}

/**
 * Records the upload's metadata and reference. The bytes go to the Client
 * Provided folder in Drive; if Drive is not connected the reference is recorded
 * and the file can be attached later.
 */
export async function recordUploadAction(caseFileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const filename = String(formData.get('filename') ?? '').trim();
  const purpose = String(formData.get('what_it_proves') ?? '').trim();

  if (!filename || !purpose) {
    return { ok: false, error: 'Give the file a name and say what it is for.' };
  }

  const { error } = await supabase.from('evidence_item').insert({
    case_file_id: caseFileId,
    category: 'client_provided',
    uploaded_by_client: true,
    drive_file_id: `pending-${crypto.randomUUID()}`,
    filename,
    what_it_proves: purpose,
    happened_on: String(formData.get('happened_on') ?? new Date().toISOString().slice(0, 10)),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/acct/files');
  return { ok: true, message: 'Uploaded. It is now with DA for review.' };
}

/**
 * Records that the client opened a published document. Not a write to their own
 * record so much as a read receipt, which is why it is the one exception to the
 * two-things rule above.
 */
export async function recordDocumentOpenAction(documentId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_document_open', {
    p_document_id: documentId,
    p_via: 'account',
  });
  if (error) console.error('document open not recorded', error.message);
}

export async function updatePreferencesAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase.from('client_notification_pref').upsert({
    profile_id: user.id,
    weekly_digest: formData.get('weekly_digest') === 'on',
    milestone_alerts: formData.get('milestone_alerts') === 'on',
    report_published: formData.get('report_published') === 'on',
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/acct/settings');
  return { ok: true, message: 'Preferences saved. Billing notices always send.' };
}

export async function clientSignInAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/acct', 'layout');
  redirect('/acct');
}

export async function clientSignOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/acct', 'layout');
  redirect('/acct');
}

/** Accepts an invitation after the person has created their credentials. */
export async function acceptInviteAction(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_client_invite', { p_token: token });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/acct', 'layout');
  return { ok: true, message: 'Your account is ready.' };
}
