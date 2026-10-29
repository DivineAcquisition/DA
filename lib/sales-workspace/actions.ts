'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

const PATHS = [
  '/workspace/operator/workspace',
  '/workspace/operator/workspace/alerts',
  '/workspace/operator/workspace/history',
  '/workspace/operator/workspace/eod',
];

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
  day?: string | null,
): Promise<ActionResult> {
  return call(
    'so_log_activity',
    { p_metric_key: metricKey, p_outcome_type_id: outcomeId, p_amount: amount, p_mode: mode, p_day: day || null },
    'Saved.',
  );
}

export type EodBody = {
  wins: string;
  blockers: string;
  needs_help: boolean;
  plan_items: { text: string }[];
  note_to_manager?: string;
  hours_start?: string;
  hours_end?: string;
  break_minutes?: number | null;
};

export type EodWriteResult =
  | { ok: true; status: string; updated_at?: string; was_late?: boolean; submitted_at?: string }
  | { ok: false; error: string };

async function writeEod(fn: string, day: string, body: EodBody): Promise<EodWriteResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ status: string; updated_at?: string; was_late?: boolean; submitted_at?: string }>(supabase, fn, {
    p_day: day,
    p_body: body,
  });
  if (error || !data) return { ok: false, error: readable(error) };
  for (const path of PATHS) revalidatePath(path);
  return { ok: true, ...data };
}

export async function saveEodAction(day: string, body: EodBody): Promise<EodWriteResult> {
  return writeEod('so_eod_save', day, body);
}

export async function submitEodAction(day: string, body: EodBody): Promise<EodWriteResult> {
  return writeEod('so_eod_submit', day, body);
}

export async function tickPlanAction(eodId: string, index: number, done: boolean): Promise<ActionResult> {
  return call('so_plan_tick', { p_eod_id: eodId, p_index: index, p_done: done }, 'Saved.');
}

export async function replyEodAction(eodId: string, parentId: string, body: string): Promise<ActionResult> {
  return call('so_eod_feedback', { p_eod: eodId, p_body: body, p_rating: null, p_parent: parentId }, 'Reply sent.');
}

export async function completeTaskAction(taskId: string): Promise<ActionResult> {
  return call('so_complete_task', { p_task_id: taskId }, 'Marked done.');
}

export async function markAlertReadAction(alertId: string | null): Promise<ActionResult> {
  return call('so_mark_alerts_read', { p_id: alertId }, alertId ? 'Marked read.' : 'All marked read.');
}
