'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/ad/rpc';
import { createCaseFileRecord } from '@/lib/da/actions';
import { getSessionContext } from '@/lib/supabase/server';
import { workspaceClient } from '@/lib/workspace/db';
import { ENGAGEMENT_STATUSES, type EngagementStatus } from './desk';

export type DeskResult = ActionResult & { href?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Establish account: the prospect becomes a client case file. The lead keeps
 * its history; it moves to Closed Won and records which file it became.
 */
export async function establishAccountAction(fd: FormData): Promise<DeskResult> {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) return { ok: false, error: 'DA Admin only.' };
  const leadId = text(fd, 'lead_id');
  const created = await createCaseFileRecord(fd);
  if (!created.ok) return created;

  if (UUID.test(leadId)) {
    const db = await workspaceClient();
    if (db) {
      const { data: lead } = await db.from('da_leads').select('payload').eq('id', leadId).maybeSingle();
      const payload = { ...((lead?.payload as Record<string, unknown> | null) ?? {}), case_file_id: created.id };
      await db.from('da_leads').update({ stage: 'Closed Won', payload }).eq('id', leadId);
      await db.from('da_lead_events').insert({
        lead_id: leadId,
        actor_id: session.userId,
        kind: 'note',
        body: `Account established. Case file: /workspace/clients/${created.id}`,
      });
      revalidatePath('/workspace/clients/prospects');
      revalidatePath(`/workspace/clients/prospects/${leadId}`);
    }
  }
  revalidatePath('/workspace/clients');
  return { ok: true, message: 'Account established.', href: `/workspace/clients/${created.id}` };
}

/** Engagement status: audit, installing, active, paused, ended. */
export async function setEngagementStatusAction(fd: FormData): Promise<DeskResult> {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) return { ok: false, error: 'DA Admin only.' };
  const id = text(fd, 'case_file_id');
  const status = text(fd, 'status') as EngagementStatus;
  if (!UUID.test(id)) return { ok: false, error: 'Case file not found.' };
  if (!(ENGAGEMENT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Pick a status from the list.' };
  if (status === 'installing') return { ok: false, error: 'Installing starts from Begin install on the Growth tab, which locks the baseline.' };
  const db = await workspaceClient();
  if (!db) return { ok: false, error: 'The database is not configured.' };
  const patch: Record<string, unknown> = { status };
  if (status === 'ended') patch.engagement_end = new Date().toISOString().slice(0, 10);
  const { error } = await db.from('client_case_file').update(patch).eq('id', id).eq('record_kind', 'client');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/workspace/clients');
  revalidatePath(`/workspace/clients/${id}`);
  return { ok: true, message: `Status set to ${status}.` };
}
