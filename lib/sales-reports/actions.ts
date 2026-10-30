'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { testDestination } from '@/lib/sales-reports/deliver';
import { createClient } from '@/lib/supabase/server';

function text(fd: FormData, name: string) {
  return String(fd.get(name) ?? '').trim();
}

function emails(fd: FormData, name: string) {
  return text(fd, name).split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean);
}

async function run(fn: string, args: Record<string, unknown>, ok: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, fn, args);
  if (error) return { ok: false, error: readable(error) };
  revalidatePath('/workspace/team/workspace/reports');
  revalidatePath('/workspace/sales-ops');
  return { ok: true, message: ok };
}

export async function saveReportConfigAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_save_config', {
    p_placement: text(fd, 'placement_id'),
    p_body: {
      weekly_enabled: fd.get('weekly_enabled') === 'on',
      daily_enabled: fd.get('daily_enabled') === 'on',
      send_dow: text(fd, 'send_dow') || null,
      send_time: text(fd, 'send_time') || null,
      require_approval: fd.get('require_approval') === 'on',
      include_speed: fd.get('include_speed') === 'on',
      include_plan: fd.get('include_plan') === 'on',
      include_results: fd.get('include_results') === 'on',
      cc_manager: fd.get('cc_manager') === 'on',
      recipient_emails: fd.getAll('recipient').map(String),
      extra_emails: emails(fd, 'extra_emails'),
      extra_cc: emails(fd, 'extra_cc'),
    },
  }, 'Client reporting saved.');
}

export async function saveReportSecretAction(fd: FormData): Promise<ActionResult> {
  const value = text(fd, 'secret');
  if (!value) return { ok: true, message: 'Left the stored connection as it is.' };
  return run('so_report_store_secret', {
    p_kind: text(fd, 'kind'),
    p_value: value,
    p_placement: text(fd, 'placement_id') || null,
  }, 'Connection stored.');
}

export async function testReportDestinationAction(fd: FormData): Promise<ActionResult> {
  const kind = text(fd, 'kind') as 'discord_ops' | 'discord_esc' | 'airtable' | 'clickup' | 'drive';
  const error = await testDestination(kind);
  return error ? { ok: false, error } : { ok: true, message: 'Connection works.' };
}

export async function approveReportAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_approve', {
    p_id: text(fd, 'report_id'),
    p_summary: text(fd, 'summary'),
    p_next: text(fd, 'next_focus'),
    p_wins: fd.getAll('win').map(String),
    p_when: text(fd, 'when') || 'now',
  }, 'Report approved.');
}

export async function holdReportAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_hold', { p_id: text(fd, 'report_id'), p_note: text(fd, 'note') }, 'Report held.');
}

export async function testReportAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_test', { p_placement: text(fd, 'placement_id') }, 'Test report queued to you.');
}

export async function resendReportAction(fd: FormData): Promise<ActionResult> {
  const list = emails(fd, 'emails');
  return run('so_report_resend', { p_id: text(fd, 'report_id'), p_emails: list.length ? list : null }, 'Resend queued.');
}

export async function revokeReportAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_revoke', { p_token: text(fd, 'token_id') }, 'Link revoked.');
}

export async function reviewFeedbackAction(fd: FormData): Promise<ActionResult> {
  return run('so_report_feedback_review', { p_id: text(fd, 'feedback_id') }, 'Marked reviewed.');
}

export async function retryDeliveryAction(fd: FormData): Promise<ActionResult> {
  return run('so_delivery_retry', { p_id: text(fd, 'delivery_id') }, 'Retry queued.');
}
