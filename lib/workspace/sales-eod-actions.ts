'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? '').trim();
}

async function refresh(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/sales-ops');
  revalidatePath('/workspace/sales-ops/eods');
  revalidatePath('/workspace/team/workspace/eods');
  revalidatePath('/workspace/team/workspace');
  revalidatePath('/workspace/operator/workspace');
  return { ok: true, message: ok };
}

export async function reviewEodAction(fd: FormData): Promise<ActionResult> {
  return refresh('so_eod_mark_reviewed', { p_eod: text(fd, 'eod_id') }, 'Marked reviewed.');
}

export async function feedbackEodAction(fd: FormData): Promise<ActionResult> {
  const rating = text(fd, 'rating');
  return refresh(
    'so_eod_feedback',
    {
      p_eod: text(fd, 'eod_id'),
      p_body: text(fd, 'body'),
      p_rating: rating ? Number(rating) : null,
      p_parent: text(fd, 'parent_id') || null,
    },
    'Feedback sent.',
  );
}

export async function escalateEodAction(fd: FormData): Promise<ActionResult> {
  return refresh('so_eod_escalate', { p_eod: text(fd, 'eod_id'), p_reason: text(fd, 'reason') }, 'Escalated to DA Admin.');
}

export async function unlockEodAction(fd: FormData): Promise<ActionResult> {
  return refresh(
    'so_eod_unlock',
    { p_eod: text(fd, 'eod_id'), p_hours: Number(text(fd, 'hours') || '0'), p_reason: text(fd, 'reason') },
    'EOD unlocked.',
  );
}

export async function excuseDaysAction(fd: FormData): Promise<ActionResult> {
  const dates = text(fd, 'dates')
    .split(/[\s,]+/)
    .map((d) => d.trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dates.length === 0) return { ok: false, error: 'Add at least one date, as YYYY-MM-DD.' };
  return refresh(
    'so_excuse_days',
    { p_placement: text(fd, 'placement_id'), p_dates: dates, p_reason: text(fd, 'reason'), p_note: text(fd, 'note') },
    'Day excused.',
  );
}

export async function blockerTaskAction(fd: FormData): Promise<ActionResult> {
  const blocker = text(fd, 'blockers');
  const title = blocker.slice(0, 140);
  return refresh(
    'so_save_task',
    {
      p_id: null,
      p_operator_id: text(fd, 'operator_id'),
      p_placement_id: text(fd, 'placement_id'),
      p_title: title.length >= 3 ? title : 'Clear the EOD blocker',
      p_note: `From the EOD blocker on ${text(fd, 'work_date')}.`,
      p_due_on: text(fd, 'due_on') || null,
      p_due_time: null,
      p_priority: fd.get('needs_help') === 'true' ? 'high' : 'normal',
      p_done: false,
    },
    'Task created.',
  );
}
