import 'server-only';

import { controlRpc, readable } from '@/lib/ad/rpc';
import { SALES_OPERATOR_ROLE_SLUGS } from '@/lib/careers/roles';
import { hireQueue, type HireStage, type ReadinessItem } from '@/lib/hire/rules';
import { createClient, getSessionContext } from '@/lib/supabase/server';
import { serviceRoleClient, type UntypedClient } from '@/lib/workspace/db';

const untyped = async () => (await createClient()) as unknown as UntypedClient;

/**
 * Reads for the Operators desk: the applicant inbox, the onboarding and ready
 * queues, and one operator's case file. The records are the existing ones:
 * role_application, operator_journey, operator_onboarding, account_invite,
 * da_agreement. operator_journey is closed to the browser role, so it is read
 * here with the service key after the staff check.
 */

export type Applicant = {
  id: string;
  role_slug: string;
  role_title: string;
  full_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  loom_url: string | null;
  experience: string | null;
  why_you: string | null;
  availability: string | null;
  status: 'new' | 'reviewing' | 'rejected' | 'advanced' | 'withdrawn';
  review_note: string | null;
  reviewed_at: string | null;
  received_at: string;
  converted_operator_id: string | null;
};

export type JourneyRow = {
  operator_id: string;
  stage: HireStage;
  stage_reason: string | null;
  role_kind: 'va' | 'sales_operator';
  work_email: string;
  first_name: string;
  last_name: string;
  manager_profile_id: string | null;
  manager_name: string | null;
  application_id: string | null;
  note: string | null;
  invited_at: string;
  signed_in_at: string | null;
  onboarding_completed_at: string | null;
  ready_at: string | null;
  updated_at: string;
  /** From hire_roster. */
  met: number;
  waived: number;
  ready: boolean;
};

const APPLICANT_COLUMNS =
  'id, role_slug, role_title, full_name, email, phone, linkedin_url, portfolio_url, loom_url, experience, why_you, availability, status, review_note, reviewed_at, received_at, converted_operator_id';

const JOURNEY_COLUMNS =
  'operator_id, stage, stage_reason, role_kind, work_email, first_name, last_name, manager_profile_id, application_id, note, invited_at, signed_in_at, onboarding_completed_at, ready_at, updated_at';

async function staff() {
  const session = await getSessionContext();
  if (!session) return null;
  if (session.isAdmin) return { session, admin: true as const };
  if (session.role === 'manager') return { session, admin: false as const };
  return null;
}

type Loaded<T> = { data: T; error: null } | { data: null; error: string };

/** Sales-operator applications, new and in review, oldest decision first. */
export async function listApplicants(): Promise<Loaded<Applicant[]>> {
  const who = await staff();
  if (!who?.admin) return { data: null, error: 'Applicants are for DA Admin.' };
  const supabase = await untyped();
  const { data, error } = await supabase
    .from('role_application')
    .select(APPLICANT_COLUMNS)
    .in('role_slug', [...SALES_OPERATOR_ROLE_SLUGS])
    .in('status', ['new', 'reviewing'])
    .order('received_at', { ascending: true });
  if (error) return { data: null, error: readable(error) };
  return { data: (data ?? []) as unknown as Applicant[], error: null };
}

export async function countApplicants(): Promise<number> {
  const supabase = await untyped();
  const { count } = await supabase
    .from('role_application')
    .select('id', { count: 'exact', head: true })
    .in('role_slug', [...SALES_OPERATOR_ROLE_SLUGS])
    .in('status', ['new', 'reviewing']);
  return count ?? 0;
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  const who = await staff();
  if (!who?.admin) return null;
  const supabase = await untyped();
  const { data } = await supabase.from('role_application').select(APPLICANT_COLUMNS).eq('id', id).maybeSingle();
  return (data as unknown as Applicant | null) ?? null;
}

async function managerNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const db = serviceRoleClient();
  if (!db || ids.length === 0) return names;
  const { data } = await db.from('profile').select('id, full_name, email').in('id', ids);
  for (const row of (data ?? []) as { id: string; full_name: string | null; email: string }[]) {
    names.set(row.id, row.full_name?.trim() || row.email);
  }
  return names;
}

/** Every sales-operator journey, with readiness counts. */
export async function listJourneys(): Promise<Loaded<JourneyRow[]>> {
  const who = await staff();
  if (!who) return { data: null, error: 'Sign in as staff.' };
  const db = serviceRoleClient();
  if (!db) return { data: null, error: 'The service key is not configured, so the hire records cannot be read.' };
  const supabase = await createClient();
  const [journeys, roster] = await Promise.all([
    db.from('operator_journey').select(JOURNEY_COLUMNS).eq('role_kind', 'sales_operator').order('invited_at', { ascending: false }),
    controlRpc<{ operator_id: string; met: number; waived: number; ready: boolean }[]>(supabase, 'hire_roster', {}),
  ]);
  if (journeys.error) return { data: null, error: journeys.error.message };
  const counts = new Map((roster.data ?? []).map((row) => [row.operator_id, row]));
  const rows = (journeys.data ?? []) as Omit<JourneyRow, 'manager_name' | 'met' | 'waived' | 'ready'>[];
  const names = await managerNames([...new Set(rows.map((row) => row.manager_profile_id).filter((id): id is string => Boolean(id)))]);
  return {
    data: rows.map((row) => ({
      ...row,
      manager_name: row.manager_profile_id ? names.get(row.manager_profile_id) ?? null : null,
      met: Number(counts.get(row.operator_id)?.met ?? 0),
      waived: Number(counts.get(row.operator_id)?.waived ?? 0),
      ready: Boolean(counts.get(row.operator_id)?.ready),
    })),
    error: null,
  };
}

