import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/**
 * Call a control-plane RPC that is live on the project but not yet in the
 * generated Database types. The remote schema is ahead of the checked-in types
 * for the roles/auth migrations that still need a typed export.
 */
export async function controlRpc<T = unknown>(
  supabase: SupabaseClient<Database>,
  fn: string,
  args: Record<string, unknown> = {},
): Promise<{ data: T | null; error: { message: string; code?: string } | null }> {
  const { data, error } = await (supabase as unknown as { rpc: Function }).rpc(fn, args);
  return {
    data: (data as T | null) ?? null,
    error: error
      ? { message: error.message, code: 'code' in error ? String(error.code) : undefined }
      : null,
  };
}

/** Turns `code: human sentence` Postgres raises into the sentence alone. */
export function readable(error: { message: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  const match = error.message.match(/^[a-z_]+:\s*([\s\S]+)$/);
  return match ? match[1] : error.message;
}

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };
