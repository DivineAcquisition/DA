'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { serviceClient, unsavedSession } from './client';
import { checkSession } from './health';
import { runCheck, runWorker } from './worker';

/**
 * Admin actions on the GHL layer. Permission and step-up are enforced by the
 * database functions these call; the server side adds the one thing the
 * database cannot do, the test call to GHL before a token is saved.
 *
 * A token arrives here from the form, is tested, handed to the database (which
 * puts it in the Vault), and dropped. No result returned from this file
 * contains it, and errors are redacted before they come back.
 */

export type GhlResult<T = undefined> = { ok: true; message?: string; data?: T } | { ok: false; error: string };

function refresh() {
  revalidatePath('/vistrial/team/ghl', 'layout');
}

/** Run queued GHL work after the response, so a removal never waits for the clock. */
function kick(jobsOnly = true) {
  after(async () => {
    await runWorker({ budgetMs: 25_000, jobsOnly });
  });
}

async function stepUp(password: string, purpose: string): Promise<string | null> {
  if (!password) return 'Confirm your password to continue.';
  const supabase = await createClient();
  const step = await controlRpc<{ ok: boolean; message?: string }[]>(supabase, 'verify_step_up', { p_password: password, p_purpose: purpose });
  if (step.error) return readable(step.error);
  const row = Array.isArray(step.data) ? step.data[0] : step.data;
  return row && row.ok === false ? (row.message ?? 'Step-up failed.') : null;
}

async function canManage(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await controlRpc<{ can_manage: boolean }>(supabase, 'ghl_overview', {});
  return Boolean(data?.can_manage);
}

async function call<T = undefined>(fn: string, args: Record<string, unknown>, message?: string): Promise<GhlResult<T>> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message, data: (data ?? undefined) as T | undefined };
}

/** Test a token that has not been saved. Returns a reason when it must be refused. */
async function testToken(
  token: string,
  level: 'agency' | 'location',
  locationId: string | null,
  companyId: string | null,
): Promise<{ ok: true; missing: string[] } | { ok: false; error: string }> {
  const session = unsavedSession(token, { level, locationId, companyId, caseFileId: null }, serviceClient());
  const health = await checkSession(session);
  if (!health.ok) return { ok: false, error: health.error ?? 'GHL refused the token.' };
  return { ok: true, missing: health.missing };
}

export async function addConnectionAction(form: {
  level: 'agency' | 'location';
  token: string;
  label: string;
  caseFileId?: string;
  locationId?: string;
  companyId?: string;
  isTest?: boolean;
  password: string;
}): Promise<GhlResult<{ last4: string }>> {
  if (!(await canManage())) return { ok: false, error: 'Only admins can add GHL connections.' };
  const token = form.token.trim();
  if (token.length < 20) return { ok: false, error: 'That does not look like a Private Integration Token.' };
  const locationId = form.locationId?.trim() || null;
  const companyId = form.companyId?.trim() || null;
  if (form.level === 'location' && (!form.caseFileId || !locationId)) return { ok: false, error: 'A sub-account connection needs its Location ID.' };
  if (form.level === 'agency' && !companyId) return { ok: false, error: 'The agency connection needs your GHL Company ID.' };

  const tested = await testToken(token, form.level, locationId, companyId);
  if (!tested.ok) return { ok: false, error: `Not saved. ${tested.error}` };

  const refused = await stepUp(form.password, 'add a GHL connection');
  if (refused) return { ok: false, error: refused };

  const saved = await call<{ id: string; last4: string }>('ghl_store_connection', {
    p_level: form.level,
    p_token: token,
    p_label: form.label,
    p_case_file_id: form.caseFileId ?? null,
    p_location_id: locationId,
    p_company_id: companyId,
    p_is_test: Boolean(form.isTest),
  });
  if (!saved.ok) return saved;

  // The stored connection gets its own recorded check straight away, then
  // mapping and users, so the screen shows real health, not "untested".
  const db = serviceClient();
  if (db && saved.data) {
    await runCheck(db, {
      connection_id: saved.data.id,
      level: form.level,
      case_file_id: form.caseFileId ?? null,
      is_candidate: false,
      mapping_due: true,
      users_due: true,
    });
  }
  kick();
  return {
    ok: true,
    data: { last4: saved.data?.last4 ?? '' },
    message: tested.missing.length
      ? `Saved (token ending ${saved.data?.last4}). It works but is missing: ${tested.missing.join(', ')}.`
      : `Saved and tested (token ending ${saved.data?.last4}).`,
  };
}

