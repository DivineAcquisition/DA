import { requireAdmin, workspaceClient } from './db';
import type { HsCallAnswer, HsCallRecord } from './hs-calls';
import {
  isHsCallRole,
  isHsCallStatus,
  isHsCrewCount,
  isHsPhoneCoverage,
  isHsTrade,
  parseHsStageProgress,
  HS_STAGE_PROGRESS_KEY,
  type HsStageProgress,
} from './hs-calls';

function asCall(row: Record<string, unknown>): HsCallRecord {
  const status = isHsCallStatus(String(row.status ?? '')) ? row.status : 'scheduled';
  const trade = isHsTrade(String(row.trade ?? '')) ? row.trade : 'other';
  const role = isHsCallRole(String(row.role ?? '')) ? row.role : 'other';
  const crew = isHsCrewCount(String(row.crew_count ?? '')) ? row.crew_count : 'owner_only';
  const phone = isHsPhoneCoverage(String(row.who_answers_phone ?? '')) ? row.who_answers_phone : 'nobody';
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    contact_name: String(row.contact_name),
    company_name: String(row.company_name),
    trade: trade as HsCallRecord['trade'],
    role: role as HsCallRecord['role'],
    crew_count: crew as HsCallRecord['crew_count'],
    who_answers_phone: phone as HsCallRecord['who_answers_phone'],
    stated_pain: (row.stated_pain as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    status: status as HsCallRecord['status'],
    outcome_note: (row.outcome_note as string | null) ?? null,
    audit_booked_at: (row.audit_booked_at as string | null) ?? null,
    calendar_token: (row.calendar_token as string | null) ?? null,
    calendar_sent_at: (row.calendar_sent_at as string | null) ?? null,
  };
}

function asAnswer(row: Record<string, unknown>): HsCallAnswer {
  return {
    id: String(row.id),
    call_id: String(row.call_id),
    question_key: String(row.question_key),
    answer_text: (row.answer_text as string | null) ?? null,
    flagged: Boolean(row.flagged),
  };
}

export async function listHsCalls(): Promise<HsCallRecord[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];
  const { data } = await supabase.from('hs_calls').select('*').order('created_at', { ascending: false });
  return ((data as Record<string, unknown>[] | null) ?? []).map(asCall);
}

export async function getHsCallWorkspace(id: string): Promise<{
  call: HsCallRecord;
  answers: HsCallAnswer[];
  progress: HsStageProgress;
} | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;

  const { data: callRow } = await supabase.from('hs_calls').select('*').eq('id', id).maybeSingle();
  if (!callRow) return null;

  const { data: answerRows } = await supabase.from('hs_call_answers').select('*').eq('call_id', id);
  const answers = ((answerRows as Record<string, unknown>[] | null) ?? []).map(asAnswer);
  const progressRow = answers.find((row) => row.question_key === HS_STAGE_PROGRESS_KEY);
  const progress = parseHsStageProgress(progressRow?.answer_text);

  return { call: asCall(callRow as Record<string, unknown>), answers, progress };
}

/** Opening the workspace sets scheduled → in_progress. Nothing else changes status automatically. */
export async function ensureHsCallInProgress(id: string): Promise<HsCallRecord['status'] | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;
  await supabase.from('hs_calls').update({ status: 'in_progress' }).eq('id', id).eq('status', 'scheduled');
  const { data } = await supabase.from('hs_calls').select('status').eq('id', id).maybeSingle();
  const status = String(data?.status ?? '');
  return isHsCallStatus(status) ? status : null;
}
