'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCaseFileFolders, driveConfigured } from '@/lib/drive/client';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Writes. Every one goes through a database function so the rules live in one
 * place: the UI cannot lock a baseline, correct an entry, or archive a report by
 * any route other than the one that enforces the rule.
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Turns a Postgres error into the sentence the guard actually raised. */
function readable(error: { message: string } | null): string {
  if (!error) return 'Something went wrong.';
  // The functions raise `code: human sentence`, so drop the code prefix.
  // [\s\S] rather than the `s` flag, which needs a newer compile target.
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

const path = (slug: string) => `/da/${slug}`;

// ---------------------------------------------------------------------------
// Case files
// ---------------------------------------------------------------------------

export async function createCaseFileAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_case_file', {
    p_name: String(formData.get('name') ?? ''),
    p_vertical: (formData.get('vertical') as string) || undefined,
    p_contact_name: (formData.get('contact_name') as string) || undefined,
    p_contact_email: (formData.get('contact_email') as string) || undefined,
    p_engagement_start: (formData.get('engagement_start') as string) || undefined,
    p_retainer_amount: formData.get('retainer_amount') ? Number(formData.get('retainer_amount')) : undefined,
    p_revenue_goal_monthly: formData.get('revenue_goal_monthly')
      ? Number(formData.get('revenue_goal_monthly'))
      : undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const caseFile = data as unknown as Database['public']['Tables']['client_case_file']['Row'];

  // The Drive folder set is created up front so evidence has somewhere to land.
  // Without credentials the case file still works; the vault records metadata
  // and the folders can be attached later.
  if (driveConfigured()) {
    try {
      const folders = await createCaseFileFolders(caseFile.name, caseFile.slug);
      await supabase.rpc('register_drive_folders', {
        p_case_file_id: caseFile.id,
        p_root_folder_id: folders.root.id,
        p_root_folder_url: folders.root.webViewLink,
        p_subfolders: folders.subfolders,
      });
    } catch (driveError) {
      console.error('drive folder creation failed', driveError);
    }
  }

  revalidatePath('/da');
  redirect(path(caseFile.slug));
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

export async function captureBaselineAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const metrics: Record<string, { value: number | null; source: string; note: string | null }> = {};
  const leadSources: Record<string, number> = {};

  for (const [key, raw] of formData.entries()) {
    if (typeof raw !== 'string') continue;

    if (key.startsWith('metric.')) {
      const metricKey = key.slice('metric.'.length);
      if (raw.trim() === '') continue;
      metrics[metricKey] = {
        value: Number(raw),
        source: String(formData.get(`source.${metricKey}`) ?? 'measured'),
        note: (formData.get(`note.${metricKey}`) as string)?.trim() || null,
      };
    }

    if (key.startsWith('leadsource.') && raw.trim() !== '') {
      leadSources[key.slice('leadsource.'.length)] = Number(raw);
    }
  }

  const tooling = String(formData.get('tooling') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const { error } = await supabase.rpc('capture_baseline', {
    p_case_file_id: caseFileId,
    p_metrics: metrics,
    p_lead_sources: leadSources,
    p_tooling: tooling,
    p_notes: (formData.get('notes') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Baseline saved. It stays editable until the install begins.' };
}

export async function beginInstallAction(caseFileId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('begin_install', { p_case_file_id: caseFileId });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return {
    ok: true,
    message: 'Install started and the baseline is locked. From here it can only be annotated.',
  };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export async function takeSnapshotAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('take_snapshot', {
    p_case_file_id: caseFileId,
    p_period_start: (formData.get('period_start') as string) || undefined,
    p_period_end: (formData.get('period_end') as string) || undefined,
    p_metrics: {},
    p_trigger: 'manual',
    p_notes: (formData.get('notes') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Snapshot taken and locked. The numbers in it can no longer change.' };
}

export async function annotateSnapshotAction(
  snapshotId: string,
  slug: string,
  body: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('annotate_snapshot', { p_snapshot_id: snapshotId, p_body: body });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Annotation added. The measurements themselves are untouched.' };
}

export async function runDueSnapshotsAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('take_due_snapshots');

  if (error) return { ok: false, error: readable(error) };

  revalidatePath('/da');
  return { ok: true, message: `${data ?? 0} snapshot${data === 1 ? '' : 's'} taken.` };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function addMilestoneAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from('milestone').insert({
    case_file_id: caseFileId,
    occurred_on: String(formData.get('occurred_on')),
    type: formData.get('type') as Database['public']['Enums']['milestone_type'],
    title: String(formData.get('title')),
    description: (formData.get('description') as string) || null,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Milestone added to the timeline.' };
}

export async function detectMilestonesAction(caseFileId: string, slug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('detect_milestones', { p_case_file_id: caseFileId });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: `${data ?? 0} milestone${data === 1 ? '' : 's'} detected from tracking data.` };
}

// ---------------------------------------------------------------------------
// Effort, scope, decisions
// ---------------------------------------------------------------------------

export async function logEffortAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('log_effort', {
    p_case_file_id: caseFileId,
    p_performed_on: String(formData.get('performed_on')),
    p_phase: String(formData.get('phase')),
    p_description: String(formData.get('description')),
    p_hours: formData.get('hours') ? Number(formData.get('hours')) : undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Effort logged. It is immutable now; a change would create version 2.' };
}

export async function correctEffortAction(
  effortId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('correct_effort', {
    p_effort_id: effortId,
    p_performed_on: String(formData.get('performed_on')),
    p_phase: String(formData.get('phase')),
    p_description: String(formData.get('description')),
    p_hours: formData.get('hours') ? Number(formData.get('hours')) : (null as unknown as number),
    p_reason: String(formData.get('reason') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Correction filed. Both versions stay on the record.' };
}

export async function logScopeRequestAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('log_scope_request', {
    p_case_file_id: caseFileId,
    p_requested_on: String(formData.get('requested_on')),
    p_requested_by_name: (formData.get('requested_by_name') as string) || undefined,
    p_summary: String(formData.get('summary')),
    p_detail: (formData.get('detail') as string) || undefined,
    p_verdict: formData.get('verdict') as Database['public']['Enums']['scope_verdict'],
    p_reason: String(formData.get('reason') ?? ''),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Request logged with its verdict.' };
}

export async function quoteScopeAction(
  scopeRequestId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('quote_scope_request', {
    p_scope_request_id: scopeRequestId,
    p_proposed_on: String(formData.get('proposed_on')),
    p_summary: String(formData.get('summary')),
    p_amount: formData.get('amount') ? Number(formData.get('amount')) : (null as unknown as number),
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Quote recorded against the request.' };
}

export async function decideQuoteAction(
  quoteId: string,
  slug: string,
  status: 'accepted' | 'declined',
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('decide_quote', {
    p_quote_id: quoteId,
    p_status: status,
    p_note: note || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: `Quote marked ${status}.` };
}

export async function logDecisionAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('log_decision', {
    p_case_file_id: caseFileId,
    p_decided_on: String(formData.get('decided_on')),
    p_decided_by: String(formData.get('decided_by')),
    p_what_was_decided: String(formData.get('what_was_decided')),
    p_reasoning: String(formData.get('reasoning')),
    p_against_recommendation: formData.get('against_recommendation') === 'on',
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Decision recorded.' };
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export async function recordEvidenceAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('record_evidence', {
    p_case_file_id: caseFileId,
    p_category: formData.get('category') as Database['public']['Enums']['evidence_category'],
    p_drive_file_id: String(formData.get('drive_file_id')),
    p_filename: String(formData.get('filename')),
    p_what_it_proves: String(formData.get('what_it_proves') ?? ''),
    p_happened_on: (formData.get('happened_on') as string) || (null as unknown as string),
    p_drive_url: (formData.get('drive_url') as string) || undefined,
    p_mime_type: (formData.get('mime_type') as string) || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(path(slug));
  return { ok: true, message: 'Evidence recorded against the case file.' };
}

export async function shareEvidenceAction(
  evidenceId: string,
  slug: string,
  ttlMinutes: number,
  sharedWith: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_share_link', {
    p_evidence_id: evidenceId,
    p_ttl_minutes: ttlMinutes,
    p_shared_with: sharedWith || undefined,
  });

  if (error) return { ok: false, error: readable(error) };

  const link = data as unknown as Database['public']['Tables']['evidence_share_link']['Row'];

  revalidatePath(path(slug));
  return {
    ok: true,
    message: `Share link issued, expiring ${new Date(link.expires_at).toLocaleString('en-GB')}.`,
  };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function generateReportAction(
  caseFileId: string,
  slug: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const evidenceIds = formData.getAll('evidence_ids').map(String);

  const { data, error } = await supabase.rpc('generate_growth_report', {
    p_case_file_id: caseFileId,
    p_mode: formData.get('mode') as Database['public']['Enums']['report_mode'],
    p_period_start: String(formData.get('period_start')),
    p_period_end: String(formData.get('period_end')),
    p_evidence_ids: evidenceIds,
  });

  if (error) return { ok: false, error: readable(error) };

  const report = data as unknown as Database['public']['Tables']['growth_report']['Row'];

  revalidatePath(path(slug));
  redirect(`/da/${slug}/reports/${report.id}`);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/da', 'layout');
  redirect('/da');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/da', 'layout');
  redirect('/da');
}
