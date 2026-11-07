'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { loadEmailIdentity } from '@/lib/email/service';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { formComplete, stepErrors, type OnboardingDraft } from './rules';
import {
  sendHireInvite,
  sendOnboardingReminder,
  sendOperatorWelcome,
  sendOverrideAdminAlert,
  sendOverrideExpiring,
  sendOverrideGranted,
  sendReady,
} from './mail';

function refresh() {
  revalidatePath('/workspace/operators');
  revalidatePath('/workspace/operator/workspace');
}

async function admin() {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) return null;
  return session;
}

export async function searchApplicationsAction(query: string) {
  if (!(await admin())) return { ok: false as const, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { data, error } = await controlRpc<Array<Record<string, string>>>(supabase, 'hire_search_applications', { p_query: query });
  if (error) return { ok: false as const, error: readable(error) };
  return { ok: true as const, rows: data ?? [] };
}

export async function hireOptionsAction() {
  if (!(await admin())) return { ok: false as const, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ managers: { id: string; name: string }[]; programs: { id: string; name: string; slug: string }[] }>(
    supabase,
    'hire_options',
    {},
  );
  if (error) return { ok: false as const, error: readable(error) };
  return { ok: true as const, options: data };
}

type Created = {
  operator_id: string;
  created: boolean;
  existing: boolean;
  token: string | null;
  email: string;
  name: string;
  has_account?: boolean;
};

async function notifyCreated(row: Created) {
  if (!row.created) return 'Opened the existing record. No new invite was sent.';
  const notes: string[] = [];
  if (row.token) {
    try {
      await sendHireInvite({ to: row.email, name: row.name, token: row.token });
      notes.push('Invite sent.');
    } catch (error) {
      return `Record created, but the invite email failed: ${error instanceof Error ? error.message : 'Email failed'}.`;
    }
  }
  try {
    await sendOperatorWelcome({ to: row.email, name: row.name, operatorId: row.operator_id });
    notes.push('Welcome sent.');
  } catch (error) {
    notes.push(`Welcome email failed: ${error instanceof Error ? error.message : 'Email failed'}.`);
  }
  if (row.has_account) notes.unshift('Linked the existing account.');
  return notes.join(' ');
}

export async function createOperatorAction(payload: Record<string, unknown>): Promise<ActionResult & { operatorId?: string }> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { data, error } = await controlRpc<Created>(supabase, 'hire_create', { p: payload });
  if (error || !data) return { ok: false, error: readable(error) };
  const note = await notifyCreated(data);
  if (payload.grant_override === true || payload.grant_override === 'true') {
    const view = await controlRpc<{ override?: { id: string; expires_on: string } | null }>(supabase, 'hire_operator_view', {
      p_operator: data.operator_id,
    });
    const override = view.data?.override;
    if (override && data.created) {
      try {
        await sendOverrideGranted({
          to: data.email,
          name: data.name,
          operatorId: data.operator_id,
          overrideId: override.id,
          expiresOn: override.expires_on,
        });
      } catch {
        /* the grant is recorded even if the mail fails; the cron does not resend the grant */
      }
    }
  }
  refresh();
  return { ok: true, message: note, operatorId: data.operator_id };
}

export async function createOperatorsFromApplicationsAction(
  applications: { id: string; name: string; email: string; phone?: string }[],
  managerId: string,
): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  let created = 0;
  let opened = 0;
  for (const app of applications) {
    const [first, ...rest] = app.name.split(' ');
    const result = await createOperatorAction({
      first_name: first || 'Operator',
      last_name: rest.join(' ') || first || 'Operator',
      work_email: app.email,
      phone: app.phone,
      role_kind: 'sales_operator',
      manager_id: managerId,
      application_id: app.id,
      grant_override: false,
    });
    if (!result.ok) return result;
    if (result.message?.startsWith('Opened')) opened += 1;
    else created += 1;
  }
  return { ok: true, message: `Created ${created}. Opened ${opened} existing records.` };
}

export async function saveOnboardingAction(draft: OnboardingDraft, submit: boolean, payoutComplete = false): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session || session.impersonation) return { ok: false, error: 'Sign in as yourself to save onboarding.' };
  if (submit && !formComplete(draft, payoutComplete)) {
    const blocking = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((step) => stepErrors(step, draft, payoutComplete));
    if (blocking.length) return { ok: false, error: blocking[0] };
  }
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_save_onboarding', { p_answers: draft, p_submit: submit });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: submit ? 'Onboarding submitted.' : 'Saved.' };
}

export async function waiveReadinessAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_waive', {
    p_operator: String(fd.get('operator_id') ?? ''),
    p_item: String(fd.get('item') ?? ''),
    p_reason: String(fd.get('reason') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Waived. It stays marked Waived, not met.' };
}

