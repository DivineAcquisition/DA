'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { isRecordId } from './cells';
import {
  DEBRIEF_CALL_TYPES,
  DEBRIEF_OBJECTIONS,
  DEBRIEF_OUTCOMES,
  DEBRIEF_OWNERS,
  DEBRIEF_TIMELINES,
  TOUCH_CHANNELS,
  TOUCH_OUTCOMES,
  TOUCH_SENTIMENTS,
  callsConfigured,
  type DebriefCallType,
  type DebriefObjection,
  type DebriefOutcome,
  type DebriefOwner,
  type DebriefTimeline,
  type TouchChannel,
  type TouchOutcome,
  type TouchSentiment,
} from './config';
import { httpUrlOrEmpty, isDebriefComplete } from './map';
import {
  attachDebriefRecording,
  attachDebriefTranscript,
  createTouch,
  getDebrief,
  getLead,
  listLeads,
  saveCallBriefNote,
  saveDebrief,
} from './queries';
import type { AuditDebriefInput, LeadRecord } from './types';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SearchResult = { ok: true; leads: LeadRecord[] } | { ok: false; error: string };

async function requireAdmin(): Promise<{ email: string } | { error: string }> {
  const session = await getSessionContext();
  if (!session?.isAdmin) return { error: 'Admin access required.' };
  return { email: session.email };
}

function revalidateLead(leadId: string) {
  revalidatePath('/calls');
  revalidatePath(`/calls/${leadId}`);
  revalidatePath(`/calls/${leadId}/brief`);
  revalidatePath(`/calls/${leadId}/phone`);
  revalidatePath(`/calls/${leadId}/audit`, 'layout');
}

function pick<T extends readonly string[]>(options: T, value: unknown): T[number] | null {
  const text = String(value ?? '').trim();
  return (options as readonly string[]).includes(text) ? (text as T[number]) : null;
}

function formString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  const session = await getSessionContext();
  if (!session?.isAdmin) {
    await supabase.auth.signOut();
    return { ok: false, error: 'This surface is admin-only.' };
  }

  revalidatePath('/calls', 'layout');
  redirect('/calls');
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/calls', 'layout');
  redirect('/calls');
}

export async function searchLeadsAction(query?: string): Promise<SearchResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!callsConfigured()) {
    return { ok: false, error: 'Airtable is not configured. Set AIRTABLE_API_KEY.' };
  }
  try {
    return { ok: true, leads: await listLeads(query) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Search failed.' };
  }
}

export async function saveBriefNoteAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!callsConfigured()) return { ok: false, error: 'Airtable is not configured.' };

  const leadId = formString(formData, 'leadId');
  if (!isRecordId(leadId)) return { ok: false, error: 'Missing lead.' };

  try {
    await saveCallBriefNote(leadId, formString(formData, 'note'));
    revalidateLead(leadId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the note.' };
  }
}

export async function logPhoneTouchAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!callsConfigured()) return { ok: false, error: 'Airtable is not configured.' };

  const leadId = formString(formData, 'leadId');
  const channel = pick(TOUCH_CHANNELS, formData.get('channel')) as TouchChannel | null;
  const outcome = pick(TOUCH_OUTCOMES, formData.get('outcome')) as TouchOutcome | null;
  const sentiment = pick(TOUCH_SENTIMENTS, formData.get('sentiment')) as TouchSentiment | null;
  const summary = formString(formData, 'summary');
  const recordingLink = httpUrlOrEmpty(formString(formData, 'recordingLink'));
  const transcript = formString(formData, 'transcript');

  if (!isRecordId(leadId)) return { ok: false, error: 'Pick a lead first.' };
  if (!channel) return { ok: false, error: 'Choose a channel.' };
  if (!outcome) return { ok: false, error: 'Choose an outcome.' };
  if (!sentiment) return { ok: false, error: 'Choose a sentiment.' };
  if (!summary) return { ok: false, error: 'Add a one-line summary.' };
  if (formString(formData, 'recordingLink') && !recordingLink) {
    return { ok: false, error: 'Recording link must be an http(s) URL.' };
  }

  const lead = await getLead(leadId);
  if (!lead) return { ok: false, error: 'Lead not found.' };

  try {
    await createTouch(
      {
        leadId,
        channel,
        outcome,
        sentiment,
        summary,
        recordingLink: recordingLink || undefined,
        transcript: transcript || undefined,
      },
      lead.fullName,
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not log the touch.' };
  }

  revalidateLead(leadId);
  redirect(`/calls/${leadId}?saved=touch`);
}

