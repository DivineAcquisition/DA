'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { isRecordId } from './cells';
import {
  CLOSED_WON_OUTCOME,
  DEBRIEF_CALL_TYPES,
  DEBRIEF_OBJECTIONS,
  DEBRIEF_OUTCOMES,
  DEBRIEF_OWNERS,
  DEBRIEF_TIMELINES,
  TOUCH_CHANNELS,
  TOUCH_OUTCOMES,
  TOUCH_SENTIMENTS,
  callsReady,
  type DebriefCallType,
  type DebriefObjection,
  type DebriefOutcome,
  type DebriefOwner,
  type DebriefTimeline,
  type TouchChannel,
  type TouchOutcome,
  type TouchSentiment,
} from './config';
import { conversionFrom, parseAirtableBaseId } from './conversion';
import { httpUrlOrEmpty, isDebriefComplete } from './map';
import { readOnboardToken, resolveOnboardTokenSecret } from './onboard-token';
import {
  attachDebriefArtifacts,
  confirmPaymentReceived,
  createTouch,
  getDebrief,
  getLead,
  getLeadProfile,
  listLeads,
  recordClientBase,
  saveCallBriefNote,
  saveClientOnboarding,
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
  revalidatePath(`/calls/${leadId}/onboard`);
  revalidatePath('/onboard', 'layout');
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
  if (!(await callsReady())) {
    return { ok: false, error: 'Airtable is not configured.' };
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
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

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
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

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
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

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
  const saved =
    complete && parsed.outcome === CLOSED_WON_OUTCOME
      ? 'closed-won'
      : complete
        ? 'debrief'
        : 'draft';
  redirect(`/calls/${parsed.leadId}?saved=${saved}`);
}

export async function attachTranscriptAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

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
    await attachDebriefArtifacts(leadId, debriefId, {
      transcript: transcript || undefined,
      recordingLink: recordingLink || undefined,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not attach the transcript.' };
  }

  revalidateLead(leadId);
  redirect(`/calls/${leadId}?saved=transcript`);
}

export async function confirmPaymentAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

  const leadId = formString(formData, 'leadId');
  if (!isRecordId(leadId)) return { ok: false, error: 'Missing lead.' };

  const profile = await getLeadProfile(leadId);
  if (!profile) return { ok: false, error: 'Lead not found.' };
  if (!conversionFrom(profile).converted) {
    return { ok: false, error: 'Payment confirmation is for Closed Won leads.' };
  }

  try {
    await confirmPaymentReceived(leadId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not confirm payment.' };
  }

  revalidateLead(leadId);
  redirect(`/calls/${leadId}?saved=payment`);
}

export async function recordClientBaseAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ('error' in admin) return { ok: false, error: admin.error };
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

  const leadId = formString(formData, 'leadId');
  const baseId = parseAirtableBaseId(formString(formData, 'baseId'));
  const name = formString(formData, 'baseName');
  const created = formString(formData, 'created');

  if (!isRecordId(leadId)) return { ok: false, error: 'Missing lead.' };
  if (!baseId) return { ok: false, error: 'Paste the new base id (app…) or its Airtable URL.' };
  if (!name) return { ok: false, error: 'Name the client base.' };

  const profile = await getLeadProfile(leadId);
  if (!profile) return { ok: false, error: 'Lead not found.' };
  if (!conversionFrom(profile).converted) {
    return { ok: false, error: 'Record a client base only after Closed Won.' };
  }

  try {
    await recordClientBase(leadId, { baseId, name, created: created || undefined });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not save the base.' };
  }

  revalidateLead(leadId);
  redirect(`/calls/${leadId}?saved=base`);
}

async function onboardLeadIdFromForm(formData: FormData): Promise<{ leadId: string } | { error: string }> {
  const fromToken = readOnboardToken(formString(formData, 'token'), await resolveOnboardTokenSecret());
  if (fromToken) return { leadId: fromToken };
  const admin = await requireAdmin();
  if ('error' in admin) return { error: 'This onboarding link is not valid.' };
  const leadId = formString(formData, 'leadId');
  if (!isRecordId(leadId)) return { error: 'Missing lead.' };
  return { leadId };
}

export async function submitClientOnboardingAction(formData: FormData): Promise<ActionResult> {
  if (!(await callsReady())) return { ok: false, error: 'Airtable is not configured.' };

  const identified = await onboardLeadIdFromForm(formData);
  if ('error' in identified) return { ok: false, error: identified.error };

  const profile = await getLeadProfile(identified.leadId);
  if (!profile) return { ok: false, error: 'Lead not found.' };

  const conversion = conversionFrom(profile);
  if (!conversion.converted) {
    return { ok: false, error: 'Onboarding is only for Closed Won leads.' };
  }
  if (!conversion.paymentConfirmed) {
    return { ok: false, error: 'Confirm Commas payment before submitting onboarding.' };
  }
  if (conversion.clientBase) {
    return { ok: false, error: 'This client already has an operating base. Nothing was written to the lead.' };
  }

  try {
    await saveClientOnboarding(
      {
        leadId: identified.leadId,
        businessName: formString(formData, 'businessName'),
        contactName: formString(formData, 'contactName'),
        email: formString(formData, 'email'),
        phone: formString(formData, 'phone'),
        followUpOwner: formString(formData, 'followUpOwner'),
        followUpHow: formString(formData, 'followUpHow'),
        programPrice: formString(formData, 'programPrice'),
        programPriceSource: '',
        decisionMakers: formString(formData, 'decisionMakers'),
        monthlyLeadVolume: formString(formData, 'monthlyLeadVolume'),
        crmAccess: formString(formData, 'crmAccess'),
        adminLogins: formString(formData, 'adminLogins'),
        databaseSize: formString(formData, 'databaseSize'),
        trainingSchedule: formString(formData, 'trainingSchedule'),
      },
      profile.lead.fullName,
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save onboarding.',
    };
  }

  revalidateLead(identified.leadId);
  const token = formString(formData, 'token');
  if (token) redirect(`/onboard/${token}?saved=1`);
  redirect(`/calls/${identified.leadId}?saved=onboarding`);
}

