import { serviceClient, type UntypedClient } from '@/lib/workspace/db';

export const VIDEO_STORAGE_ERROR =
  'Video storage is not configured. Paste a Vimeo or Mux link, or add the Supabase service role key on the server.';

/** Service-role client. The publishable key cannot sign private video URLs. */
export function videoStorage(): UntypedClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) return null;
  return serviceClient();
}
