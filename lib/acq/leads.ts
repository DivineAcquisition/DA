import { serviceClient, workspaceClient } from '@/lib/workspace/db';
import { supabaseConfigured } from '@/lib/supabase/server';
import { CLOSED_STAGES } from './stages';
import type { QualificationPayload } from './qualify';
import { scoreQualification, type WorkspaceScore } from './score';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LeadRow = {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  coaching_niche: string;
  stage: string;
  qualification_result: string | null;
  readiness_score: number | null;
  monthly_ad_spend: string;
  follow_up_owner: string;
  program_price: string;
  next_action: string;
  ghl_contact_id: string;
  audit_booked_date: string;
  notes: string;
  meet_url: string;
  calendar_event_id: string;
  payload: Record<string, unknown>;
  airtable_record_id: string | null;
  airtable_synced_at: string | null;
  airtable_sync_error: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function mapStoredLead(raw: unknown): LeadRow {
  const row = asRecord(raw);
  const score = row.readiness_score;
  const parsed =
    typeof score === 'number' && Number.isFinite(score)
      ? score
      : score == null || score === ''
        ? null
        : Number(score);
  return {
    id: text(row, 'id'),
    created_at: text(row, 'created_at'),
    updated_at: text(row, 'updated_at'),
    full_name: text(row, 'full_name'),
    email: text(row, 'email').toLowerCase(),
    phone: text(row, 'phone'),
    company_name: text(row, 'company_name'),
    coaching_niche: text(row, 'coaching_niche'),
    stage: text(row, 'stage') || 'Step 1 Captured',
    qualification_result: text(row, 'qualification_result') || null,
    readiness_score: parsed != null && Number.isFinite(parsed) ? parsed : null,
    monthly_ad_spend: text(row, 'monthly_ad_spend'),
    follow_up_owner: text(row, 'follow_up_owner'),
    program_price: text(row, 'program_price'),
    next_action: text(row, 'next_action'),
    ghl_contact_id: text(row, 'ghl_contact_id'),
    audit_booked_date: text(row, 'audit_booked_date'),
    notes: text(row, 'notes'),
    meet_url: text(row, 'meet_url'),
    calendar_event_id: text(row, 'calendar_event_id'),
    payload: asRecord(row.payload),
    airtable_record_id: text(row, 'airtable_record_id') || null,
    airtable_synced_at: text(row, 'airtable_synced_at') || null,
    airtable_sync_error: text(row, 'airtable_sync_error') || null,
  };
}

export function isWorkspaceLeadId(id: string): boolean {
  return UUID_RE.test(id);
}

export function sanitizeLikeQuery(query: string): string {
  return query
    .replace(/[{}%_,\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function leadMatchesQuery(
  lead: Pick<LeadRow, 'full_name' | 'email' | 'company_name' | 'phone' | 'coaching_niche'>,
  query: string,
): boolean {
  const needle = sanitizeLikeQuery(query).toLowerCase();
  if (!needle) return true;
  return [lead.full_name, lead.email, lead.company_name, lead.phone, lead.coaching_niche]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function isBookableLead(
  lead: Pick<LeadRow, 'qualification_result' | 'stage'>,
  includeManualReview = false,
): boolean {
  if ((CLOSED_STAGES as readonly string[]).includes(lead.stage)) return false;
  if (lead.qualification_result === 'Qualified') return true;
  return includeManualReview && lead.qualification_result === 'Manual Review';
}

export function leadWriteFromQualification(
  payload: QualificationPayload,
  extras: { ghlContactId?: string; score: WorkspaceScore; existing?: LeadRow | null },
): Record<string, unknown> {
  return {
    full_name: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    company_name: payload.companyName,
    coaching_niche: payload.coachingNiche,
    stage: extras.existing?.stage || payload.stage,
    qualification_result: extras.score.qualificationResult,
    readiness_score: extras.score.readinessScore,
    monthly_ad_spend: payload.monthlyAdSpend,
    follow_up_owner: payload.followUpOwner,
    program_price: payload.programPrice,
    ghl_contact_id: extras.ghlContactId ?? extras.existing?.ghl_contact_id ?? '',
    payload: {
      ...(extras.existing?.payload ?? {}),
      tracking: payload.tracking,
      source: payload.source,
      tags: payload.tags,
    },
  };
}

async function writeClient(preferService: boolean) {
  if (!supabaseConfigured) return null;
  if (preferService) {
    const service = serviceClient();
    if (service) return service;
  }
  return workspaceClient();
}

export async function getLeadRow(id: string): Promise<LeadRow | null> {
  if (!isWorkspaceLeadId(id) || !supabaseConfigured) return null;
  const supabase = await workspaceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('da_leads').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return mapStoredLead(data);
}

export async function searchLeadRows(input: {
  query?: string;
  includeManualReview?: boolean;
  bookedOnly?: boolean;
  limit?: number;
} = {}): Promise<LeadRow[]> {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured. Prospect records live in the workspace.');
  }
  const supabase = await workspaceClient();
  if (!supabase) {
    throw new Error('Could not open the workspace database.');
  }

  const limit = Math.max(1, Math.min(input.limit ?? 40, 50));
  let query = supabase.from('da_leads').select('*').limit(80);

  if (input.bookedOnly) {
    query = query.eq('stage', 'Audit Booked').order('audit_booked_date', { ascending: false });
  } else {
    const results = input.includeManualReview
      ? ['Qualified', 'Manual Review']
      : ['Qualified'];
    query = query
      .in('qualification_result', results)
      .order('readiness_score', { ascending: false, nullsFirst: false });
  }

  const needle = sanitizeLikeQuery(input.query ?? '');
  if (needle) {
    const like = `%${needle}%`;
    query = query.or(
      `full_name.ilike.${like},email.ilike.${like},company_name.ilike.${like},phone.ilike.${like},coaching_niche.ilike.${like}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || 'Could not search workspace leads.');
  }

  const rows = (data ?? []).map(mapStoredLead);
  const filtered = input.bookedOnly
    ? rows
    : rows.filter((row) => isBookableLead(row, Boolean(input.includeManualReview)));
  return filtered.slice(0, limit);
}

export async function upsertLeadFromQualification(
  payload: QualificationPayload,
  ghlContactId: string,
  preferService = true,
): Promise<LeadRow> {
  const supabase = await writeClient(preferService);
  if (!supabase) {
    throw new Error('Supabase is not configured. The workspace cannot store this lead.');
  }

  const score = scoreQualification(payload);
  const { data: existingRaw } = await supabase
    .from('da_leads')
    .select('*')
    .eq('email', payload.email)
    .maybeSingle();
  const existing = existingRaw ? mapStoredLead(existingRaw) : null;
  const write = leadWriteFromQualification(payload, { ghlContactId, score, existing });

  const { data, error } = existing
    ? await supabase.from('da_leads').update(write).eq('id', existing.id).select('*').single()
    : await supabase.from('da_leads').insert(write).select('*').single();

  if (error || !data) {
    throw new Error(error?.message || 'Could not save the lead in the workspace.');
  }
  return mapStoredLead(data);
}

export async function applyBookingToLead(input: {
  leadId: string;
  email: string;
  fullName: string;
  companyName?: string;
  auditBookedDate: string;
  notes: string;
  stage: string;
  meetUrl?: string | null;
  eventId?: string | null;
}): Promise<LeadRow> {
  const supabase = await workspaceClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. The booking has to land in the workspace.');
  }

  const patch: Record<string, unknown> = {
    email: input.email,
    full_name: input.fullName,
    audit_booked_date: input.auditBookedDate,
    notes: input.notes,
    stage: input.stage,
  };
  if (input.companyName) patch.company_name = input.companyName;
  if (input.meetUrl) patch.meet_url = input.meetUrl;
  if (input.eventId) patch.calendar_event_id = input.eventId;

  const { data, error } = await supabase
    .from('da_leads')
    .update(patch)
    .eq('id', input.leadId)
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Could not save the booking on the workspace lead.');
  }
  return mapStoredLead(data);
}

export async function markLeadAirtable(
  leadId: string,
  input: { recordId?: string | null; error?: string | null },
  preferService = false,
): Promise<void> {
  const supabase = await writeClient(preferService);
  if (!supabase) return;
  const patch: Record<string, unknown> = input.error
    ? { airtable_sync_error: input.error.slice(0, 2000) }
    : {
        airtable_record_id: input.recordId ?? null,
        airtable_synced_at: new Date().toISOString(),
        airtable_sync_error: null,
      };
  await supabase.from('da_leads').update(patch).eq('id', leadId);
}
