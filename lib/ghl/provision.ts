import { randomBytes } from 'node:crypto';
import { connect, type GhlSession, type ServiceClient } from './client';
import { allOff, readUser, readUsers, splitName, withLocation, withoutLocations, type GhlUser } from './rules';

/**
 * The jobs the database queues (ghl_job) and this runs. Each one is written to
 * be safe to run twice: it reads GHL's current state first and moves it to the
 * wanted state, so a retry after a timeout cannot create a second user or add
 * a location twice.
 *
 * The only writes this file makes into GHL are users (create, update
 * permissions and locations, deactivate) and a contact's owner. Nothing is
 * ever deleted: deactivating a user removes every DA location and turns every
 * permission off.
 */

type Change = { action: string; outcome: 'ok' | 'failed' | 'verify_manually'; detail: string; ghl_user_id?: string; location_id?: string };

export type JobOutcome = { ok: boolean; result: Record<string, unknown>; error?: string; retryable?: boolean };

export type ClaimedJob = {
  job_id: number;
  kind: 'grant' | 'revoke' | 'fix_permissions' | 'remove_extra' | 'assign_owner';
  case_file_id: string | null;
  attempt: number;
  context: Record<string, unknown>;
};

type GrantContext = {
  grant_id: string;
  location_id: string;
  email: string;
  name: string;
  ghl_user_id: string | null;
  created_by_app: boolean;
  known_kind: string | null;
  ghl_role: string;
  ghl_type: string;
  permissions: Record<string, boolean>;
  verify_manually: string[];
  keep_location_ids: string[];
  da_location_ids: string[];
};

async function userSession(db: ServiceClient): Promise<GhlSession | string> {
  const agency = await connect(db, { purpose: 'agency' });
  if (agency.ok) return agency.session;
  return `No working agency connection (${agency.reason}). User changes need the agency token.`;
}

async function getUser(session: GhlSession, id: string, purpose: string): Promise<GhlUser | null | 'error'> {
  const response = await session.request('GET', `/users/${id}`, { purpose });
  if (response.outcome === 'not_found') return null;
  if (!response.ok) return 'error';
  return readUser(response.data);
}

async function findByEmail(session: GhlSession, email: string, purpose: string): Promise<GhlUser | null | 'error'> {
  const companyId = session.info.companyId;
  if (!companyId) return 'error';
  const response = await session.request('GET', '/users/search', { query: { companyId, query: email, limit: 25 }, purpose });
  if (!response.ok) return 'error';
  return readUsers(response.data).find((u) => u.email === email.toLowerCase()) ?? null;
}

export async function runJob(db: ServiceClient, job: ClaimedJob): Promise<JobOutcome> {
  switch (job.kind) {
    case 'grant':
    case 'fix_permissions':
      return grant(db, job);
    case 'revoke':
      return revoke(db, job);
    case 'remove_extra':
      return removeExtra(db, job);
    case 'assign_owner':
      return assignOwner(db, job);
  }
}

