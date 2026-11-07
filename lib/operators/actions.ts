'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { resendInviteAction } from '@/lib/ad/actions';
import { isSalesOperatorRole } from '@/lib/careers/roles';
import { createOperatorAction } from '@/lib/hire/actions';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { serviceRoleClient, type UntypedClient } from '@/lib/workspace/db';

/** A desk action can send the browser to the record it made. */
export type DeskResult = ActionResult & { href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin() {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) return null;
  return session;
}

function text(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function refresh(operatorId?: string) {
  revalidatePath('/workspace/operators', 'layout');
  if (operatorId) revalidatePath(`/workspace/operators/${operatorId}`);
}

/** Mark an application as being read. */
export async function markReviewingAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const id = text(fd, 'application_id');
  if (!UUID.test(id)) return { ok: false, error: 'Application not found.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'review_role_application', { p_application_id: id, p_status: 'reviewing', p_note: text(fd, 'note') || null });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Marked In review.' };
}

/** Decline with a note. The note stays on the application. */
export async function declineApplicantAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const id = text(fd, 'application_id');
  const note = text(fd, 'note');
  if (!UUID.test(id)) return { ok: false, error: 'Application not found.' };
  if (note.length < 3) return { ok: false, error: 'Write why, so the next reader knows.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'review_role_application', { p_application_id: id, p_status: 'rejected', p_note: note });
  if (error) return { ok: false, error: readable(error) };
  refresh();
  return { ok: true, message: 'Declined.', href: '/workspace/operators/applicants' };
}

/**
 * Advance: hire_create with the application, a manager, and the DA Operator
 * Academy program. That opens operator_journey at Invited and sends the invite.
 */
export async function advanceApplicantAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const id = text(fd, 'application_id');
  const managerId = text(fd, 'manager_id');
  const programId = text(fd, 'program_id');
  if (!UUID.test(id)) return { ok: false, error: 'Application not found.' };
  if (!UUID.test(managerId)) return { ok: false, error: 'Choose the manager.' };

  const supabase = (await createClient()) as unknown as UntypedClient;
  const { data: app } = await supabase
    .from('role_application')
    .select('id, role_slug, full_name, email, phone, status')
    .eq('id', id)
    .maybeSingle();
  const application = app as { id: string; role_slug: string; full_name: string; email: string; phone: string | null; status: string } | null;
  if (!application) return { ok: false, error: 'Application not found.' };
  if (!isSalesOperatorRole(application.role_slug)) return { ok: false, error: 'This desk hires Sales Operators only.' };
  if (application.status === 'rejected' || application.status === 'withdrawn') {
    return { ok: false, error: 'This application was closed. Reopen it before you advance it.' };
  }

  const [first, ...rest] = application.full_name.trim().split(/\s+/);
  const result = await createOperatorAction({
    first_name: first || 'Operator',
    last_name: rest.join(' ') || first || 'Operator',
    work_email: application.email,
    phone: application.phone ?? undefined,
    role_kind: 'sales_operator',
    manager_id: managerId,
    program_id: UUID.test(programId) ? programId : undefined,
    application_id: application.id,
    note: text(fd, 'note') || undefined,
    grant_override: false,
  });
  if (!result.ok) return result;
  refresh(result.operatorId);
  return { ...result, href: result.operatorId ? `/workspace/operators/${result.operatorId}` : undefined };
}

/**
 * Send the account invite again. An open invite gets a fresh link; one that
 * was never created (the hire had an account) has nothing to resend.
 */
export async function resendOperatorInviteAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const inviteId = text(fd, 'invite_id');
  const operatorId = text(fd, 'operator_id');
  if (!UUID.test(inviteId)) return { ok: false, error: 'There is no open invite. They already have an account.' };
  const result = await resendInviteAction(inviteId);
  refresh(operatorId);
  if (!result.ok) return result;
  return { ok: true, message: result.message };
}

/** The note on the journey. Staff read it at the top of the file. */
export async function saveJourneyNoteAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const operatorId = text(fd, 'operator_id');
  const note = text(fd, 'note');
  if (!UUID.test(operatorId)) return { ok: false, error: 'Operator not found.' };
  if (note.length > 2000) return { ok: false, error: 'Keep the note under 2,000 characters.' };
  const db = serviceRoleClient();
  if (!db) return { ok: false, error: 'The service key is not configured.' };
  const { error } = await db.from('operator_journey').update({ note: note || null, updated_at: new Date().toISOString() }).eq('operator_id', operatorId);
  if (error) return { ok: false, error: error.message };
  refresh(operatorId);
  return { ok: true, message: 'Note saved.' };
}

/** A manual stage with its reason. Automatic facts still win on the next refresh. */
export async function setStageAction(fd: FormData): Promise<DeskResult> {
  if (!(await admin())) return { ok: false, error: 'DA Admin only.' };
  const operatorId = text(fd, 'operator_id');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'hire_set_stage', {
    p_operator: operatorId,
    p_stage: text(fd, 'stage'),
    p_reason: text(fd, 'reason'),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh(operatorId);
  return { ok: true, message: 'Stage set. Signed-in, readiness, and placement facts still move it.' };
}
