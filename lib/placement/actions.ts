'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { idempotencyKey } from '@/lib/email/policy';
import { sendAppEmail } from '@/lib/email/service';
import { proposeGhlMapping } from '@/lib/placement/ghl-read';
import { placementLetter } from '@/lib/placement/mail';
import { createClient } from '@/lib/supabase/server';

function revalidate() {
  revalidatePath('/workspace/placements');
  revalidatePath('/workspace/placements');
  revalidatePath('/workspace/operator/client');
}

async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  return { supabase, ...(await controlRpc<T>(supabase, fn, args)) };
}

export async function saveWizardAction(body: { id: string | null; step: number; payload: unknown }) {
  const { data, error } = await rpc<{ id: string; placement_id: string | null; checklist: unknown }>('so_wizard_save', { p_body: body });
  if (error || !data) return { ok: false as const, error: readable(error) };
  revalidate();
  return { ok: true as const, ...data };
}

export async function waiveLaunchAction(placementId: string, item: string, reason: string): Promise<ActionResult> {
  const { error } = await rpc('so_launch_waive', { p_placement: placementId, p_item: item, p_reason: reason });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  return { ok: true, message: 'Waiver saved.' };
}

export async function activateWizardAction(wizardId: string, mode: 'now' | 'schedule') {
  const { data, error } = await rpc<{ placement_id: string; status: string }>('so_wizard_activate', { p_wizard: wizardId, p_mode: mode });
  if (error || !data) return { ok: false as const, error: readable(error) };
  await dispatchPlacementMail();
  revalidate();
  return { ok: true as const, ...data };
}

export async function placementLifecycleAction(placementId: string, action: 'pause' | 'resume' | 'end', body: Record<string, unknown>) {
  const { data, error } = await rpc('so_placement_lifecycle', { p_placement: placementId, p_action: action, p_body: body });
  if (error) return { ok: false as const, error: readable(error) };
  await dispatchPlacementMail();
  revalidate();
  return { ok: true as const, data };
}

export async function swapPlacementAction(placementId: string, body: Record<string, unknown>) {
  const { data, error } = await rpc<{ wizard_id: string }>('so_placement_swap', { p_placement: placementId, p_body: body });
  if (error || !data) return { ok: false as const, error: readable(error) };
  await dispatchPlacementMail();
  revalidate();
  return { ok: true as const, wizardId: data.wizard_id };
}

export async function editPlacementAction(placementId: string, body: Record<string, unknown>): Promise<ActionResult> {
  const { error } = await rpc('so_placement_edit', { p_placement: placementId, p_body: body });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  return { ok: true, message: 'Saved. A schedule change on a live placement starts the next working day.' };
}

export async function saveTemplateAction(body: unknown): Promise<ActionResult> {
  const { error } = await rpc('so_template_save', { p_body: body });
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/sales-ops/templates');
  return { ok: true, message: 'Template saved. It prefills the next wizard. It does not create a placement.' };
}

export async function readGhlAction(input: {
  caseFileId: string;
  placementId: string;
  outcomes: Array<{ name: string }>;
  suggestions: { calendars?: string[]; stage?: string | null; tag?: string | null };
  tracksResults: boolean;
  tracksSpeed: boolean;
  tracksReactivation: boolean;
}) {
  const result = await proposeGhlMapping(input);
  if (!result.ok) return result;
  return { ok: true as const, proposal: result.proposal };
}

type MailJob = { id: string; placement_id: string | null; kind: string; payload: Record<string, unknown> };

const DONE = new Set(['sent', 'delivered', 'blocked', 'suppressed', 'delayed']);

/** Send placement letters that are due. Safe to call from a page load. */
export async function dispatchPlacementMail() {
  const supabase = await createClient();
  const { data } = await controlRpc<MailJob[]>(supabase, 'so_placement_mail_claim');
  for (const job of data ?? []) {
    const payload = job.payload ?? {};
    const to = Array.isArray(payload.to) ? payload.to.map(String).filter((email) => email.includes('@')) : [];
    if (to.length === 0) {
      await controlRpc(supabase, 'so_placement_mail_finish', { p_id: job.id, p_ok: true });
      continue;
    }
    const letter = placementLetter(job.kind, payload);
    const result = await sendAppEmail({
      purpose: letter.purpose,
      to,
      subject: letter.subject,
      html: letter.html,
      text: letter.text,
      template: job.kind,
      event: job.kind,
      idempotencyKey: idempotencyKey(['placement', job.id]),
      related: {
        placementId: job.placement_id,
        operatorId: typeof payload.operator_id === 'string' ? payload.operator_id : null,
        clientId: typeof payload.case_file_id === 'string' ? payload.case_file_id : null,
      },
      payload: { kind: job.kind, placementId: job.placement_id },
    });
    await controlRpc(supabase, 'so_placement_mail_finish', { p_id: job.id, p_ok: DONE.has(result.status) });
  }
}

export async function sweepPlacements() {
  const supabase = await createClient();
  await controlRpc(supabase, 'so_placement_sweep');
  await controlRpc(supabase, 'so_launch_sweep');
  await dispatchPlacementMail();
}

export async function releaseIntroductionAction(fd: FormData): Promise<ActionResult> {
  const placementId = String(fd.get('placement_id') ?? '');
  const { error } = await rpc('so_placement_release_intro', { p_placement: placementId });
  if (error) return { ok: false, error: readable(error) };
  await dispatchPlacementMail();
  revalidate();
  return { ok: true, message: 'The introduction was released and will send now.' };
}

export async function runHealthCheckAction(placementId: string) {
  const { data, error } = await rpc<{ overall: string; results: unknown }>('so_launch_health_run', {
    p_placement: placementId,
    p_source: 'manual',
  });
  if (error || !data) return { ok: false as const, error: readable(error) };
  await dispatchPlacementMail();
  revalidate();
  return { ok: true as const, overall: data.overall };
}

export async function confirmLaunchAction(placementId: string, item: string): Promise<ActionResult> {
  const { error } = await rpc('so_launch_confirm', { p_placement: placementId, p_item: item });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  return { ok: true, message: 'Confirmed.' };
}

export async function saveLaunchSettingsAction(placementId: string, body: Record<string, unknown>): Promise<ActionResult> {
  const { error } = await rpc('so_launch_settings', { p_placement: placementId, p_body: body });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  return { ok: true, message: 'Launch settings saved.' };
}

export async function reviewLaunchAction(placementId: string, decision: string, note: string): Promise<ActionResult> {
  const { error } = await rpc('so_launch_review', { p_placement: placementId, p_decision: decision, p_note: note });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  revalidatePath('/workspace/placements/launches');
  return { ok: true, message: 'Review saved. Nothing was sent to the operator or the client.' };
}

export async function resolveSetupMismatchAction(mismatchId: string): Promise<ActionResult> {
  const { error } = await rpc('so_launch_resolve_setup', { p_mismatch: mismatchId });
  if (error) return { ok: false, error: readable(error) };
  revalidate();
  return { ok: true, message: 'Marked as a setup issue. It stays out of the open integrity list.' };
}
