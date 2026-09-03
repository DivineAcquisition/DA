import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient, supabaseConfigured } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/workspace/db';
import type { ProspectCall, ProspectCallKind, ProspectCallSource } from './types';

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function mapProspectCall(raw: unknown): ProspectCall {
  const row = asRecord(raw);
  const payload = asRecord(row.payload);
  const kind = text(row, 'kind');
  const source = text(row, 'source');
  return {
    id: text(row, 'id'),
    airtableLeadId: text(row, 'airtable_lead_id'),
    email: text(row, 'email'),
    fullName: text(row, 'full_name'),
    kind: (kind as ProspectCallKind) || 'booking',
    source: (source as ProspectCallSource) || 'operator',
    externalRef: text(row, 'external_ref'),
    occurredAt: text(row, 'occurred_at'),
    meetUrl: text(row, 'meet_url'),
    recordingUrl: text(row, 'recording_url'),
    transcript: text(row, 'transcript'),
    googleEventId: text(row, 'google_event_id'),
    payload,
    airtableTouchId: text(row, 'airtable_touch_id'),
    airtableDebriefId: text(row, 'airtable_debrief_id'),
    airtableSyncedAt: text(row, 'airtable_synced_at') || null,
    airtableSyncError: text(row, 'airtable_sync_error') || null,
  };
}

async function rpcClient(preferService = false): Promise<RpcClient> {
  if (preferService) {
    const service = serviceClient();
    if (service) return service as unknown as RpcClient;
  }
  return (await createClient()) as unknown as RpcClient;
}

export type RecordProspectCallInput = {
  id?: string;
  airtableLeadId?: string;
  email?: string;
  fullName?: string;
  kind: ProspectCallKind;
  source: ProspectCallSource;
  externalRef?: string;
  occurredAt?: string;
  meetUrl?: string;
  recordingUrl?: string;
  transcript?: string;
  googleEventId?: string;
  airtableTouchId?: string;
  airtableDebriefId?: string;
  payload?: Record<string, unknown>;
};

export function prospectCallRow(input: RecordProspectCallInput): Record<string, unknown> {
  return {
    id: input.id || undefined,
    airtable_lead_id: input.airtableLeadId || undefined,
    email: input.email || undefined,
    full_name: input.fullName || undefined,
    kind: input.kind,
    source: input.source,
    external_ref: input.externalRef || undefined,
    occurred_at: input.occurredAt || undefined,
    meet_url: input.meetUrl || undefined,
    recording_url: input.recordingUrl || undefined,
    transcript: input.transcript || undefined,
    google_event_id: input.googleEventId || undefined,
    airtable_touch_id: input.airtableTouchId || undefined,
    airtable_debrief_id: input.airtableDebriefId || undefined,
    payload: input.payload ?? {},
  };
}

export async function recordProspectCall(input: RecordProspectCallInput): Promise<ProspectCall> {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured. Call data has to land here before Airtable.');
  }
  const supabase = await createClient();
  const { data, error } = await controlRpc<Record<string, unknown>>(supabase, 'da_record_prospect_call', {
    p_row: prospectCallRow(input),
  });
  if (error || !data) {
    throw new Error(readable(error) || 'Could not log the call in Supabase.');
  }
  return mapProspectCall(data);
}

export async function receiveProspectCall(
  secret: string,
  input: RecordProspectCallInput,
  client?: RpcClient,
): Promise<ProspectCall> {
  const supabase = client ?? (await rpcClient(true));
  const { data, error } = await controlRpc<Record<string, unknown>>(
    supabase as never,
    'da_receive_prospect_call',
    { p_secret: secret, p_row: prospectCallRow(input) },
  );
  if (error || !data) {
    throw new Error(readable(error) || 'Could not receive the call in Supabase.');
  }
  return mapProspectCall(data);
}

export async function markProspectCallAirtable(
  input: {
    id: string;
    airtableLeadId?: string;
    airtableTouchId?: string;
    airtableDebriefId?: string;
    error?: string | null;
  },
  preferService = false,
): Promise<ProspectCall> {
  const supabase = await rpcClient(preferService);
  const { data, error } = await controlRpc<Record<string, unknown>>(
    supabase as never,
    'da_mark_prospect_call_airtable',
    {
      p_id: input.id,
      p_airtable_lead_id: input.airtableLeadId ?? null,
      p_airtable_touch_id: input.airtableTouchId ?? null,
      p_airtable_debrief_id: input.airtableDebriefId ?? null,
      p_error: input.error ?? null,
    },
  );
  if (error || !data) {
    throw new Error(readable(error) || 'Could not mark the Airtable send.');
  }
  return mapProspectCall(data);
}

export async function listProspectCalls(airtableLeadId: string): Promise<ProspectCall[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await controlRpc<unknown[]>(supabase, 'da_list_prospect_calls', {
    p_airtable_lead_id: airtableLeadId,
  });
  if (error) {
    console.error('da_list_prospect_calls', error.message);
    return [];
  }
  return (data ?? []).map(mapProspectCall);
}

export async function listUnsyncedProspectCalls(limit = 40): Promise<ProspectCall[]> {
  const supabase = await rpcClient(true);
  const { data, error } = await controlRpc<unknown[]>(supabase as never, 'da_list_unsynced_prospect_calls', {
    p_limit: limit,
  });
  if (error) throw new Error(readable(error) || 'Could not list unsynced calls.');
  return (data ?? []).map(mapProspectCall);
}

export async function readPipelineCallSecret(): Promise<string> {
  const supabase = await rpcClient(true);
  const { data } = await controlRpc<string>(supabase as never, 'da_get_pipeline_call_secret', {});
  return (data ?? '').trim();
}
