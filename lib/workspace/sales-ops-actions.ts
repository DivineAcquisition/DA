'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { metricPayload, optionalNumber, placementPayload, settingsPayload } from '@/lib/sales-workspace/forms';
import { requireAdmin, workspaceClient } from './db';

const BASE = '/workspace/sales-ops';

async function adminClient() {
  if (!(await requireAdmin())) return null;
  return workspaceClient();
}

export async function savePlacementAction(fd: FormData): Promise<ActionResult & { id?: string }> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const { data, error } = await controlRpc<string>(supabase, 'so_save_placement', { p_placement: placementPayload(fd) });
  if (error || !data) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/placements`);
  return { ok: true, message: 'Placement saved.', id: data };
}

export async function setPlacementStatusAction(placementId: string, status: string, reason: string): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const { error } = await controlRpc<string>(supabase, 'so_set_placement_status', {
    p_placement_id: placementId,
    p_status: status,
    p_reason: reason || null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/placements`);
  revalidatePath(`${BASE}/placements/${placementId}`);
  return { ok: true, message: `Placement is now ${status}.` };
}

export async function saveOutcomeAction(fd: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const placementId = String(fd.get('placement_id') ?? '');
  const sort = Number(fd.get('sort_order') ?? 100);
  const { error } = await controlRpc<string>(supabase, 'so_save_outcome_type', {
    p_placement_id: placementId,
    p_id: String(fd.get('id') ?? '') || null,
    p_name: String(fd.get('name') ?? ''),
    p_definition: String(fd.get('definition') ?? ''),
    p_active: fd.get('active') === 'on',
    p_sort_order: Number.isFinite(sort) ? sort : 100,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/placements/${placementId}`);
  return { ok: true, message: 'Outcome saved.' };
}

export async function saveMetricAction(fd: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const { error } = await controlRpc<string>(supabase, 'so_save_metric', { p_metric: metricPayload(fd) });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/metrics`);
  return { ok: true, message: 'Metric saved.' };
}

export async function setDefaultTargetAction(fd: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const daily = optionalNumber(String(fd.get('daily') ?? ''));
  const weekly = optionalNumber(String(fd.get('weekly') ?? ''));
  if (daily === 'invalid' || weekly === 'invalid') return { ok: false, error: 'Targets are blank or a number of zero or more.' };
  const { error } = await controlRpc<string>(supabase, 'so_set_default_target', {
    p_metric_key: String(fd.get('metric_key') ?? ''),
    p_placement_type: String(fd.get('placement_type') ?? '') || null,
    p_daily: daily,
    p_weekly: weekly,
    p_effective_from: String(fd.get('effective_from') ?? '') || null,
    p_note: String(fd.get('note') ?? '') || null,
  });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/targets`);
  return { ok: true, message: daily === null && weekly === null ? 'Target cleared.' : 'Target set.' };
}

export async function saveWorkspaceSettingsAction(fd: FormData): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: 'DA Admin only.' };
  const parsed = settingsPayload(fd);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const { error } = await controlRpc(supabase, 'so_save_settings', { p_settings: parsed.value });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath(`${BASE}/settings`);
  return { ok: true, message: 'Settings saved.' };
}
