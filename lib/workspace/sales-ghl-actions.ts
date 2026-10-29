'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { serviceClient } from '@/lib/ghl/client';
import { testSalesConnection } from '@/lib/ghl/sales-sync';
import { createClient } from '@/lib/supabase/server';

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? '').trim();
}

async function refresh(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/sales-ops');
  revalidatePath('/workspace/team/workspace');
  return { ok: true, message: ok };
}

export async function connectPlacementGhlAction(fd: FormData): Promise<ActionResult> {
  const token = text(fd, 'token');
  if (token) {
    const supabase = await createClient();
    const { error } = await controlRpc(supabase, 'ghl_store_connection', {
      p_level: 'location',
      p_token: token,
      p_label: text(fd, 'label') || 'Sales placement',
      p_case_file_id: text(fd, 'case_file_id'),
      p_location_id: text(fd, 'location_id'),
      p_is_test: fd.get('is_test') === 'on',
    });
    if (error) return { ok: false, error: readable(error) };
  }
  return refresh('so_ghl_save_user', { p_placement: text(fd, 'placement_id'), p_user: text(fd, 'ghl_user_id') }, 'GHL user saved.');
}

export async function testPlacementGhlAction(fd: FormData): Promise<ActionResult> {
  const db = serviceClient();
  if (!db) return { ok: false, error: 'The server sync key is not set, so the connection cannot be tested from here.' };
  const result = await testSalesConnection(db, text(fd, 'case_file_id'));
  if (!result.ok) return { ok: false, error: result.error };
  await db.rpc('so_ghl_save_catalog', {
    p_placement: text(fd, 'placement_id'),
    p_catalog: { users: result.users },
  });
  revalidatePath('/workspace/sales-ops');
  return { ok: true, message: `Connected. ${result.users.length} users can be read. The token was not shown.` };
}

export async function saveGhlMappingAction(fd: FormData): Promise<ActionResult> {
  let mapping: unknown;
  try {
    mapping = JSON.parse(text(fd, 'mapping') || '{}');
  } catch {
    return { ok: false, error: 'The mapping could not be read.' };
  }
  return refresh('so_ghl_save_mapping', { p_placement: text(fd, 'placement_id'), p_mapping: mapping }, 'Mapping saved. It applies from tomorrow.');
}

export async function disconnectPlacementGhlAction(fd: FormData): Promise<ActionResult> {
  return refresh('so_ghl_disconnect', { p_placement: text(fd, 'placement_id') }, 'Sync stopped. History stays.');
}

export async function queueGhlRerunAction(fd: FormData): Promise<ActionResult> {
  return refresh(
    'so_ghl_queue_rerun',
    { p_placement: text(fd, 'placement_id'), p_from: text(fd, 'from'), p_to: text(fd, 'to') },
    'Re-count queued. The next sync will pull that range.',
  );
}

export async function decideMismatchForm(fd: FormData): Promise<void> {
  await decideMismatchAction(fd);
}

export async function decideMismatchAction(fd: FormData): Promise<ActionResult> {
  return refresh(
    'so_ghl_decide',
    { p_id: text(fd, 'id'), p_decision: text(fd, 'decision'), p_reason: text(fd, 'reason'), p_note: text(fd, 'note') },
    'Decision saved.',
  );
}
