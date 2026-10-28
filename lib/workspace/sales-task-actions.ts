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
  revalidatePath('/workspace/sales-ops/tasks');
  revalidatePath('/workspace/sales-ops/tasks');
  revalidatePath('/workspace/operator/workspace');
  return { ok: true, message: ok };
}

export async function saveOperatorTaskAction(fd: FormData): Promise<ActionResult> {
  const dueTime = text(fd, 'due_time').slice(0, 5);
  return refresh(
    'so_save_task',
    {
      p_id: text(fd, 'id') || null,
      p_operator_id: text(fd, 'operator_id') || null,
      p_placement_id: text(fd, 'placement_id') || null,
      p_title: text(fd, 'title'),
      p_note: text(fd, 'note'),
      p_due_on: text(fd, 'due_on') || null,
      p_due_time: dueTime || null,
      p_priority: text(fd, 'priority') || 'normal',
      p_done: fd.get('done') === 'on',
    },
    'Task saved.',
  );
}

export async function deleteOperatorTaskAction(fd: FormData): Promise<ActionResult> {
  return refresh('so_delete_task', { p_id: text(fd, 'id') }, 'Task deleted.');
}