async function grant(db: ServiceClient, job: ClaimedJob): Promise<JobOutcome> {
  const c = job.context as unknown as GrantContext;
  const changes: Change[] = [];
  if (c.known_kind) {
    return { ok: false, retryable: false, error: 'This GHL user is marked as staff and is never changed by DA.', result: {} };
  }
  const session = await userSession(db);
  if (typeof session === 'string') return { ok: false, retryable: true, error: session, result: {} };
  const purpose = job.kind === 'grant' ? 'grant access' : 'fix permissions';
  const verify = [...(c.verify_manually ?? [])];

  let user: GhlUser | null | 'error' = null;
  if (c.ghl_user_id) user = await getUser(session, c.ghl_user_id, purpose);
  if (user === null) user = await findByEmail(session, c.email, purpose);
  if (user === 'error') return { ok: false, retryable: true, error: 'Could not read the user from GHL.', result: {} };

  if (user && user.type === 'agency') {
    // An agency-level user already reaches sub-accounts through the agency. DA
    // will not change an agency user's role or permissions.
    verify.push('This person is an agency-level GHL user: their access is set at the agency, not by DA');
    changes.push({ action: 'link_existing', outcome: 'verify_manually', detail: 'Agency user linked; not changed', ghl_user_id: user.id });
    return { ok: true, result: { ghl_user_id: user.id, created: false, email: c.email, name: c.name, changes, verify_manually: verify } };
  }

  if (user) {
    const locationIds = withLocation(user.locationIds, c.location_id);
    const response = await session.request('PUT', `/users/${user.id}`, {
      body: { locationIds, permissions: c.permissions, role: c.ghl_role, type: c.ghl_type },
      purpose,
    });
    if (!response.ok) {
      changes.push({ action: 'add_location', outcome: 'failed', detail: response.error ?? response.outcome, ghl_user_id: user.id });
      return { ok: false, retryable: response.outcome !== 'auth_failed' && response.outcome !== 'scope_missing', error: response.error ?? response.outcome, result: { changes } };
    }
    changes.push({
      action: user.locationIds.includes(c.location_id) ? 'update_permissions' : 'add_location',
      outcome: 'ok',
      detail: `Location ${c.location_id} and the ${c.ghl_role} permission profile applied`,
      ghl_user_id: user.id,
    });
    if (!c.ghl_user_id) changes.push({ action: 'link_existing', outcome: 'ok', detail: 'Existing GHL user linked by email', ghl_user_id: user.id });
    return { ok: true, result: { ghl_user_id: user.id, created: false, email: c.email, name: c.name, changes, verify_manually: verify } };
  }

  // Create. The Users API requires a password; this one is random, used once,
  // never stored, logged or shown. The VA sets their own through GHL's
  // "Forgot password" flow.
  const { firstName, lastName } = splitName(c.name);
  const created = await session.request<Record<string, unknown>>('POST', '/users/', {
    body: {
      companyId: session.info.companyId,
      firstName,
      lastName,
      email: c.email,
      password: `${randomBytes(18).toString('base64url')}!9a`,
      type: c.ghl_type,
      role: c.ghl_role,
      locationIds: [c.location_id],
      permissions: c.permissions,
    },
    purpose: 'create user',
    retrySafe: false,
    idempotencyKey: `grant:${c.grant_id}`,
  });
  if (!created.ok) {
    // The create may have landed before the response was lost. Look before the
    // job is retried, so a retry links the user instead of making a second.
    const again = await findByEmail(session, c.email, 'create user (verify)');
    if (again && again !== 'error') {
      changes.push({ action: 'create', outcome: 'ok', detail: 'Created (confirmed after an unclear response)', ghl_user_id: again.id });
      return { ok: true, result: { ghl_user_id: again.id, created: true, email: c.email, name: c.name, changes, verify_manually: verify } };
    }
    changes.push({ action: 'create', outcome: 'failed', detail: created.error ?? created.outcome });
    return { ok: false, retryable: created.outcome !== 'auth_failed' && created.outcome !== 'scope_missing' && created.outcome !== 'client_error', error: created.error ?? created.outcome, result: { changes } };
  }
  const id = readUser(created.data)?.id ?? (typeof created.data?.id === 'string' ? created.data.id : null);
  if (!id) return { ok: false, retryable: true, error: 'GHL did not return the new user id', result: { changes } };
  changes.push({ action: 'create', outcome: 'ok', detail: `Created with location ${c.location_id}`, ghl_user_id: id });
  return { ok: true, result: { ghl_user_id: id, created: true, email: c.email, name: c.name, changes, verify_manually: verify } };
}

/**
 * Remove one location. When the user is left with no DA location and DA created
 * them, deactivate: every DA location gone and every permission off. A user DA
 * did not create only ever loses the location DA granted.
 */
async function removeLocation(
  session: GhlSession,
  user: GhlUser,
  locationId: string,
  keep: string[],
  daLocations: string[],
  createdByApp: boolean,
  permissions: Record<string, unknown>,
  purpose: string,
): Promise<{ ok: boolean; deactivated: boolean; changes: Change[]; error?: string; retryable?: boolean }> {
  const changes: Change[] = [];
  const keepsOther = keep.length > 0;
  const deactivate = createdByApp && !keepsOther;
  const locationIds = deactivate ? withoutLocations(user.locationIds, daLocations) : withoutLocations(user.locationIds, [locationId]);
  const body: Record<string, unknown> = { locationIds };
  if (deactivate) body.permissions = allOff(Object.keys(permissions).length ? permissions : user.permissions ?? {});

  const response = await session.request('PUT', `/users/${user.id}`, { body, purpose });
  if (!response.ok) {
    changes.push({ action: deactivate ? 'deactivate' : 'remove_location', outcome: 'failed', detail: response.error ?? response.outcome, ghl_user_id: user.id, location_id: locationId });
    return { ok: false, deactivated: false, changes, error: response.error ?? response.outcome, retryable: response.outcome !== 'auth_failed' && response.outcome !== 'scope_missing' };
  }
  changes.push({ action: 'remove_location', outcome: 'ok', detail: `Location ${locationId} removed`, ghl_user_id: user.id, location_id: locationId });
  if (deactivate) {
    changes.push({
      action: 'deactivate',
      outcome: 'verify_manually',
      detail: 'Every DA location removed and every permission turned off. GHL has no deactivate endpoint, so the login itself still exists: suspend it in the agency view if needed.',
      ghl_user_id: user.id,
    });
  }
  return { ok: true, deactivated: deactivate, changes };
}

