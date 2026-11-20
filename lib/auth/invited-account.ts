import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceRoleClient } from '@/lib/workspace/db';
import { invitedSignInError, newPasswordError } from './password';

type PasswordSession = {
  auth: {
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Public signup is closed. An invitation creates the auth user with the
 * service role, then signs that person in so accept_account_invite has a session.
 * signUp() on the browser key fails with "signups not allowed", and the
 * following sign-in reports invalid credentials because no password was saved.
 */
export async function establishInvitedAccount(
  supabase: PasswordSession,
  input: { email: string; password: string; confirm: string; fullName: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalid = newPasswordError(input.password, input.confirm);
  if (invalid) return { ok: false, error: invalid };

  const admin = serviceRoleClient();
  if (!admin) return { ok: false, error: 'The server cannot open new accounts right now.' };

  const { error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: input.fullName ? { full_name: input.fullName } : undefined,
  });
  if (createError && /already|registered|exists/i.test(createError.message)) {
    const activated = await setExistingPassword(admin, input.email, input.password);
    if (!activated.ok) return activated;
  } else if (createError) {
    return { ok: false, error: createError.message };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError) return { ok: false, error: invitedSignInError(signInError.message) };
  return { ok: true };
}

/**
 * Onboarding can start after a profile exists and before anyone has signed in.
 * The invitation then sets the password on that account instead of creating a second one.
 */
async function setExistingPassword(
  admin: NonNullable<ReturnType<typeof serviceRoleClient>>,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await admin.from('profile').select('id').ilike('email', email).limit(1);
  const id = (data?.[0] as { id?: string } | undefined)?.id;
  if (error || !id) return { ok: false, error: 'This email already has an account, and it could not be activated.' };
  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password,
    email_confirm: true,
  });
  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}

/** The cookie client from createClient satisfies this. The cast keeps the helper off the generated Database generic. */
export function asPasswordSession(client: unknown): PasswordSession {
  return client as SupabaseClient;
}
