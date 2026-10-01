import { connect, serviceClient, type ServiceClient } from './client';
import { checkSession, readLocationShape, readLocationUsers } from './health';
import { runJob, type ClaimedJob } from './provision';
import { readMessages, type PolledEvent } from './rules';

/**
 * One pass of GHL work, run by Vercel Cron every minute and straight after any
 * admin action that queued something (a revoke must not wait for the clock):
 *
 *   1. jobs     grants, removals (first: priority 1), permission fixes, owners
 *   2. checks   health on schedule or on demand, then mapping and users
 *   3. polling  new conversation messages for every healthy sub-account
 *
 * Each step stops when the time budget runs out; whatever is left is picked up
 * by the next run. Nothing loops tightly: a failure is recorded with its own
 * back-off in the database and the pass moves on.
 */

export type WorkerSummary = { jobs: number; checks: number; polled: number; errors: string[] };

type DueCheck = {
  connection_id: string;
  level: 'agency' | 'location';
  case_file_id: string | null;
  is_candidate: boolean;
  mapping_due: boolean;
  users_due: boolean;
};

export async function runWorker(options: { budgetMs?: number; jobsOnly?: boolean; db?: ServiceClient } = {}): Promise<WorkerSummary> {
  const db = options.db ?? serviceClient();
  const summary: WorkerSummary = { jobs: 0, checks: 0, polled: 0, errors: [] };
  if (!db) {
    summary.errors.push('SUPABASE_SERVICE_ROLE_KEY is not set');
    return summary;
  }
  const deadline = Date.now() + (options.budgetMs ?? 50_000);
  const timeLeft = () => deadline - Date.now();

  // 1. Jobs.
  while (timeLeft() > 5_000) {
    const { data, error } = await db.rpc('ghl_claim_jobs', { p_limit: 10 });
    if (error) {
      summary.errors.push(`claim: ${error.message}`);
      break;
    }
    const jobs = (data ?? []) as ClaimedJob[];
    if (!jobs.length) break;
    for (const job of jobs) {
      let outcome;
      try {
        outcome = await runJob(db, job);
      } catch (error) {
        outcome = { ok: false, retryable: true, error: error instanceof Error ? error.message : String(error), result: {} };
      }
      await db.rpc('ghl_complete_job', {
        p_job_id: job.job_id,
        p_ok: outcome.ok,
        p_result: outcome.result ?? {},
        p_error: outcome.error ?? null,
        p_retryable: outcome.retryable ?? true,
      });
      summary.jobs += 1;
    }
  }
  if (options.jobsOnly) return summary;

  // 2. Health, mapping, users.
  const { data: due, error: dueError } = await db.rpc('ghl_due_checks', { p_limit: 20 });
  if (dueError) summary.errors.push(`due: ${dueError.message}`);
  for (const check of ((due ?? []) as DueCheck[])) {
    if (timeLeft() < 10_000) break;
    try {
      await runCheck(db, check);
      summary.checks += 1;
    } catch (error) {
      summary.errors.push(`check ${check.connection_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 3. Conversation polling.
  const { data: locations } = await db
    .from('ghl_location')
    .select('case_file_id, poll_cursor, polled_at')
    .order('polled_at', { ascending: true, nullsFirst: true });
  for (const location of locations ?? []) {
    if (timeLeft() < 8_000) break;
    try {
      const count = await pollLocation(db, location.case_file_id, location.poll_cursor, deadline);
      if (count >= 0) summary.polled += 1;
    } catch (error) {
      summary.errors.push(`poll ${location.case_file_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return summary;
}

export async function runCheck(db: ServiceClient, check: DueCheck) {
  const picked = await connect(db, { purpose: 'check', connectionId: check.connection_id, caseFileId: check.case_file_id });
  if (!picked.ok) {
    await db.rpc('ghl_record_health', { p_connection_id: check.connection_id, p_ok: false, p_error: picked.reason });
    return;
  }
  const health = await checkSession(picked.session);
  const { data: recorded } = await db.rpc('ghl_record_health', {
    p_connection_id: check.connection_id,
    p_ok: health.ok,
    p_scopes_present: health.present,
    p_scopes_missing: health.missing,
    p_error: health.error,
    p_company_id: health.companyId,
    p_location_name: health.locationName,
    p_location_time_zone: health.locationTimeZone,
    p_auth_failed: health.authFailed,
  });
  if (!health.ok || check.level !== 'location' || !check.case_file_id) return recorded;

  // A rotation candidate that just passed is now the live connection, so the
  // rest of the check uses the live one.
  const live = await connect(db, { caseFileId: check.case_file_id, purpose: 'location' });
  if (!live.ok) return recorded;

  if (check.mapping_due || check.is_candidate) {
    const shape = await readLocationShape(live.session);
    if (shape.ok) await db.rpc('ghl_record_mapping', { p_case_file_id: check.case_file_id, p_found: shape.shape });
  }
  if (check.users_due) {
    const users = await readLocationUsers(live.session);
    if (users.ok) await db.rpc('ghl_record_location_users', { p_case_file_id: check.case_file_id, p_users: users.users });
  }
  return recorded;
}

/**
 * New messages since the cursor, as InboundMessage and OutboundMessage events.
 * The first poll of a location looks back 15 minutes only: history before the
 * connection is not replayed into response times.
 */
async function pollLocation(db: ServiceClient, caseFileId: string, cursor: string | null, deadline: number): Promise<number> {
  const picked = await connect(db, { caseFileId, purpose: 'location' });
  if (!picked.ok) return -1;
  const session = picked.session;
  const since = cursor ? new Date(cursor).getTime() : Date.now() - 15 * 60_000;
  // Two minutes of overlap catch a message GHL timestamps a little before one
  // already read; the message id dedupes it if it was seen.
  const from = since - 2 * 60_000;

  const search = await session.request<{ conversations?: Record<string, unknown>[] }>('GET', '/conversations/search', {
    query: { locationId: session.info.locationId!, limit: 50, sortBy: 'last_message_date', sort: 'desc' },
    purpose: 'activity poll',
  });
  if (!search.ok) return -1;

  const events: PolledEvent[] = [];
  let newest = since;
  for (const conversation of search.data?.conversations ?? []) {
    if (Date.now() > deadline - 5_000) break;
    const last = Number(conversation.lastMessageDate ?? 0) || Date.parse(String(conversation.lastMessageDate ?? '')) || 0;
    if (last && last <= from) continue;
    const id = String(conversation.id ?? '');
    if (!id) continue;
    const messages = await session.request('GET', `/conversations/${id}/messages`, { query: { limit: 30 }, purpose: 'activity poll' });
    if (!messages.ok) continue;
    for (const event of readMessages(messages.data, id, (conversation.contactId as string) ?? null)) {
      const at = Date.parse(event.dateAdded);
      if (Number.isNaN(at) || at <= from) continue;
      events.push(event);
      newest = Math.max(newest, at);
    }
  }

  // Oldest first, so a lead exists before the reply to it.
  events.sort((a, b) => Date.parse(a.dateAdded) - Date.parse(b.dateAdded));
  const { error } = await db.rpc('ghl_ingest_polled', {
    p_case_file_id: caseFileId,
    p_events: events,
    p_cursor: new Date(newest).toISOString(),
  });
  if (error) throw new Error(error.message);
  return events.length;
}