async function revoke(db: ServiceClient, job: ClaimedJob): Promise<JobOutcome> {
  const c = job.context as unknown as GrantContext;
  if (!c.ghl_user_id) {
    // Never provisioned, so there is nothing in GHL to take away.
    return { ok: true, result: { changes: [] } };
  }
  if (c.known_kind) return { ok: true, result: { changes: [{ action: 'remove_location', outcome: 'verify_manually', detail: 'Marked as staff: left alone' }] } };
  const session = await userSession(db);
  if (typeof session === 'string') return { ok: false, retryable: true, error: session, result: {} };
  const user = await getUser(session, c.ghl_user_id, 'remove access');
  if (user === 'error') return { ok: false, retryable: true, error: 'Could not read the user from GHL.', result: {} };
  if (user === null) return { ok: true, result: { ghl_user_id: c.ghl_user_id, changes: [{ action: 'remove_location', outcome: 'ok', detail: 'User no longer exists in GHL' }] } };
  if (user.type === 'agency') {
    return { ok: true, result: { ghl_user_id: user.id, changes: [{ action: 'remove_location', outcome: 'verify_manually', detail: 'Agency-level user: remove their access at the agency' }] } };
  }
  const removed = await removeLocation(session, user, c.location_id, c.keep_location_ids ?? [], c.da_location_ids ?? [], c.created_by_app, c.permissions ?? {}, 'remove access');
  return removed.ok
    ? { ok: true, result: { ghl_user_id: user.id, deactivated: removed.deactivated, changes: removed.changes } }
    : { ok: false, retryable: removed.retryable, error: removed.error, result: { ghl_user_id: user.id, changes: removed.changes } };
}

async function removeExtra(db: ServiceClient, job: ClaimedJob): Promise<JobOutcome> {
  const c = job.context as { ghl_user_id: string; location_id: string; created_by_app: boolean; known_kind: string | null; confirmed_by: string | null; keep_location_ids: string[]; da_location_ids: string[] };
  if (c.known_kind) return { ok: false, retryable: false, error: 'Marked as staff: never removed.', result: {} };
  if (!c.created_by_app && !c.confirmed_by) {
    return { ok: false, retryable: false, error: 'DA did not create this user, so an admin must confirm the removal.', result: {} };
  }
  const session = await userSession(db);
  if (typeof session === 'string') return { ok: false, retryable: true, error: session, result: {} };
  const user = await getUser(session, c.ghl_user_id, 'remove extra access');
  if (user === 'error') return { ok: false, retryable: true, error: 'Could not read the user from GHL.', result: {} };
  if (user === null) return { ok: true, result: { ghl_user_id: c.ghl_user_id, changes: [] } };
  if (user.type === 'agency') {
    return { ok: false, retryable: false, error: 'Agency-level user: remove their access in the agency view.', result: {} };
  }
  const removed = await removeLocation(session, user, c.location_id, c.keep_location_ids ?? [], c.da_location_ids ?? [], c.created_by_app, user.permissions ?? {}, 'remove extra access');
  return removed.ok
    ? { ok: true, result: { ghl_user_id: user.id, deactivated: removed.deactivated, changes: removed.changes } }
    : { ok: false, retryable: removed.retryable, error: removed.error, result: { changes: removed.changes } };
}

async function assignOwner(db: ServiceClient, job: ClaimedJob): Promise<JobOutcome> {
  const c = job.context as { contact_id: string | null; ghl_user_id: string | null; case_file_id: string };
  if (!c.contact_id || !c.ghl_user_id) {
    return { ok: false, retryable: false, error: 'The VA has no GHL user yet, so the owner cannot be set.', result: {} };
  }
  const location = await connect(db, { caseFileId: c.case_file_id, purpose: 'location' });
  if (!location.ok) return { ok: false, retryable: true, error: `No working connection (${location.reason})`, result: {} };
  // The one contact field this prompt writes: who owns the lead.
  const response = await location.session.request('PUT', `/contacts/${c.contact_id}`, {
    body: { assignedTo: c.ghl_user_id },
    purpose: 'routing: set contact owner',
  });
  if (!response.ok) {
    return { ok: false, retryable: response.outcome !== 'auth_failed' && response.outcome !== 'scope_missing' && response.outcome !== 'not_found', error: response.error ?? response.outcome, result: {} };
  }
  return { ok: true, result: { ghl_user_id: c.ghl_user_id } };
}
