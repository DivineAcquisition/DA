'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

const PATHS = ['/workspace/operator/workspace', '/workspace/operator/workspace/alerts', '/workspace/operator/workspace/history'];

async function call(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  for (const path of PATHS) revalidatePath(path);
  return { ok: true, message: ok };
}

export async function logActivityAction(
  metricKey: string,
  outcomeId: string | null,
  amount: number,
  mode: 'delta' | 'set',
): Promise<ActionResult> {
  return call(
    'so_log_activity',
    { p_metric_key: metricKey, p_outcome_type_id: outcomeId, p_amount: amount, p_mode: mode },
    'Saved.',
  );
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  return call('so_complete_task', { p_task_id: taskId }, 'Marked done.');
}

export async function markAlertReadAction(alertId: string | null): Promise<ActionResult> {
  return call('so_mark_alerts_read', { p_id: alertId }, alertId ? 'Marked read.' : 'All marked read.');
}