export async function rotateConnectionAction(form: {
  connectionId: string;
  level: 'agency' | 'location';
  locationId?: string | null;
  companyId?: string | null;
  caseFileId?: string | null;
  token: string;
  password: string;
}): Promise<GhlResult> {
  if (!(await canManage())) return { ok: false, error: 'Only admins can rotate GHL connections.' };
  const token = form.token.trim();
  const tested = await testToken(token, form.level, form.locationId ?? null, form.companyId ?? null);
  if (!tested.ok) return { ok: false, error: `Not rotated: the new token failed its test. ${tested.error} The current token is still in use.` };

  const refused = await stepUp(form.password, 'rotate a GHL connection');
  if (refused) return { ok: false, error: refused };
  const saved = await call<{ id: string; last4: string }>('ghl_rotate_connection', { p_connection_id: form.connectionId, p_token: token });
  if (!saved.ok) return saved;

  // The candidate's recorded check promotes it and retires the old token.
  const db = serviceClient();
  if (db && saved.data) {
    await runCheck(db, {
      connection_id: saved.data.id,
      level: form.level,
      case_file_id: form.caseFileId ?? null,
      is_candidate: true,
      mapping_due: false,
      users_due: false,
    });
  }
  refresh();
  return { ok: true, message: `Rotated. The new token (ending ${saved.data?.last4}) passed and is live; the old one is retired here. Revoke it in GHL.` };
}

export async function removeConnectionAction(connectionId: string, reason: string, password: string): Promise<GhlResult> {
  const refused = await stepUp(password, 'remove a GHL connection');
  if (refused) return { ok: false, error: refused };
  return call('ghl_remove_connection', { p_connection_id: connectionId, p_reason: reason }, 'Removed. Work that needs it is paused.');
}

export async function unlinkLocationAction(caseFileId: string, reason: string, password: string): Promise<GhlResult> {
  const refused = await stepUp(password, 'remove a GHL connection');
  if (refused) return { ok: false, error: refused };
  return call('ghl_unlink_location', { p_case_file_id: caseFileId, p_reason: reason }, 'Unlinked.');
}

export async function checkNowAction(caseFileId: string | null): Promise<GhlResult> {
  const result = await call('ghl_request_check', { p_case_file_id: caseFileId }, 'Checking now. Refresh in a few seconds.');
  if (result.ok) kick(false);
  return result;
}

export async function setLocationDetailsAction(caseFileId: string, isTest: boolean, a2pReference: string): Promise<GhlResult> {
  return call('ghl_set_location_details', { p_case_file_id: caseFileId, p_is_test: isTest, p_a2p_reference: a2pReference || null }, 'Saved.');
}

export async function setupEndpointAction(caseFileId: string, password: string): Promise<GhlResult<{ path: string; secret: string; header: string }>> {
  const refused = await stepUp(password, 'set up GHL live activity');
  if (refused) return { ok: false, error: refused };
  return call('ghl_setup_activity_endpoint', { p_case_file_id: caseFileId }, 'Copy the secret now: it is shown once.');
}

