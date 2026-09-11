import { requireAdmin, workspaceClient } from './db';
import {
  dormantRevenue,
  isDebriefOutcome,
  isDebriefTimeline,
  isFrontDeskSize,
  isPillarScore,
  isPracticeStage,
  mergeRequirementItems,
  type AuditRecord,
  type DebriefRecord,
  type PracticeListRow,
  type PracticeRecord,
  type RequirementsRecord,
} from './practices';
import type { PracticeType } from './calls';

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInteger(value: unknown): number | null {
  const n = asNumber(value);
  return n == null ? null : Math.trunc(n);
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length ? text : null;
}

function asPractice(row: Record<string, unknown>): PracticeRecord {
  const stage = isPracticeStage(String(row.stage ?? '')) ? row.stage : 'audit_scheduled';
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    call_id: asString(row.call_id),
    practice_name: String(row.practice_name ?? ''),
    contact_name: String(row.contact_name ?? ''),
    practice_type: row.practice_type as PracticeType,
    phone: asString(row.phone),
    email: asString(row.email),
    city: asString(row.city),
    state: asString(row.state),
    stage: stage as PracticeRecord['stage'],
  };
}

function asAudit(row: Record<string, unknown>): AuditRecord {
  const front = String(row.front_desk_size ?? '');
  const acq = String(row.pillar_acquisition ?? '');
  const react = String(row.pillar_reactivation ?? '');
  const show = String(row.pillar_showup ?? '');
  return {
    id: String(row.id),
    practice_id: String(row.practice_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: asString(row.completed_at),
    pms_in_use: asString(row.pms_in_use),
    front_desk_size: isFrontDeskSize(front) ? front : null,
    operatories: asInteger(row.operatories),
    current_ad_spend: asNumber(row.current_ad_spend),
    current_ad_channels: asString(row.current_ad_channels),
    phone_owner: asString(row.phone_owner),
    missed_calls_weekly: asInteger(row.missed_calls_weekly),
    existing_followup: asString(row.existing_followup),
    pillar_acquisition: isPillarScore(acq) ? acq : null,
    pillar_acquisition_note: asString(row.pillar_acquisition_note),
    pillar_reactivation: isPillarScore(react) ? react : null,
    pillar_reactivation_note: asString(row.pillar_reactivation_note),
    pillar_showup: isPillarScore(show) ? show : null,
    pillar_showup_note: asString(row.pillar_showup_note),
    recall_list_size: asInteger(row.recall_list_size),
    avg_hygiene_value: asNumber(row.avg_hygiene_value),
    unscheduled_treatment_value: asNumber(row.unscheduled_treatment_value),
    avg_new_patient_value: asNumber(row.avg_new_patient_value),
    current_no_show_rate: asNumber(row.current_no_show_rate),
    monthly_new_patients: asInteger(row.monthly_new_patients),
  };
}

function asDebrief(row: Record<string, unknown>): DebriefRecord {
  const outcome = String(row.outcome ?? '');
  const timeline = String(row.timeline ?? '');
  const objections = Array.isArray(row.objections_raised)
    ? row.objections_raised.filter((item): item is string => typeof item === 'string')
    : [];
  const fit = asInteger(row.fit_rating);
  return {
    id: String(row.id),
    practice_id: String(row.practice_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    outcome: isDebriefOutcome(outcome) ? outcome : null,
    biggest_leak: asString(row.biggest_leak),
    their_words: asString(row.their_words),
    objections_raised: objections,
    objection_notes: asString(row.objection_notes),
    decision_makers: asString(row.decision_makers),
    timeline: isDebriefTimeline(timeline) ? timeline : null,
    proposed_price: asNumber(row.proposed_price),
    next_step: asString(row.next_step),
    next_step_due: asString(row.next_step_due),
    fit_rating: fit != null && fit >= 1 && fit <= 5 ? fit : null,
    would_i_take_them: typeof row.would_i_take_them === 'boolean' ? row.would_i_take_them : null,
    notes: asString(row.notes),
  };
}

function asRequirements(row: Record<string, unknown>): RequirementsRecord {
  return {
    id: String(row.id),
    practice_id: String(row.practice_id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    sent_at: asString(row.sent_at),
    due_at: asString(row.due_at),
    items: mergeRequirementItems(row.items),
    pms_export_owner_name: asString(row.pms_export_owner_name),
    pms_export_owner_email: asString(row.pms_export_owner_email),
    pms_export_owner_phone: asString(row.pms_export_owner_phone),
    front_desk_owner_name: asString(row.front_desk_owner_name),
    decision_maker_name: asString(row.decision_maker_name),
  };
}

export async function listPractices(): Promise<PracticeListRow[]> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return [];

  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const practices = ((data as Record<string, unknown>[] | null) ?? []).map(asPractice);
  if (practices.length === 0) return [];

  const { data: auditRows, error: auditError } = await supabase
    .from('audits')
    .select('*')
    .in(
      'practice_id',
      practices.map((row) => row.id),
    );
  if (auditError) throw auditError;

  const audits = new Map(
    ((auditRows as Record<string, unknown>[] | null) ?? []).map((row) => {
      const audit = asAudit(row);
      return [audit.practice_id, audit] as const;
    }),
  );

  return practices.map((practice) => {
    const audit = audits.get(practice.id);
    return {
      ...practice,
      dormant_revenue: audit ? dormantRevenue(audit) : null,
    };
  });
}

export async function getPracticeBundle(id: string): Promise<{
  practice: PracticeRecord;
  audit: AuditRecord | null;
  debrief: DebriefRecord | null;
  requirements: RequirementsRecord | null;
} | null> {
  const session = await requireAdmin();
  const supabase = await workspaceClient();
  if (!session || !supabase) return null;

  const { data, error } = await supabase.from('practices').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [{ data: auditRow }, { data: debriefRow }, { data: requirementRow }] = await Promise.all([
    supabase.from('audits').select('*').eq('practice_id', id).maybeSingle(),
    supabase.from('debriefs').select('*').eq('practice_id', id).maybeSingle(),
    supabase.from('requirements').select('*').eq('practice_id', id).maybeSingle(),
  ]);

  return {
    practice: asPractice(data as Record<string, unknown>),
    audit: auditRow ? asAudit(auditRow as Record<string, unknown>) : null,
    debrief: debriefRow ? asDebrief(debriefRow as Record<string, unknown>) : null,
    requirements: requirementRow ? asRequirements(requirementRow as Record<string, unknown>) : null,
  };
}
