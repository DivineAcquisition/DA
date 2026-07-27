'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

const revalidateAd = (...paths: string[]) => {
  revalidatePath('/ad', 'layout');
  for (const path of paths) revalidatePath(path);
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  // Rate limit / lockout / blocked-state checks live in attempt_sign_in. A
  // refusal here never discloses whether the email exists.
  const { data: gate, error: gateError } = await controlRpc<
    { ok: boolean; code?: string; message?: string }[] | { ok: boolean; code?: string; message?: string }
  >(supabase, 'attempt_sign_in', { p_email: email, p_password: password });

  if (gateError) return { ok: false, error: readable(gateError) };

  const decision = Array.isArray(gate) ? gate[0] : gate;
  if (decision && decision.ok === false) {
    return { ok: false, error: decision.message ?? 'Those details do not match an account.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  revalidateAd();
  redirect('/ad');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidateAd();
  redirect('/ad');
}

export async function verifyStepUpAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ ok: boolean; message?: string; step_up_id?: string }[]>(
    supabase,
    'verify_step_up',
    {
      p_password: String(formData.get('password') ?? ''),
      p_purpose: String(formData.get('purpose') ?? 'sensitive'),
    },
  );
  if (error) return { ok: false, error: readable(error) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.ok === false) {
    return { ok: false, error: row?.message ?? 'Step-up verification failed.' };
  }
  return { ok: true, message: row.step_up_id ? `Verified. ${row.step_up_id}` : 'Verified.' };
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function inviteAccountAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const caseFileIds = String(formData.get('case_file_ids') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const { data, error } = await controlRpc<{ invite_id: string; token: string }[]>(
    supabase,
    'invite_account',
    {
      p_email: String(formData.get('email') ?? '').trim().toLowerCase(),
      p_full_name: String(formData.get('full_name') ?? '') || null,
      p_role: String(formData.get('role') ?? 'operator'),
      p_scope_kind: String(formData.get('scope_kind') ?? 'clients'),
      p_scope_case_file_ids: caseFileIds,
      p_expires_on: String(formData.get('expires_on') ?? '') || null,
    },
  );
  if (error) return { ok: false, error: readable(error) };
  const row = Array.isArray(data) ? data[0] : data;
  revalidateAd('/ad/invites');
  return {
    ok: true,
    message: row?.token
      ? `Invite created. One-time link token (copy now): ${row.token}`
      : 'Invite created.',
  };
}

export async function resendInviteAction(inviteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'resend_invite', { p_invite_id: inviteId });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad/invites');
  return { ok: true, message: 'Invite resent.' };
}

export async function cancelInviteAction(inviteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'cancel_invite', { p_invite_id: inviteId });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad/invites');
  return { ok: true, message: 'Invite cancelled.' };
}

export async function acceptInviteAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const fullName = String(formData.get('full_name') ?? '') || null;

  const preview = await controlRpc<
    {
      email: string | null;
      full_name: string | null;
      role: string | null;
      valid: boolean;
      reason: string | null;
    }[]
  >(supabase, 'invite_preview', { p_token: token });
  if (preview.error) return { ok: false, error: readable(preview.error) };
  const invite = Array.isArray(preview.data) ? preview.data[0] : null;
  if (!invite?.valid || !invite.email) {
    return { ok: false, error: invite?.reason ?? 'This invitation link is not usable.' };
  }

  // Accept requires a session. Create the auth user if needed, then sign in.
  const { error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { data: { full_name: fullName ?? invite.full_name } },
  });
  if (signUpError && !/already/i.test(signUpError.message)) {
    // If the user already exists, fall through to password sign-in.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    if (signInError) return { ok: false, error: signInError.message };
  } else if (signUpError) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });
    if (signInError) return { ok: false, error: signInError.message };
  }

  const { error } = await controlRpc(supabase, 'accept_account_invite', {
    p_token: token,
    p_full_name: fullName,
  });
  if (error) return { ok: false, error: readable(error) };

  revalidateAd();
  redirect('/ad');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function suspendAccountAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'suspend_account', {
    p_profile_id: profileId,
    p_reason: String(formData.get('reason') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Account suspended. Sessions revoked.' };
}

export async function reactivateAccountAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'reactivate_account', {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Account reactivated.' };
}

export async function setExpiryAction(profileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const raw = String(formData.get('expires_on') ?? '');
  const { error } = await controlRpc(supabase, 'set_account_expiry', {
    p_profile_id: profileId,
    p_expires_on: raw || null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: raw ? `Expiry set to ${raw}.` : 'Expiry cleared.' };
}

export async function archiveAccountAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'archive_account', { p_profile_id: profileId });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Account archived.' };
}