export async function saveRoutingAction(form: {
  caseFileId: string;
  enabled: boolean;
  method: string;
  singleOwnerPlacementId: string | null;
  afterHours: string;
  remindAfter: number;
  managerAfter: number;
  maxOpen: number;
  autoReassign: boolean;
  reassignAfter: number;
  silenceMinutes: number;
}): Promise<GhlResult> {
  return call(
    'ghl_save_routing',
    {
      p_case_file_id: form.caseFileId,
      p_enabled: form.enabled,
      p_method: form.method,
      p_single_owner_placement_id: form.singleOwnerPlacementId,
      p_after_hours: form.afterHours,
      p_remind_after: form.remindAfter,
      p_manager_after: form.managerAfter,
      p_max_open: form.maxOpen,
      p_auto_reassign: form.autoReassign,
      p_reassign_after: form.reassignAfter,
      p_silence_minutes: form.silenceMinutes,
    },
    'Routing saved.',
  );
}

export async function rerouteLeadAction(leadId: string): Promise<GhlResult> {
  const result = await call('ghl_reroute_lead', { p_lead_id: leadId }, 'Rerouted.');
  if (result.ok) kick();
  return result;
}

export async function fixMismatchAction(mismatchId: string, password: string | null): Promise<GhlResult> {
  if (password) {
    const refused = await stepUp(password, 'remove GHL access');
    if (refused) return { ok: false, error: refused };
  }
  const result = await call('ghl_fix_mismatch', { p_mismatch_id: mismatchId }, 'Fix queued and running.');
  if (result.ok) kick();
  return result;
}

export async function markKnownUserAction(ghlUserId: string, kind: 'client_staff' | 'agency_staff' | null, caseFileId: string | null): Promise<GhlResult> {
  return call('ghl_mark_known_user', { p_ghl_user_id: ghlUserId, p_kind: kind, p_case_file_id: caseFileId }, kind ? 'Marked. Reconciliation leaves them alone.' : 'Unmarked.');
}

export async function setAdminAccessAction(profileId: string, enabled: boolean, password: string | null): Promise<GhlResult> {
  if (!enabled) {
    const refused = await stepUp(password ?? '', 'remove GHL access');
    if (refused) return { ok: false, error: refused };
  }
  const result = await call('ghl_set_admin_access', { p_profile_id: profileId, p_enabled: enabled }, enabled ? 'Enabled. Access is being granted.' : 'Disabled. Access is being removed.');
  if (result.ok) kick();
  return result;
}

export async function revokeAllAccessAction(profileId: string, reason: string, password: string): Promise<GhlResult> {
  const refused = await stepUp(password, 'remove GHL access');
  if (refused) return { ok: false, error: refused };
  const result = await call('ghl_revoke_all_access', { p_profile_id: profileId, p_reason: reason }, 'All GHL access is being removed now.');
  if (result.ok) kick();
  return result;
}

export async function restoreAccessAction(profileId: string): Promise<GhlResult> {
  const result = await call('ghl_restore_access', { p_profile_id: profileId }, 'Block lifted. Access follows their placements again.');
  if (result.ok) kick();
  return result;
}

export async function retryGrantAction(grantId: string): Promise<GhlResult> {
  const result = await call('ghl_retry_grant', { p_grant_id: grantId }, 'Retrying now.');
  if (result.ok) kick();
  return result;
}

export async function saveStandardItemAction(item: {
  id: string | null;
  kind: string;
  name: string;
  parentName: string | null;
  position: number | null;
  fieldType: string | null;
  active: boolean;
}): Promise<GhlResult> {
  return call(
    'ghl_save_standard_item',
    {
      p_id: item.id,
      p_kind: item.kind,
      p_name: item.name,
      p_parent_name: item.parentName,
      p_position: item.position,
      p_field_type: item.fieldType,
      p_active: item.active,
    },
    'Saved. Every client is re-checked against it.',
  );
}

export async function saveProfileAction(key: string, permissions: Record<string, boolean>): Promise<GhlResult> {
  return call('ghl_save_permission_profile', { p_key: key, p_permissions: permissions }, 'Profile saved. Reconciliation re-checks every user on it.');
}
