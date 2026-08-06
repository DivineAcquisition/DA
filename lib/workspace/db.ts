import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  createClient,
  getSessionContext,
  supabaseConfigured,
} from '@/lib/supabase/server';

/**
 * Workspace tables are ahead of the checked-in Database types. Cast the client
 * so queries stay typed at the call site without editing the generated file.
 */
export type UntypedClient = SupabaseClient<any>;

export async function workspaceClient(): Promise<UntypedClient | null> {
  if (!supabaseConfigured) return null;
  return (await createClient()) as unknown as UntypedClient;
}

export function serviceClient(): UntypedClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseConfigured || !SUPABASE_URL || !serviceKey) {
    if (!supabaseConfigured || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
    return createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as UntypedClient;
  }
  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as UntypedClient;
}

export async function requireAdmin() {
  const session = await getSessionContext();
  if (!session?.isAdmin) return null;
  return session;
}

export { supabaseConfigured };
