import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Read helpers for the admin surface. RLS does the access control, so these are
 * plain queries: an operator's session simply returns nothing.
 */

export type CaseFileHealth = Database['public']['Views']['v_case_file_health']['Row'];
export type CaseFile = Database['public']['Tables']['client_case_file']['Row'];
export type Snapshot = Database['public']['Tables']['snapshot']['Row'];
export type SnapshotMetric = Database['public']['Tables']['snapshot_metric']['Row'];
export type MetricDefinition = Database['public']['Tables']['metric_definition']['Row'];
export type Milestone = Database['public']['Tables']['milestone']['Row'];
export type EvidenceItem = Database['public']['Tables']['evidence_item']['Row'];
export type EffortEntry = Database['public']['Tables']['effort_entry']['Row'];
export type ScopeRequest = Database['public']['Tables']['scope_request']['Row'];
export type ScopeQuote = Database['public']['Tables']['scope_quote']['Row'];
export type Decision = Database['public']['Tables']['decision']['Row'];
export type GrowthReport = Database['public']['Tables']['growth_report']['Row'];
export type GrowthRow = Database['public']['Functions']['growth_for_case_file']['Returns'][number];
export type SeriesPoint = Database['public']['Functions']['growth_series']['Returns'][number];

export async function listCaseFiles() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('v_case_file_health').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCaseFileBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_case_file')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getHealth(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('v_case_file_health')
    .select('*')
    .eq('id', caseFileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getGrowth(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('growth_for_case_file', { p_case_file_id: caseFileId });
  if (error) throw error;
  return data ?? [];
}

export async function getSeries(caseFileId: string, metricKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('growth_series', {
    p_case_file_id: caseFileId,
    p_metric_key: metricKey,
  });
  if (error) throw error;
  return data ?? [];
}

export async function getBaseline(caseFileId: string) {
  const supabase = await createClient();

  const { data: snapshot, error } = await supabase
    .from('snapshot')
    .select('*')
    .eq('case_file_id', caseFileId)
    .eq('kind', 'baseline')
    .maybeSingle();
  if (error) throw error;
  if (!snapshot) return null;

  const [{ data: metrics }, { data: leadSources }, { data: annotations }] = await Promise.all([
    supabase.from('snapshot_metric').select('*').eq('snapshot_id', snapshot.id),
    supabase.from('snapshot_lead_source').select('*').eq('snapshot_id', snapshot.id).order('source'),
    supabase
      .from('snapshot_annotation')
      .select('*')
      .eq('snapshot_id', snapshot.id)
      .order('created_at', { ascending: false }),
  ]);

  return {
    snapshot,
    metrics: metrics ?? [],
    leadSources: leadSources ?? [],
    annotations: annotations ?? [],
  };
}

export async function listSnapshots(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('snapshot')
    .select('*, snapshot_annotation(id, body, created_at)')
    .eq('case_file_id', caseFileId)
    .eq('kind', 'progress')
    .order('period_end', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMetricDefinitions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('metric_definition').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function listMilestones(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('milestone')
    .select('*')
    .eq('case_file_id', caseFileId)
    .order('occurred_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listEvidence(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('evidence_item')
    .select('*, evidence_share_link(id, expires_at, revoked_at, shared_with)')
    .eq('case_file_id', caseFileId)
    .order('happened_on', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function listEffort(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('effort_entry')
    .select('*')
    .eq('case_file_id', caseFileId)
    .order('performed_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listScope(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scope_request')
    .select('*, scope_quote(*)')
    .eq('case_file_id', caseFileId)
    .order('requested_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listDecisions(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('decision')
    .select('*')
    .eq('case_file_id', caseFileId)
    .order('decided_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listReports(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('growth_report')
    .select('id, mode, period_start, period_end, generated_at, drive_url, included_evidence_ids')
    .eq('case_file_id', caseFileId)
    .order('generated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getReport(reportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('growth_report').select('*').eq('id', reportId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listSnapshotsDue() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('snapshots_due');
  if (error) throw error;
  return data ?? [];
}

export async function getDriveFolders(caseFileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_file_drive_folder')
    .select('*')
    .eq('case_file_id', caseFileId);
  if (error) throw error;
  return data ?? [];
}
