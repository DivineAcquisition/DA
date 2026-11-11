'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { CALL_OUTCOMES, STAGES } from './desk';

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function refresh(leadId: string) {
  revalidatePath('/workspace/pipeline');
  revalidatePath(`/workspace/pipeline/${leadId}`);
}

export async function updateLeadAction(leadId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const stage = text(formData, 'stage');
  if (stage && !(STAGES as readonly string[]).includes(stage)) return { ok: false, error: 'Choose a stage from the list.' };
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'so_pipeline_update', {
    p_id: leadId,
    p_stage: stage || null,
    p_next_action: text(formData, 'next_action'),
    p_notes: text(formData, 'notes'),
  });
  if (error) return { ok: false, error: readable(error) };
  refresh(leadId);
  return { ok: true, message: 'Saved.' };
}

export async function logCallAction(leadId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const outcome = text(formData, 'outcome');
  if (!CALL_OUTCOMES.some((item) => item.value === outcome)) return { ok: false, error: 'Choose what happened on the call.' };
  const local = text(formData, 'occurred_at');
  const offset = Number(text(formData, 'tz_offset'));
  // The browser sends its local time and its UTC offset in minutes.
  let occurredAt: string | null = null;
  if (local) {
    const parsed = new Date(`${local}:00Z`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: 'Enter when the call happened.' };
    occurredAt = new Date(parsed.getTime() + (Number.isFinite(offset) ? offset : 0) * 60_000).toISOString();
  }
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'so_pipeline_log_call', {
    p_id: leadId,
    p_occurred_at: occurredAt,
    p_outcome: outcome,
    p_notes: text(formData, 'notes'),
    p_stage: null,
  });
  if (error) return { ok: false, error: readable(error) };
  refresh(leadId);
  return { ok: true, message: 'Call logged.' };
}
