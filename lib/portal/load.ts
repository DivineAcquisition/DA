import { cookies } from 'next/headers';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import type { PortalContext } from './types';

/** The placement a VA last picked in the switcher. Only a preference: the
 *  database decides whether it is theirs. */
export const PLACEMENT_COOKIE = 'va_placement';

export type Rpc = <T>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: string | null }>;

export type PortalLoad<T> =
  | { kind: 'closed'; message: string }
  | {
      kind: 'ready';
      context: PortalContext;
      placementId: string | null;
      /** A blocking notice is waiting: nothing but the notice is loaded. */
      blocked: boolean;
      data: T | null;
      error: string | null;
    };

/**
 * Loads the shell context and one tab's data. Every page in the portal goes
 * through this, so the page view is audited during View As (portal_context does
 * that), and nothing behind an unacknowledged blocking notice is fetched for the
 * VA at all.
 */
export async function loadPortal<T>(
  tab: string,
  fetchTab?: (rpc: Rpc, placementId: string | null) => Promise<{ data: T | null; error: string | null }>,
): Promise<PortalLoad<T>> {
  const supabase = await createClient();
  const rpc: Rpc = async <R,>(fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await controlRpc<R>(supabase, fn, args);
    return { data, error: error ? readable(error) : null };
  };

  const jar = await cookies();
  const wanted = jar.get(PLACEMENT_COOKIE)?.value ?? null;

  // With a remembered placement, the tab loads alongside the context. The
  // database still refuses a placement that is not the VA's.
  const early = wanted && fetchTab ? fetchTab(rpc, wanted) : null;
  const context = await rpc<PortalContext>('portal_context', { p_tab: tab, p_placement_id: wanted });

  if (context.error || !context.data) {
    return { kind: 'closed', message: context.error ?? 'The portal could not be loaded.' };
  }

  const ctx = context.data;
  const placementId = ctx.selected_placement_id;
  const blocked = ctx.blocking_notices.length > 0 && !ctx.viewer.view_as;

  if (blocked || !fetchTab) {
    return { kind: 'ready', context: ctx, placementId, blocked, data: null, error: null };
  }

  const result = early && placementId === wanted ? await early : await fetchTab(rpc, placementId);
  return { kind: 'ready', context: ctx, placementId, blocked, data: result.data, error: result.error };
}