export async function clearSetupAction(operatorId: string): Promise<ActionResult> {
  const session = await getSessionContext();
  if (!session || session.impersonation) return { ok: false, error: 'DA Admin or the manager only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_clear_setup', { p_operator: operatorId });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Setup flags cleared.' };
}

export async function grantOverrideAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const operatorId = String(fd.get('operator_id') ?? '');
  const { data, error } = await controlRpc<string>(supabase, 'hire_grant_override', {
    p_operator: operatorId,
    p_reason: String(fd.get('reason') ?? ''),
    p_start: String(fd.get('start') ?? new Date().toISOString().slice(0, 10)),
    p_days: Number(fd.get('days') ?? 30),
    p_exception: fd.get('exception') === 'on',
  });
  if (error) return { ok: false, error: readable(error) };
  const view = await controlRpc<{ override?: { id: string; expires_on: string } | null }>(supabase, 'hire_operator_view', { p_operator: operatorId });
  const email = String(fd.get('email') ?? '');
  const name = String(fd.get('name') ?? 'there');
  if (view.data?.override && email) {
    try {
      await sendOverrideGranted({
        to: email,
        name,
        operatorId,
        overrideId: view.data.override.id,
        expiresOn: view.data.override.expires_on,
      });
    } catch (sendError) {
      return { ok: false, error: sendError instanceof Error ? sendError.message : 'Override saved. The email failed.' };
    }
  }
  refresh();
  return { ok: true, message: data ? 'Override granted. It is not a certification.' : 'Override granted.' };
}

export async function extendOverrideAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_extend_override', {
    p_id: String(fd.get('override_id') ?? ''),
    p_expires: String(fd.get('expires') ?? ''),
    p_reason: String(fd.get('reason') ?? ''),
    p_exception: fd.get('exception') === 'on',
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Override extended.' };
}

export async function revokeOverrideAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_revoke_override', {
    p_id: String(fd.get('override_id') ?? ''),
    p_reason: String(fd.get('reason') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Override revoked.' };
}

export async function offboardAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_offboard', {
    p_operator: String(fd.get('operator_id') ?? ''),
    p_reason: String(fd.get('reason') ?? ''),
    p_last_day: String(fd.get('last_day') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Off-boarding started. Access ends after the last day.' };
}

export async function tickOffboardAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_tick_offboard', {
    p_operator: String(fd.get('operator_id') ?? ''),
    p_item: String(fd.get('item') ?? ''),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Checked.' };
}

export async function saveGhlAction(fd: FormData): Promise<ActionResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_save_ghl', {
    p: {
      operator_id: String(fd.get('operator_id') ?? ''),
      placement_id: String(fd.get('placement_id') ?? ''),
      client_id: String(fd.get('client_id') ?? ''),
      user: fd.get('user') === 'yes',
      mapped: fd.get('mapped') === 'yes',
      phone: String(fd.get('phone') ?? 'no'),
      confirmed_on: String(fd.get('confirmed_on') ?? ''),
    },
  });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'GHL readiness saved.' };
}

export async function confirmGhlAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_confirm_ghl', { p_id: id });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Confirmed. You can sign in with your own user.' };
}

export async function runHireSweep() {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const db = serviceRoleClient();
  if (!db) return { ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required' };
  const { data, error } = await db.rpc('hire_due');
  if (error) return { ok: false, error: error.message };
  const due = data as {
    reminders: { operator_id: string; email: string; name: string; count: number }[];
    overrides: { override_id: string; operator_id: string; email: string; name: string; days: number; expires_on: string }[];
  };
  let sent = 0;
  for (const row of due.reminders ?? []) {
    await sendOnboardingReminder({ to: row.email, name: row.name, operatorId: row.operator_id, count: row.count });
    await db.rpc('hire_mark_reminder', { p_operator: row.operator_id, p_count: row.count });
    sent += 1;
  }
  const identity = await loadEmailIdentity('alerts');
  for (const row of due.overrides ?? []) {
    await sendOverrideExpiring({
      to: row.email,
      name: row.name,
      operatorId: row.operator_id,
      overrideId: row.override_id,
      days: row.days,
      expiresOn: row.expires_on,
    });
    if (row.days === 7 && identity.replyTo) {
      await sendOverrideAdminAlert({
        to: identity.replyTo,
        operatorName: row.name,
        overrideId: row.override_id,
        expiresOn: row.expires_on,
      });
    }
    sent += 1;
  }
  const ready = await db.rpc('hire_ready_unsent');
  for (const row of (ready.data ?? []) as { operator_id: string; email: string; name: string }[]) {
    await sendReady({ to: row.email, name: row.name, operatorId: row.operator_id });
    await db.rpc('hire_mark_ready_email', { p_operator: row.operator_id });
    sent += 1;
  }
  return { ok: true, sent };
}
