import { requireAdmin, workspaceClient } from './db';
import type { CallAnswer, CallRecord } from './calls';
import { isCallStatus, parseStageProgress, STAGE_PROGRESS_KEY, type StageProgress } from './calls';

function asCall(row: Record<string, unknown>): CallRecord {
  const status = isCallStatus(String(row.status ?? '')) ? row.status : 'scheduled';
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    contact_name: String(row.contact_name),
    practice_name: String(row.practice_name),
    practice_type: row.practice_type as CallRecord['practice_type'],
    role: row.role as CallRecord['role'],
    front_desk_size: row.front_desk_size as CallRecord['front_desk_size'],
    stated_pain: (row.stated_pain as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    status: status as CallRecord['status'],
    outcome_note: (row.outcome_note as string | null) ?? null,
    audit_booked_at: (row.audit_booked_at as string | null) ?? null,
    calendar_token: (row.calendar_token as string | null) ?? null,
    calendar_sent_at: (row.calendar_sent_at as string | null) ?? null,
  };
}

function asAnswer(row: Record<string, unknown>): CallAnswer {
  return {
    id: String(row.id),
    call_id: String(row.call_id),
    question_key: String(row.question_key),
    answer_text: (row.answer_text as string | null) ?? null,
    flagged: Boolean(row.flagged),
  };
}

export async function listCalls(): Promise<CallRecord[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase.from('calls').select('*').order('created_at', { ascending: false });
  return ((data as Record<string, unknown>[] | null) ?? []).map(asCall);
}

export async function getCallWorkspace(id: string): Promise<{
  call: CallRecord;
  answers: CallAnswer[];
  progress: StageProgress;
} | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;

  const { data: callRow } = await supabase.from('calls').select('*').eq('id', id).maybeSingle();
  if (!callRow) return null;

  const { data: answerRows } = await supabase.from('call_answers').select('*').eq('call_id', id);
  const answers = ((answerRows as Record<string, unknown>[] | null) ?? []).map(asAnswer);
  const progressRow = answers.find((row) => row.question_key === STAGE_PROGRESS_KEY);
  const progress = parseStageProgress(progressRow?.answer_text);

  return { call: asCall(callRow as Record<string, unknown>), answers, progress };
}

/** Opening the workspace sets scheduled → in_progress. Nothing else changes status automatically. */
export async function ensureCallInProgress(id: string): Promise<CallRecord['status'] | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  await supabase.from('calls').update({ status: 'in_progress' }).eq('id', id).eq('status', 'scheduled');
  const { data } = await supabase.from('calls').select('status').eq('id', id).maybeSingle();
  const status = String(data?.status ?? '');
  return isCallStatus(status) ? status : null;
}
