'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { clearOperatorWorkspaceCache } from '@/lib/operator-workspace/domain';
import { createClient } from '@/lib/supabase/server';

function lines(formData: FormData, name: string): string[] {
  return String(formData.get(name) ?? '')
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function num(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function call(fn: string, args: Record<string, unknown>, message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/team/workspace', 'layout');
  return { ok: true, message };
}

export async function saveOperatorDomainAction(formData: FormData): Promise<ActionResult> {
  const result = await call(
    'so_save_operator_domain',
    {
      p: {
        origin: String(formData.get('origin') ?? ''),
        also_active: lines(formData, 'also_active'),
        retired: lines(formData, 'retired'),
        refresh_minutes: num(formData, 'refresh_minutes'),
      },
    },
    'Saved. Links, redirects, and emails use this host.',
  );
  if (result.ok) clearOperatorWorkspaceCache();
  return result;
}

export async function createTeamTaskAction(operatorId: string, placementId: string | null, formData: FormData): Promise<ActionResult> {
  return call(
    'so_team_create_task',
    {
      p_operator_id: operatorId,
      p_title: String(formData.get('title') ?? ''),
      p_detail: String(formData.get('detail') ?? ''),
      p_due_on: String(formData.get('due_on') ?? '') || null,
      p_placement_id: placementId,
    },
    'Task assigned.',
  );
}

export async function sendTeamMessageAction(operatorId: string, placementId: string | null, formData: FormData): Promise<ActionResult> {
  return call(
    'so_team_send_message',
    {
      p_operator_id: operatorId,
      p_body: String(formData.get('body') ?? ''),
      p_placement_id: placementId,
    },
    'Message sent.',
  );
}

export async function setTeamTargetAction(placementId: string, metricKey: string, formData: FormData): Promise<ActionResult> {
  return call(
    'so_team_set_target',
    {
      p_placement_id: placementId,
      p_metric_key: metricKey,
      p_daily: num(formData, 'daily'),
      p_weekly: num(formData, 'weekly'),
      p_note: String(formData.get('note') ?? ''),
    },
    'Target saved.',
  );
}
