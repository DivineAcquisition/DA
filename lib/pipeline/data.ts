import 'server-only';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { LeadDetail, PipelineRow } from './desk';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PipelineView = 'open' | 'closed' | 'all';

/** The database checks that the caller is DA Admin. */
export async function loadPipeline(view: PipelineView): Promise<{ data: PipelineRow[] | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<PipelineRow[]>(supabase, 'so_pipeline', { p_view: view });
  if (error || !data) return { data: null, error: readable(error) };
  return { data, error: null };
}

export async function loadLead(id: string): Promise<{ data: LeadDetail | null; error: string | null }> {
  if (!UUID.test(id)) return { data: null, error: 'That lead is not in the pipeline.' };
  const supabase = await createClient();
  const { data, error } = await controlRpc<LeadDetail>(supabase, 'so_pipeline_lead', { p_id: id });
  if (error || !data) return { data: null, error: readable(error) };
  return { data, error: null };
}
