import { isAdminSession, supabaseConfigured } from '@/lib/supabase/server';

/** True only when this request can read the growth tables without being refused. */
export async function growthReady(): Promise<boolean> {
  if (!supabaseConfigured) return false;
  return isAdminSession();
}
