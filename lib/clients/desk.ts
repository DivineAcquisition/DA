import 'server-only';

import { createClient, getSessionContext } from '@/lib/supabase/server';
import type { UntypedClient } from '@/lib/workspace/db';
import type { CaseFile } from '@/lib/da/queries';

/**
 * Reads for the Clients desk. One client is one client_case_file with
 * record_kind = client, and everything about the engagement hangs off it.
 */

export const ENGAGEMENT_STATUSES = ['audit', 'installing', 'active', 'paused', 'ended'] as const;
export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

export const STATUS_LABEL: Record<EngagementStatus, string> = {
  audit: 'Audit',
  installing: 'Installing',
  active: 'Active',
  paused: 'Paused',
  ended: 'Ended',
};

export const CLIENT_TABS = ['relationship', 'business', 'access', 'growth', 'team', 'delivery'] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

export const TAB_LABEL: Record<ClientTab, string> = {
  relationship: 'Relationship',
  business: 'Business',
  access: 'Access',
  growth: 'Growth',
  team: 'Team',
  delivery: 'Delivery',
};

export function clientTab(value: string | undefined): ClientTab {
  return (CLIENT_TABS as readonly string[]).includes(value ?? '') ? (value as ClientTab) : 'relationship';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A case file opens by id. A slug, from an old Growth link, opens the same file. */
export function isCaseFileId(ref: string): boolean {
  return UUID.test(ref);
}

async function adminClient(): Promise<UntypedClient | null> {
  const session = await getSessionContext();
  if (!session?.isAdmin) return null;
  return (await createClient()) as unknown as UntypedClient;
}

export type ClientRow = Pick<CaseFile, 'id' | 'slug' | 'name' | 'vertical' | 'status' | 'contact_name' | 'contact_email' | 'engagement_start'> & {
  live: number;
};

export async function listClientFiles(): Promise<ClientRow[]> {
  const db = await adminClient();
  if (!db) return [];
  const [files, placements] = await Promise.all([
    db
      .from('client_case_file')
      .select('id, slug, name, vertical, status, contact_name, contact_email, engagement_start')
      .eq('record_kind', 'client')
      .order('name'),
    db.from('placement').select('case_file_id, status').in('status', ['active', 'scheduled', 'paused']),
  ]);
  const live = new Map<string, number>();
  for (const row of (placements.data ?? []) as { case_file_id: string }[]) live.set(row.case_file_id, (live.get(row.case_file_id) ?? 0) + 1);
  return ((files.data ?? []) as Omit<ClientRow, 'live'>[]).map((row) => ({ ...row, live: live.get(row.id) ?? 0 }));
}

export type ClientFile = CaseFile & {
  industry_key: string | null;
  qualified_booking_definition: string | null;
  contact_role: string | null;
  contact_channel: string | null;
  phone: string | null;
  billing_email: string | null;
  offer: string | null;
  monthly_ad_spend: number | string | null;
  crm_stack: string | null;
  time_zone: string | null;
};

export async function getClientFile(ref: string): Promise<ClientFile | null> {
  const db = await adminClient();
  if (!db) return null;
  const { data } = await db
    .from('client_case_file')
    .select('*')
    .eq(isCaseFileId(ref) ? 'id' : 'slug', ref)
    .eq('record_kind', 'client')
    .maybeSingle();
  return (data as ClientFile | null) ?? null;
}

export type ClientAccess = {
  accounts: { profile_id: string; full_name: string | null; job_title: string | null; state: string; is_primary: boolean }[];
  ghl: { location_id: string; location_name: string | null; location_time_zone: string | null; is_test: boolean } | null;
};

export async function loadClientAccess(caseFileId: string): Promise<ClientAccess> {
  const db = await adminClient();
  if (!db) return { accounts: [], ghl: null };
  const [accounts, ghl] = await Promise.all([
    db.from('client_account').select('profile_id, full_name, job_title, state, is_primary').eq('case_file_id', caseFileId),
    db.from('ghl_location').select('location_id, location_name, location_time_zone, is_test').eq('case_file_id', caseFileId).maybeSingle(),
  ]);
  return {
    accounts: (accounts.data ?? []) as ClientAccess['accounts'],
    ghl: (ghl.data as ClientAccess['ghl']) ?? null,
  };
}

export type ClientDelivery = {
  reports: { id: string; placement_id: string; kind: string; period_start: string; period_end: string; status: string; sent_at: string | null; operator: string | null }[];
  eods: { id: string; work_date: string; status: string; was_late: boolean; operator: string | null }[];
};

/** Reports sent and EODs filed, across every placement on this client. */
export async function loadClientDelivery(caseFileId: string): Promise<ClientDelivery> {
  const db = await adminClient();
  if (!db) return { reports: [], eods: [] };
  const { data: placements } = await db.from('placement').select('id, operator!placement_operator_id_fkey(name)').eq('case_file_id', caseFileId);
  const rows = (placements ?? []) as { id: string; operator: { name: string } | { name: string }[] | null }[];
  const names = new Map(rows.map((row) => [row.id, (Array.isArray(row.operator) ? row.operator[0]?.name : row.operator?.name) ?? null]));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { reports: [], eods: [] };
  const [reports, eods] = await Promise.all([
    db
      .from('sales_report')
      .select('id, placement_id, kind, period_start, period_end, status, sent_at')
      .in('placement_id', ids)
      .eq('test', false)
      .order('period_end', { ascending: false })
      .limit(50),
    db
      .from('sales_eod')
      .select('id, placement_id, work_date, status, was_late')
      .in('placement_id', ids)
      .in('status', ['submitted', 'late', 'missed'])
      .order('work_date', { ascending: false })
      .limit(30),
  ]);
  return {
    reports: ((reports.data ?? []) as Omit<ClientDelivery['reports'][number], 'operator'>[]).map((row) => ({ ...row, operator: names.get(row.placement_id) ?? null })),
    eods: ((eods.data ?? []) as (Omit<ClientDelivery['eods'][number], 'operator'> & { placement_id: string })[]).map((row) => ({
      id: row.id,
      work_date: row.work_date,
      status: row.status,
      was_late: row.was_late,
      operator: names.get(row.placement_id) ?? null,
    })),
  };
}

/** A prospect from the pipeline, with the case file it became, if any. */
export async function getProspectForAccount(leadId: string) {
  const db = await adminClient();
  if (!db || !UUID.test(leadId)) return null;
  const { data } = await db
    .from('da_leads')
    .select('id, full_name, email, phone, company_name, coaching_niche, offer_line, market, stage, monthly_ad_spend, payload')
    .eq('id', leadId)
    .maybeSingle();
  return (data as {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    coaching_niche: string | null;
    offer_line: string | null;
    market: string | null;
    stage: string;
    monthly_ad_spend: number | string | null;
    payload: Record<string, unknown> | null;
  } | null) ?? null;
}
