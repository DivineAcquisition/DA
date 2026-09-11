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
  CALL_ROLES,
  CALL_STATUSES,
  FRONT_DESK_SIZES,
  isCallStageId,
  isCallStatus,
  PRACTICE_TYPES,
  STAGE_PROGRESS_KEY,
  type CallRole,
  type CallStageId,
  type CallStatus,
  type FrontDeskSize,
  type PracticeType,
} from './calls';

function revalidateCall(id?: string) {
  revalidatePath('/workspace/calls');
  revalidatePath('/calls');
  revalidatePath('/workspace/hs/calls');
  revalidatePath('/hs/calls');
  if (id) {
    revalidatePath(`/workspace/calls/${id}`);
    revalidatePath(`/calls/${id}`);
  }
}

function asPracticeType(value: string): PracticeType | null {
  return (PRACTICE_TYPES as readonly string[]).includes(value) ? (value as PracticeType) : null;
}

function asRole(value: string): CallRole | null {
  return (CALL_ROLES as readonly string[]).includes(value) ? (value as CallRole) : null;
}

function asFrontDesk(value: string): FrontDeskSize | null {
  return (FRONT_DESK_SIZES as readonly string[]).includes(value) ? (value as FrontDeskSize) : null;
}

export async function createCallAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const contact_name = String(formData.get('contact_name') ?? '').trim();
  const practice_name = String(formData.get('practice_name') ?? '').trim();
  const practice_type = asPracticeType(String(formData.get('practice_type') ?? ''));
  const role = asRole(String(formData.get('role') ?? ''));
  const front_desk_size = asFrontDesk(String(formData.get('front_desk_size') ?? ''));
  const phone = blankToNull(String(formData.get('phone') ?? ''));
  const email = blankToNull(String(formData.get('email') ?? ''))?.toLowerCase() ?? null;
  const stated_pain = blankToNull(String(formData.get('stated_pain') ?? ''));
  const source = blankToNull(String(formData.get('source') ?? ''));

  if (!contact_name || !practice_name || !practice_type || !role || !front_desk_size) {
    return { ok: false, error: 'Contact name, practice name, practice type, role, and front desk size are required.' };
  }

  const { data, error } = await supabase
    .from('calls')
    .insert({
      contact_name,
      practice_name,
      practice_type,
      role,
      front_desk_size,
      phone,
      email,
      stated_pain,
      source,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Could not create the call.' };

  revalidateCall(String(data.id));
  redirect(`/workspace/calls/${data.id}`);
}

export async function updateCallStatusAction(callId: string, status: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!isCallStatus(status)) return { ok: false, error: 'Unknown status.' };

  const { error } = await supabase.from('calls').update({ status }).eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateCall(callId);
  return { ok: true, message: 'Status updated.' };
}

export async function saveCallNotesAction(callId: string, notes: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { error } = await supabase
    .from('calls')
    .update({ outcome_note: blankToNull(notes) })
    .eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateCall(callId);
  return { ok: true, message: 'Notes saved.' };
}

export async function saveCallAnswerAction(input: {
  callId: string;
  questionKey: string;
  answerText: string;
  flagged: boolean;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { error } = await supabase.from('call_answers').upsert(
    {
      call_id: input.callId,
      question_key: input.questionKey,
      answer_text: blankToNull(input.answerText),
      flagged: input.flagged,
    },
    { onConflict: 'call_id,question_key' },
  );
  if (error) return { ok: false, error: error.message };
  revalidateCall(input.callId);
  return { ok: true, message: 'Answer saved.' };
}

export async function saveStageProgressAction(
  callId: string,
  open: string,
  completed: string[],
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!isCallStageId(open)) return { ok: false, error: 'Unknown stage.' };

  const cleanCompleted = completed.filter((id): id is CallStageId => isCallStageId(id));
  const { error } = await supabase.from('call_answers').upsert(
    {
      call_id: callId,
      question_key: STAGE_PROGRESS_KEY,
      answer_text: JSON.stringify({ open, completed: cleanCompleted }),
      flagged: false,
    },
    { onConflict: 'call_id,question_key' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: 'Stage saved.' };
}

export async function generateCallCalendarLinkAction(callId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { data: existing } = await supabase
    .from('calls')
    .select('calendar_token')
    .eq('id', callId)
    .maybeSingle();
  if (!existing) return { ok: false, error: 'Call not found.' };

  const settings = await getSettings();
  const baseUrl = signingPublicBaseUrl(settings?.public_base_url);
  let token = (existing.calendar_token as string | null) ?? null;

  if (!token) {
    token = createToken();
    const { error } = await supabase.from('calls').update({ calendar_token: token }).eq('id', callId);
    if (error) return { ok: false, error: error.message };
  }
  // Destination for /c/{token} is da_settings.default_booking_url (see migration).

  revalidateCall(callId);
  return {
    ok: true,
    message: 'Calendar link generated.',
    data: { url: publicCalendarUrl(baseUrl, token), token },
  };
}

export async function markCallCalendarSentAction(callId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };

  const { data: row } = await supabase
    .from('calls')
    .select('calendar_token')
    .eq('id', callId)
    .maybeSingle();
  if (!row?.calendar_token) return { ok: false, error: 'Generate a calendar link first.' };

  const { error } = await supabase
    .from('calls')
    .update({ calendar_sent_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) return { ok: false, error: error.message };
  revalidateCall(callId);
  return { ok: true, message: 'Marked as sent.' };
}

export async function setCallOutcomeAction(
  callId: string,
  outcome: Extract<CallStatus, 'booked' | 'not_booked' | 'no_show'>,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return { ok: false, error: 'Admin access required.' };
  if (!CALL_STATUSES.includes(outcome)) return { ok: false, error: 'Unknown outcome.' };

  const patch: Record<string, unknown> = { status: outcome };
  if (outcome === 'booked') patch.audit_booked_at = new Date().toISOString();

  const { error } = await supabase.from('calls').update(patch).eq('id', callId);
  if (error) return { ok: false, error: error.message };

  revalidateCall(callId);
  redirect('/workspace/calls');
}