export async function listQueue(queue: 'onboarding' | 'ready'): Promise<Loaded<JourneyRow[]>> {
  const all = await listJourneys();
  if (!all.data) return all;
  return { data: all.data.filter((row) => hireQueue(row.stage) === queue), error: null };
}

export type HireView = {
  journey: {
    stage: HireStage;
    reason: string | null;
    role_kind: string;
    manager_id: string | null;
    signed_in_at: string | null;
    onboarding_completed_at: string | null;
    last_day: string | null;
    offboard_reason: string | null;
    reminder_count: number;
  } | null;
  answers: Record<string, unknown> | null;
  submitted: string | null;
  payout_complete: boolean;
  readiness: Pick<ReadinessItem, 'key' | 'state' | 'detail'>[];
  ready: boolean;
  override: { id: string; reason: string; starts_on: string; expires_on: string; days_left: number; modules_done: number; modules_total: number } | null;
  offboard: { key: string; label: string; done: boolean }[];
  ghl: { id: string; placement_id: string | null; client_id: string | null; user: boolean | null; mapped: boolean | null; phone: string | null; operator_confirmed: boolean }[];
  setup_flags: string[];
  setup_cleared: boolean;
};

export type OperatorFile = {
  admin: boolean;
  operatorId: string;
  name: string;
  email: string | null;
  phone: string | null;
  journey: JourneyRow | null;
  view: HireView | null;
  application: Applicant | null;
  invite: { id: string; expires_at: string | null; accepted_at: string | null; last_sent_at: string | null; cancelled_at: string | null } | null;
  agreements: { id: string; status: string; sent_at: string; completed_at: string | null; signed_document_url: string | null; template: string | null }[];
  managers: { id: string; name: string }[];
  /** The newest placement that is not ended, for GHL readiness and the next action. */
  openPlacement: { id: string; case_file_id: string; status: string } | null;
  error: string | null;
};

/** Everything the operator case file shows above the live-seat sections. */
export async function loadOperatorFile(operatorId: string): Promise<OperatorFile | null> {
  const who = await staff();
  if (!who) return null;
  const supabase = await createClient();
  const db = serviceRoleClient();

  const [operatorRow, view, journeyRow, options] = await Promise.all([
    (db ?? (supabase as unknown as UntypedClient)).from('operator').select('id, name, email, phone').eq('id', operatorId).maybeSingle(),
    controlRpc<HireView>(supabase, 'hire_operator_view', { p_operator: operatorId }),
    db ? db.from('operator_journey').select(JOURNEY_COLUMNS).eq('operator_id', operatorId).maybeSingle() : Promise.resolve({ data: null }),
    who.admin ? controlRpc<{ managers: { id: string; name: string }[] }>(supabase, 'hire_options', {}) : Promise.resolve({ data: null }),
  ]);
  const operator = operatorRow.data as { id: string; name: string; email: string | null; phone: string | null } | null;
  if (!operator) return null;

  const rawJourney = journeyRow.data as Omit<JourneyRow, 'manager_name' | 'met' | 'waived' | 'ready'> | null;
  const names = await managerNames(rawJourney?.manager_profile_id ? [rawJourney.manager_profile_id] : []);
  const readiness = view.data?.readiness ?? [];
  const journey: JourneyRow | null = rawJourney
    ? {
        ...rawJourney,
        manager_name: rawJourney.manager_profile_id ? names.get(rawJourney.manager_profile_id) ?? null : null,
        met: readiness.filter((item) => item.state === 'met').length,
        waived: readiness.filter((item) => item.state === 'waived').length,
        ready: Boolean(view.data?.ready),
      }
    : null;

  const reader = db ?? (supabase as unknown as UntypedClient);
  const [application, invite, recipients, open] = await Promise.all([
    journey?.application_id && who.admin
      ? reader.from('role_application').select(APPLICANT_COLUMNS).eq('id', journey.application_id).maybeSingle()
      : Promise.resolve({ data: null }),
    journey?.work_email
      ? reader
          .from('account_invite')
          .select('id, expires_at, accepted_at, last_sent_at, cancelled_at')
          .ilike('email', journey.work_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    reader.from('da_recipient').select('id').eq('operator_id', operatorId),
    reader
      .from('placement')
      .select('id, case_file_id, status')
      .eq('operator_id', operatorId)
      .neq('status', 'ended')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const recipientIds = ((recipients.data ?? []) as { id: string }[]).map((row) => row.id);
  const agreements = recipientIds.length
    ? await reader
        .from('da_agreement')
        .select('id, status, sent_at, completed_at, signed_document_url, superseded_by_id, da_agreement_template(name)')
        .in('recipient_id', recipientIds)
        .order('sent_at', { ascending: false })
    : { data: [] };

  return {
    admin: who.admin,
    operatorId,
    name: operator.name,
    email: operator.email,
    phone: operator.phone,
    journey,
    view: view.data,
    application: (application.data as unknown as Applicant | null) ?? null,
    invite: (invite.data as OperatorFile['invite']) ?? null,
    agreements: ((agreements.data ?? []) as Record<string, unknown>[])
      .filter((row) => !row.superseded_by_id)
      .map((row) => ({
        id: String(row.id),
        status: String(row.status),
        sent_at: String(row.sent_at),
        completed_at: (row.completed_at as string | null) ?? null,
        signed_document_url: (row.signed_document_url as string | null) ?? null,
        template: ((row.da_agreement_template as { name?: string } | null)?.name ?? null) as string | null,
      })),
    openPlacement: (open.data as OperatorFile['openPlacement']) ?? null,
    managers: (options.data as { managers?: { id: string; name: string }[] } | null)?.managers ?? [],
    error: view.error ? readable(view.error) : null,
  };
}