export async function softDeleteAccountAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'soft_delete_account', { p_profile_id: profileId });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Account soft-deleted into the recovery window.' };
}

export async function restoreAccountAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'restore_account', { p_profile_id: profileId });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Account restored.' };
}

export async function permanentlyDeleteAccountAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'permanently_delete_account', {
    p_profile_id: profileId,
    p_typed_email: String(formData.get('typed_email') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad');
  redirect('/ad');
}

export async function changeRoleAction(profileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'change_account_role', {
    p_profile_id: profileId,
    p_new_role: String(formData.get('role') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Role updated.' };
}

export async function setScopeAction(profileId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const kind = String(formData.get('kind') ?? 'clients');
  const caseFileIds = String(formData.get('case_file_ids') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const placementIds = String(formData.get('placement_ids') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  const { error } = await controlRpc(supabase, 'set_account_scope', {
    p_profile_id: profileId,
    p_kind: kind,
    p_case_file_ids: caseFileIds,
    p_placement_ids: placementIds,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: `Scope set to ${kind}.` };
}

export async function setPermissionOverrideAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'set_permission_override', {
    p_profile_id: profileId,
    p_permission_key: String(formData.get('permission_key') ?? ''),
    p_effect: String(formData.get('effect') ?? 'deny'),
    p_reason: String(formData.get('reason') ?? '') || null,
    p_expires_at: String(formData.get('expires_at') ?? '') || null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Permission override saved.' };
}

export async function requirePasswordResetAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'require_password_reset', {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Password reset required on next sign-in.' };
}

export async function resetSecondFactorAction(profileId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'reset_second_factor', {
    p_profile_id: profileId,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Second factor reset.' };
}

export async function setMfaRequirementAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'set_mfa_requirement', {
    p_profile_id: profileId,
    p_required: String(formData.get('required') ?? 'true') === 'true',
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'MFA requirement updated.' };
}

export async function setSignInRestrictionsAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const allowlist = String(formData.get('ip_allowlist') ?? '')
    .split(/[\s,]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  const { error } = await controlRpc(supabase, 'set_sign_in_restrictions', {
    p_profile_id: profileId,
    p_ip_allowlist: allowlist.length ? allowlist : null,
    p_restrict_to_shift: String(formData.get('restrict_to_shift') ?? '') === 'on',
    p_session_timeout_minutes: formData.get('session_timeout_minutes')
      ? Number(formData.get('session_timeout_minutes'))
      : null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Sign-in restrictions updated.' };
}

export async function setAccountNoticeAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'set_account_notice', {
    p_profile_id: profileId,
    p_body: String(formData.get('body') ?? ''),
    p_severity: String(formData.get('severity') ?? 'urgent'),
    p_blocking: String(formData.get('blocking') ?? '') === 'on',
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Notice posted.' };
}

export async function clearAccountNoticeAction(noticeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'clear_account_notice', {
    p_notice_id: noticeId,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd();
  return { ok: true, message: 'Notice cleared.' };
}

export async function acknowledgeNoticeAction(noticeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'acknowledge_notice', {
    p_notice_id: noticeId,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd();
  return { ok: true, message: 'Notice acknowledged.' };
}

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------

export async function startImpersonationAction(
  targetProfileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const password = String(formData.get('password') ?? '');
  if (password) {
    const step = await controlRpc<{ ok: boolean; message?: string }[]>(supabase, 'verify_step_up', {
      p_password: password,
      p_purpose: 'impersonate',
    });
    if (step.error) return { ok: false, error: readable(step.error) };
    const row = Array.isArray(step.data) ? step.data[0] : step.data;
    if (row && row.ok === false) return { ok: false, error: row.message ?? 'Step-up failed.' };
  }

  const { error } = await controlRpc(supabase, 'start_impersonation', {
    p_target_profile_id: targetProfileId,
    p_reason: String(formData.get('reason') ?? ''),
    p_minutes: formData.get('minutes') ? Number(formData.get('minutes')) : 30,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd();
  return { ok: true, message: 'Impersonation started. Actions are logged as you.' };
}

export async function endImpersonationAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'end_impersonation', {});
  if (error) return { ok: false, error: readable(error) };
  revalidateAd();
  return { ok: true, message: 'Impersonation ended.' };
}

export async function endImpersonationFormAction(): Promise<void> {
  await endImpersonationAction();
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

export async function storeCredentialAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const password = String(formData.get('step_up_password') ?? '');
  if (password) {
    const step = await controlRpc<{ ok: boolean; message?: string }[]>(supabase, 'verify_step_up', {
      p_password: password,
      p_purpose: 'store_credential',
    });
    if (step.error) return { ok: false, error: readable(step.error) };
    const row = Array.isArray(step.data) ? step.data[0] : step.data;
    if (row && row.ok === false) return { ok: false, error: row.message ?? 'Step-up failed.' };
  }

  const { error } = await controlRpc(supabase, 'store_credential', {
    p_case_file_id: String(formData.get('case_file_id') ?? ''),
    p_kind: String(formData.get('kind') ?? 'login'),
    p_label: String(formData.get('label') ?? ''),
    p_username: String(formData.get('username') ?? '') || null,
    p_secret: String(formData.get('secret') ?? ''),
    p_notes: String(formData.get('notes') ?? '') || null,
    p_rotation_interval_days: formData.get('rotation_interval_days')
      ? Number(formData.get('rotation_interval_days'))
      : null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad/credentials');
  return { ok: true, message: 'Credential stored in the vault.' };
}

export async function revealCredentialAction(
  credentialId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const password = String(formData.get('password') ?? '');
  if (password) {
    const step = await controlRpc<{ ok: boolean; message?: string }[]>(supabase, 'verify_step_up', {
      p_password: password,
      p_purpose: 'reveal_credential',
    });
    if (step.error) return { ok: false, error: readable(step.error) };
    const row = Array.isArray(step.data) ? step.data[0] : step.data;
    if (row && row.ok === false) return { ok: false, error: row.message ?? 'Step-up failed.' };
  }

  const { data, error } = await controlRpc<{ secret?: string; username?: string }[]>(
    supabase,
    'reveal_credential',
    { p_credential_id: credentialId },
  );
  if (error) return { ok: false, error: readable(error) };
  const row = Array.isArray(data) ? data[0] : data;
  revalidateAd('/ad/credentials');
  return {
    ok: true,
    message: row?.secret
      ? `Revealed (logged): ${row.username ? `${row.username} / ` : ''}${row.secret}`
      : 'Credential revealed and logged.',
  };
}

// ---------------------------------------------------------------------------
// Lockdown / alerts / offboarding
// ---------------------------------------------------------------------------

export async function engageLockdownAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  // Signature recovery is incomplete for engage_lockdown; try the documented body.
  const body = String(formData.get('body') ?? formData.get('reason') ?? '');
  let error = (await controlRpc(supabase, 'engage_lockdown', { p_body: body })).error;
  if (error?.message?.includes('Could not find the function')) {
    error = (await controlRpc(supabase, 'engage_lockdown', { p_reason: body })).error;
  }
  if (error?.message?.includes('Could not find the function')) {
    error = (await controlRpc(supabase, 'engage_lockdown', { p_message: body })).error;
  }
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad/lockdown');
  return { ok: true, message: 'Lockdown engaged.' };
}

export async function releaseLockdownAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'release_lockdown', {});
  if (error) return { ok: false, error: readable(error) };
  revalidateAd('/ad/lockdown');
  return { ok: true, message: 'Lockdown released.' };
}

export async function acknowledgeOwnerAlertAction(alertId: number): Promise<ActionResult> {
  const supabase = await createClient();
  let result = await controlRpc(supabase, 'acknowledge_owner_alert', { p_alert_id: alertId });
  if (result.error?.message?.includes('Could not find the function')) {
    result = await controlRpc(supabase, 'dismiss_owner_alert', { p_alert_id: alertId });
  }
  if (result.error) return { ok: false, error: readable(result.error) };
  revalidateAd('/ad/alerts');
  return { ok: true, message: 'Alert acknowledged.' };
}

export async function advanceOffboardingAction(
  profileId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'advance_offboarding', {
    p_profile_id: profileId,
    p_step: String(formData.get('step') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  revalidateAd(`/ad/accounts/${profileId}`);
  return { ok: true, message: 'Offboarding step advanced.' };
}
