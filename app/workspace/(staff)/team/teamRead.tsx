import { controlRpc, readable } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

/** One staff_* read for a server page. The database decides what this viewer may see. */
export async function teamRead<T>(fn: string, args: Record<string, unknown> = {}): Promise<{ data: T | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await controlRpc<T>(supabase, fn, args);
  return { data: data ?? null, error: error ? readable(error) : null };
}

export function Refused({ error }: { error: string }) {
  return <p className="text-sm text-flag-critical">{error}</p>;
}