function debriefFromForm(formData: FormData, complete: boolean): AuditDebriefInput | { error: string } {
  const leadId = formString(formData, 'leadId');
  const debriefId = formString(formData, 'debriefId');
  const callDate = formString(formData, 'callDate');
  const recordingRaw = formString(formData, 'recordingLink');
  const recordingLink = httpUrlOrEmpty(recordingRaw);

  if (!isRecordId(leadId)) return { error: 'Pick a lead first.' };
  if (debriefId && !isRecordId(debriefId)) return { error: 'This debrief could not be found.' };
  if (!callDate) return { error: 'Set the call date.' };
  if (recordingRaw && !recordingLink) return { error: 'Recording link must be an http(s) URL.' };

  const closeRaw = formString(formData, 'closeConfidence');
  const amountRaw = formString(formData, 'amountQuoted');
  const closeConfidence = closeRaw ? Number(closeRaw) : null;
  const amountQuoted = amountRaw ? Number(amountRaw) : null;

  const input: AuditDebriefInput = {
    leadId,
    debriefId: debriefId || undefined,
    callDate,
    callType: (pick(DEBRIEF_CALL_TYPES, formData.get('callType')) as DebriefCallType | null) ?? '',
    owner: (pick(DEBRIEF_OWNERS, formData.get('owner')) as DebriefOwner | null) ?? '',
    statedGoal: formString(formData, 'statedGoal'),
    currentSituation: formString(formData, 'currentSituation'),
    whatTheyTried: formString(formData, 'whatTheyTried'),
    whyNow: formString(formData, 'whyNow'),
    outcome: (pick(DEBRIEF_OUTCOMES, formData.get('outcome')) as DebriefOutcome | null) ?? '',
    objection: (pick(DEBRIEF_OBJECTIONS, formData.get('objection')) as DebriefObjection | null) ?? '',
    amountQuoted: amountQuoted != null && Number.isFinite(amountQuoted) ? amountQuoted : null,
    decisionMakers: formString(formData, 'decisionMakers'),
    theirTimeline: (pick(DEBRIEF_TIMELINES, formData.get('theirTimeline')) as DebriefTimeline | null) ?? '',
    agreedNextStep: formString(formData, 'agreedNextStep'),
    nextStepDate: formString(formData, 'nextStepDate'),
    closeConfidence: closeConfidence != null && Number.isFinite(closeConfidence) ? closeConfidence : null,
    dealRisk: formString(formData, 'dealRisk'),
    recordingLink: recordingLink || undefined,
    transcript: formString(formData, 'transcript') || undefined,
    complete,
  };

  if (complete && !isDebriefComplete(input)) {
    return { error: 'Complete needs Outcome, Agreed Next Step, and Deal Risk.' };
  }

  return input;
}

export async function saveAuditDebriefAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!callsConfigured()) return { ok: false, error: 'Airtable is not configured.' };

  const complete = formString(formData, 'intent') !== 'draft';
  const parsed = debriefFromForm(formData, complete);
  if ('error' in parsed) return { ok: false, error: parsed.error };

  const lead = await getLead(parsed.leadId);
  if (!lead) return { ok: false, error: 'Lead not found.' };

  if (parsed.debriefId) {
    const existing = await getDebrief(parsed.debriefId);
    if (!existing || !existing.leadIds.includes(parsed.leadId)) {
      return { ok: false, error: 'This debrief could not be found for that lead.' };
    }
  }

  try {
    await saveDebrief(parsed, lead.fullName);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the debrief.' };
  }

  revalidateLead(parsed.leadId);
  redirect(`/calls/${parsed.leadId}?saved=${complete ? 'debrief' : 'draft'}`);
}

export async function attachTranscriptAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!callsConfigured()) return { ok: false, error: 'Airtable is not configured.' };

  const leadId = formString(formData, 'leadId');
  const debriefId = formString(formData, 'debriefId');
  const transcript = formString(formData, 'transcript');
  const recordingRaw = formString(formData, 'recordingLink');
  const recordingLink = httpUrlOrEmpty(recordingRaw);

  if (!isRecordId(leadId) || !isRecordId(debriefId)) {
    return { ok: false, error: 'Missing debrief.' };
  }
  if (!transcript && !recordingRaw) {
    return { ok: false, error: 'Paste a transcript or add a recording link.' };
  }
  if (recordingRaw && !recordingLink) {
    return { ok: false, error: 'Recording link must be an http(s) URL.' };
  }

  const existing = await getDebrief(debriefId);
  if (!existing || !existing.leadIds.includes(leadId)) {
    return { ok: false, error: 'This debrief could not be found for that lead.' };
  }

  try {
    if (transcript) await attachDebriefTranscript(debriefId, transcript);
    if (recordingLink) await attachDebriefRecording(debriefId, recordingLink);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not attach the transcript.' };
  }

  revalidateLead(leadId);
  redirect(`/calls/${leadId}?saved=transcript`);
}
