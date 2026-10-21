import 'server-only';

import { workspaceClient, type UntypedClient } from './db';
import {
  mapLeadEvent,
  mapPipelineLead,
  type Assignee,
  type LeadEvent,
  type Market,
  type PipelineLead,
} from './pipeline';

const LEAD_COLUMNS =
  'id, created_at, full_name, email, phone, company_name, coaching_niche, offer_line, market, stage, stage_changed_at, qualification_result, readiness_score, monthly_ad_spend, owner_id, next_action, first_touch_at, scheduled_for, meet_url, payload';

const LEAD_LIMIT = 2000;

export type StrategySession = {
  id: string;
  scheduledFor: string;
  timeZone: string;
  meetUrl: string;
  createdAt: string;
};

/** The latest go. strategy session per lead. */
async function latestSessions(supabase: UntypedClient, leadIds: string[]): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (leadIds.length === 0) return latest;
  const { data } = await supabase
    .from('go_strategy_bookings')
    .select('lead_id, scheduled_for')
    .in('lead_id', leadIds)
    .order('scheduled_for', { ascending: false });
  for (const row of data ?? []) {
    const leadId = String(row.lead_id ?? '');
    if (leadId && !latest.has(leadId)) latest.set(leadId, String(row.scheduled_for));
  }
  return latest;
}

export async function listAssignees(supabase?: UntypedClient | null): Promise<Assignee[]> {
  const client = supabase ?? (await workspaceClient());
  if (!client) return [];
  const { data, error } = await client.rpc('pipeline_assignees');
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: (typeof row.full_name === 'string' && row.full_name.trim()) || String(row.email ?? 'Staff'),
    role: String(row.role ?? ''),
  }));
}

export async function listMarkets(supabase?: UntypedClient | null): Promise<Market[]> {
  const client = supabase ?? (await workspaceClient());
  if (!client) return [];
  const { data, error } = await client
    .from('da_markets')
    .select('slug, label, active, sort_order')
    .order('sort_order')
    .order('label');
  if (error || !Array.isArray(data)) return [];
  return data.map((row: Record<string, unknown>) => ({
    slug: String(row.slug),
    label: String(row.label),
    active: row.active !== false,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 100,
  }));
}

export async function listPipelineLeads(): Promise<{
  leads: PipelineLead[];
  assignees: Assignee[];
  markets: Market[];
  truncated: boolean;
  error?: string;
}> {
  const empty = { leads: [], assignees: [], markets: [], truncated: false };
  const supabase = await workspaceClient();
  if (!supabase) return { ...empty, error: 'The database is not configured.' };

  const { data, error } = await supabase
    .from('da_leads')
    .select(LEAD_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(LEAD_LIMIT);
  if (error) return { ...empty, error: error.message };

  const rows = (data ?? []) as Record<string, unknown>[];
  const local = rows.filter((row) => row.offer_line === 'local').map((row) => String(row.id));
  const [sessions, assignees, markets] = await Promise.all([
    latestSessions(supabase, local),
    listAssignees(supabase),
    listMarkets(supabase),
  ]);

  return {
    leads: rows.map((row) => mapPipelineLead(row, sessions.get(String(row.id)) ?? null)),
    assignees,
    markets,
    truncated: rows.length >= LEAD_LIMIT,
  };
}

export type PipelineLeadDetail = {
  lead: PipelineLead;
  notes: string;
  payload: Record<string, unknown>;
  qualification: { result: string | null; score: number | null; programPrice: string; followUpOwner: string };
  events: LeadEvent[];
  sessions: StrategySession[];
  assignees: Assignee[];
  markets: Market[];
};

export async function getPipelineLead(id: string): Promise<PipelineLeadDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await workspaceClient();
  if (!supabase) return null;

  const { data: row, error } = await supabase
    .from('da_leads')
    .select(`${LEAD_COLUMNS}, notes, program_price, follow_up_owner`)
    .eq('id', id)
    .maybeSingle();
  if (error || !row) return null;

  const [{ data: events }, { data: sessions }, assignees, markets] = await Promise.all([
    supabase.from('da_lead_events').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(200),
    supabase
      .from('go_strategy_bookings')
      .select('id, scheduled_for, time_zone, meet_url, created_at')
      .eq('lead_id', id)
      .order('scheduled_for', { ascending: false }),
    listAssignees(supabase),
    listMarkets(supabase),
  ]);

  const sessionRows = (sessions ?? []) as Record<string, unknown>[];
  const raw = row as Record<string, unknown>;
  const lead = mapPipelineLead(raw, sessionRows[0] ? String(sessionRows[0].scheduled_for) : null);

  return {
    lead,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    payload:
      raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {},
    qualification: {
      result: lead.qualificationResult,
      score: lead.readinessScore,
      programPrice: typeof raw.program_price === 'string' ? raw.program_price : '',
      followUpOwner: typeof raw.follow_up_owner === 'string' ? raw.follow_up_owner : '',
    },
    events: ((events ?? []) as Record<string, unknown>[]).map(mapLeadEvent),
    sessions: sessionRows.map((session) => ({
      id: String(session.id),
      scheduledFor: String(session.scheduled_for),
      timeZone: String(session.time_zone ?? ''),
      meetUrl: typeof session.meet_url === 'string' ? session.meet_url : '',
      createdAt: String(session.created_at),
    })),
    assignees,
    markets,
  };
}
