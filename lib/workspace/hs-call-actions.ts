'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, workspaceClient } from './db';
import { getSettings } from './queries';
import { publicCalendarUrl } from './paths';
import { signingPublicBaseUrl } from './resolve-signing';
import { createToken } from './tokens';
import type { ActionResult } from './types';
import {
  blankToNull,
  HS_CALL_ROLES,
  HS_CALL_STATUSES,
  HS_CREW_COUNTS,
  HS_PHONE_COVERAGE,
  HS_STAGE_PROGRESS_KEY,
  HS_TRADES,
  isHsCallStageId,
  isHsCallStatus,
  type HsCallRole,
  type HsCallStageId,
  type HsCallStatus,
  type HsCrewCount,
  type HsPhoneCoverage,
  type HsTrade,
} from './hs-calls';

function revalidateHsCall(id?: string) {
  revalidatePath('/workspace/hs/calls');
  revalidatePath('/hs/calls');
  if (id) {
    revalidatePath(`/workspace/hs/calls/${id}`);
    revalidatePath(`/hs/calls/${id}`);
  }
}

function asTrade(value: string): HsTrade | null {
  return (HS_TRADES as readonly string[]).includes(value) ? (value as HsTrade) : null;
}

function asRole(value: string): HsCallRole | null {
  return (HS_CALL_ROLES as readonly string[]).includes(value) ? (value as HsCallRole) : null;
}

function asCrew(value: string): HsCrewCount | null {
  return (HS_CREW_COUNTS as readonly string[]).includes(value) ? (value as HsCrewCount) : null;
}

function asPhone(value: string): HsPhoneCoverage | null {
  return (HS_PHONE_COVERAGE as readonly string[]).includes(value) ? (value as HsPhoneCoverage) : null;
}

export async function createHsCallAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const contact_name = String(formData.get('contact_name') ?? '').trim();
  const company_name = String(formData.get('company_name') ?? '').trim();
  const trade = asTrade(String(formData.get('trade') ?? ''));
  const role = asRole(String(formData.get('role') ?? ''));
  const crew_count = asCrew(String(formData.get('crew_count') ?? ''));
  const who_answers_phone = asPhone(String(formData.get('who_answers_phone') ?? ''));
  const phone = blankToNull(String(formData.get('phone') ?? ''));
  const email = blankToNull(String(formData.get('email') ?? ''))?.toLowerCase() ?? null;
  const stated_pain = blankToNull(String(formData.get('stated_pain') ?? ''));
  const source = blankToNull(String(formData.get('source') ?? ''));

  if (!contact_name || !company_name || !trade || !role || !crew_count || !who_answers_phone) {
    return {
      ok: false,
      error: 'Contact name, company name, trade, role, crew count, and who answers the phone are required.',
    };
  }

  const { data, error } = await supabase
    .from('hs_calls')
    .insert({
      contact_name,
      company_name,
      trade,
      role,
      crew_count,
      who_answers_phone,
      phone,
      email,
      stated_pain,
      source,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Could not create the call.' };

  revalidateHsCall(String(data.id));
  redirect(`/workspace/hs/calls/${data.id}`);
}

export async function updateHsCallStatusAction(callId: string, status: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!isHsCallStatus(status)) return { ok: false, error: 'Unknown status.' };

  const { error } = await supabase.from('hs_calls').update({ status }).eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateHsCall(callId);
  return { ok: true, message: 'Status updated.' };
}

export async function saveHsCallNotesAction(callId: string, notes: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { error } = await supabase
    .from('hs_calls')
    .update({ outcome_note: blankToNull(notes) })
    .eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateHsCall(callId);
  return { ok: true, message: 'Notes saved.' };
}

export async function saveHsCallAnswerAction(input: {
  callId: string;
  questionKey: string;
  answerText: string;
  flagged: boolean;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { error } = await supabase.from('hs_call_answers').upsert(
    {
      call_id: input.callId,
      question_key: input.questionKey,
      answer_text: blankToNull(input.answerText),
      flagged: input.flagged,
    },
    { onConflict: 'call_id,question_key' },
  );
  if (error) return { ok: false, error: error.message };
  revalidateHsCall(input.callId);
  return { ok: true, message: 'Answer saved.' };
}

export async function saveHsStageProgressAction(
  callId: string,
  open: string,
  completed: string[],
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!isHsCallStageId(open)) return { ok: false, error: 'Unknown stage.' };

  const cleanCompleted = completed.filter((id): id is HsCallStageId => isHsCallStageId(id));
  const { error } = await supabase.from('hs_call_answers').upsert(
    {
      call_id: callId,
      question_key: HS_STAGE_PROGRESS_KEY,
      answer_text: JSON.stringify({ open, completed: cleanCompleted }),
      flagged: false,
    },
    { onConflict: 'call_id,question_key' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: 'Stage saved.' };
}

export async function generateHsCallCalendarLinkAction(callId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { data: existing } = await supabase
    .from('hs_calls')
    .select('calendar_token')
    .eq('id', callId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Call not found.' };

  const settings = await getSettings();
  const baseUrl = signingPublicBaseUrl(settings?.public_base_url);
  let token = (existing.calendar_token as string | null) ?? null;

  if (!token) {
    token = createToken();
    const { error } = await supabase.from('hs_calls').update({ calendar_token: token }).eq('id', callId);
    if (error) return { ok: false, error: error.message };
  }
  // Destination for /c/{token} is da_settings.default_booking_url (see migration).

  revalidateHsCall(callId);
  return {
    ok: true,
    message: 'Calendar link generated.',
    data: { url: publicCalendarUrl(baseUrl, token), token },
  };
}

export async function markHsCallCalendarSentAction(callId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { data: row } = await supabase
    .from('hs_calls')
    .select('calendar_token')
    .eq('id', callId)
    .maybeSingle();
  if (!row?.calendar_token) return { ok: false, error: 'Generate a calendar link first.' };

  const { error } = await supabase
    .from('hs_calls')
    .update({ calendar_sent_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateHsCall(callId);
  return { ok: true, message: 'Marked as sent.' };
}

export async function setHsCallOutcomeAction(
  callId: string,
  outcome: Extract<HsCallStatus, 'booked' | 'not_booked' | 'no_show'>,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!HS_CALL_STATUSES.includes(outcome)) return { ok: false, error: 'Unknown outcome.' };

  const patch: Record<string, unknown> = { status: outcome };
  if (outcome === 'booked') patch.audit_booked_at = new Date().toISOString();

  const { error } = await supabase.from('hs_calls').update(patch).eq('id', callId);
  if (error) return { ok: false, error: error.message };

  revalidateHsCall(callId);
  redirect('/workspace/hs/calls');
}
