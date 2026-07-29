'use server';

import { revalidatePath } from 'next/cache';
import { controlRpc, readable, type ActionResult } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { IngestAuthMode, IngestProvider } from './types';

/**
 * Writes on the ingestion surface.
 *
 * Every one goes through a database function, so the rules stay in one place: the
 * UI cannot attribute an event, replay one, or open a door except by the route
 * that checks permission, audits the action and dispatches properly.
 */

const INGESTION = '/da/ingestion';

function asProvider(value: FormDataEntryValue | null): IngestProvider | null {
  return value === 'gohighlevel' || value === 'payments' ? value : null;
}

/**
 * Opening a door. The secret comes back exactly once, in the result, because
 * afterwards there is only a digest — the same contract invite_account() has.
 */
export async function registerEndpointAction(formData: FormData): Promise<ActionResult> {
  const provider = asProvider(formData.get('provider'));
  if (!provider) return { ok: false, error: 'Choose which provider this door is for.' };

  const authMode = formData.get('auth_mode') === 'hmac_sha256' ? 'hmac_sha256' : 'shared_secret';
  const caseFileId = String(formData.get('case_file_id') ?? '').trim();

  const supabase = await createClient();
  const { data, error } = await controlRpc<{ key: string; secret: string; auth_mode: IngestAuthMode }>(
    supabase,
    'register_ingest_endpoint',
    {
      p_provider: provider,
      p_label: String(formData.get('label') ?? ''),
      p_case_file_id: caseFileId || null,
      p_auth_mode: authMode,
    },
  );

  if (error || !data) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);

  const url = `/api/webhooks/${provider === 'gohighlevel' ? 'ghl' : 'payments'}/${data.key}`;
  return {
    ok: true,
    message:
      authMode === 'shared_secret'
        ? `Door open at ${url} — send the secret as x-vistrial-secret: ${data.secret}. This is the only time it is shown.`
        : `Door open at ${url} — sign the body with ${data.secret}. This is the only time it is shown.`,
  };
}

export async function rotateSecretAction(endpointId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ secret: string }>(supabase, 'rotate_ingest_secret', {
    p_endpoint_id: endpointId,
  });

  if (error || !data) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  return {
    ok: true,
    message: `New secret: ${data.secret}. Deliveries signed with the old one are refused from now on, so update the provider before it retries.`,
  };
}

export async function setEndpointActiveAction(
  endpointId: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'set_ingest_endpoint_active', {
    p_endpoint_id: endpointId,
    p_active: active,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  return {
    ok: true,
    message: active
      ? 'Door open. Deliveries are accepted again.'
      : 'Door closed. Deliveries are refused and recorded as refused.',
  };
}

/**
 * Mapping a sending account to a client, which is what turns an unattributed
 * backlog into attributed events. The count returned is how many were waiting.
 */
export async function mapAccountAction(formData: FormData): Promise<ActionResult> {
  const provider = asProvider(formData.get('provider'));
  if (!provider) return { ok: false, error: 'Choose which provider this account belongs to.' };

  const caseFileId = String(formData.get('case_file_id') ?? '').trim();
  if (!caseFileId) return { ok: false, error: 'Choose the client this account belongs to.' };

  const supabase = await createClient();
  const { data, error } = await controlRpc<number>(supabase, 'map_ingest_account', {
    p_provider: provider,
    p_account_ref: String(formData.get('account_ref') ?? ''),
    p_case_file_id: caseFileId,
    p_label: String(formData.get('label') ?? '') || null,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  const replayed = data ?? 0;
  return {
    ok: true,
    message:
      replayed > 0
        ? `Account mapped. ${replayed} event${replayed === 1 ? '' : 's'} that were waiting on it have been processed.`
        : 'Account mapped. Nothing was queued against it.',
  };
}

/** For a delivery whose payload named no account at all. */
export async function attributeEventAction(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const caseFileId = String(formData.get('case_file_id') ?? '').trim();
  if (!caseFileId) return { ok: false, error: 'Choose the client this event belongs to.' };

  const supabase = await createClient();
  const { error } = await controlRpc(supabase, 'attribute_ingest_event', {
    p_event_id: eventId,
    p_case_file_id: caseFileId,
  });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  return { ok: true, message: 'Attributed and processed. The attribution is in the audit log.' };
}

export async function replayEventAction(eventId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ status: string; error: string | null }>(
    supabase,
    'replay_ingest_event',
    { p_event_id: eventId },
  );

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);

  // A replay that fails again is not an error in the request — the delivery is
  // still on record, and saying which state it landed in is more use than "done".
  if (data && data.status !== 'processed') {
    return {
      ok: false,
      error: `Replayed, and it is ${data.status} again: ${data.error ?? 'no reason given'}`,
    };
  }

  return { ok: true, message: 'Replayed and processed.' };
}

/** Processes anything still queued, without waiting for the next cron minute. */
export async function drainBacklogAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<number>(supabase, 'drain_ingest_backlog', { p_limit: 500 });

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  const drained = data ?? 0;
  return {
    ok: true,
    message: drained > 0 ? `Processed ${drained} queued deliveries.` : 'Nothing was queued.',
  };
}

export async function refreshRollupAction(key = 'cross_client'): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<{ stale: boolean; last_error: string | null }>(
    supabase,
    'refresh_rollup',
    { p_key: key },
  );

  if (error) return { ok: false, error: readable(error) };

  revalidatePath(INGESTION);
  revalidatePath('/da');

  if (data?.last_error) {
    return { ok: false, error: `The refresh failed: ${data.last_error}. The previous figures are still shown, as stale.` };
  }

  return { ok: true, message: 'Rollup recomputed.' };
}
