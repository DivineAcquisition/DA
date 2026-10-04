'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession, academyHoldSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';

function ids(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((value) => String(value)).filter((value) => value.length > 0);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function holdCall(path: string, fn: string, args: Record<string, unknown>) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) redirect(`${path}?error=${encodeURIComponent(readable(error))}`);
  revalidatePath(path);
}

export async function saveHoldChecklist(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  await holdCall(path, 'academy_hold_save_checklist', {
    p_hold_id: holdId,
    p_call_on: String(formData.get('call_on') ?? '') || null,
    p_call_note: String(formData.get('call_note') ?? ''),
    p_concept_note: String(formData.get('concept_note') ?? ''),
    p_reason: String(formData.get('reason') ?? ''),
    p_struggle_note: String(formData.get('struggle_note') ?? ''),
  });
}

export async function addHoldNote(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  await holdCall(path, 'academy_hold_add_note', {
    p_hold_id: holdId,
    p_body: String(formData.get('body') ?? ''),
  });
}

export async function resolveHold(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  await holdCall(path, 'academy_hold_resolve', {
    p_hold_id: holdId,
    p_outcome: String(formData.get('outcome') ?? ''),
    p_plan: String(formData.get('plan') ?? ''),
    p_attempts: numberOrNull(formData.get('attempts')),
    p_retest: String(formData.get('retest') ?? '') || null,
    p_lesson_ids: ids(formData, 'lesson'),
    p_module_ids: ids(formData, 'module'),
  });
}

export async function requestHoldRelease(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  await holdCall(path, 'academy_hold_request_release', {
    p_hold_id: holdId,
    p_reason: String(formData.get('reason') ?? ''),
    p_note: String(formData.get('note') ?? ''),
  });
}

export async function confirmHoldRelease(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_confirm_release', { p_hold_id: holdId });
  if (error) redirect(`${path}?error=${encodeURIComponent(readable(error))}`);
  revalidatePath(path);
}

export async function reopenHold(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_reopen', {
    p_hold_id: holdId,
    p_note: String(formData.get('note') ?? ''),
  });
  if (error) redirect(`${path}?error=${encodeURIComponent(readable(error))}`);
  revalidatePath(path);
}

export async function assignHold(formData: FormData) {
  const holdId = String(formData.get('hold') ?? '');
  const path = `/workspace/academy/holds/${holdId}`;
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_assign', {
    p_hold_id: holdId,
    p_reviewer_id: String(formData.get('reviewer') ?? ''),
  });
  if (error) redirect(`${path}?error=${encodeURIComponent(readable(error))}`);
  revalidatePath(path);
  revalidatePath('/workspace/academy/holds');
}

export async function saveHoldSettings(formData: FormData) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_save_settings', {
    p_days: Number(formData.get('days')),
    p_attempts: Number(formData.get('attempts')),
  });
  if (error) redirect(`/workspace/academy/holds/summary?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/holds/summary');
}

export async function saveHoldList(formData: FormData) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/login');
  const labels = String(formData.get('labels') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_save_list', {
    p_kind: String(formData.get('kind') ?? ''),
    p_labels: labels,
  });
  if (error) redirect(`/workspace/academy/holds/summary?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/workspace/academy/holds/summary');
}

export async function acknowledgePlan(formData: FormData) {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'academy_hold_acknowledge', {
    p_hold_id: String(formData.get('hold') ?? ''),
  });
  if (error) redirect(`/academy?error=${encodeURIComponent(readable(error))}`);
  revalidatePath('/academy');
}
