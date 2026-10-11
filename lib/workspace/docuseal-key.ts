import 'server-only';
import { serviceRoleClient } from './db';

/**
 * The key in Settings wins, so it can be rotated without a deploy. The
 * environment variable is only the fallback when Settings has none.
 */
export async function readDocuSealApiKey(): Promise<string> {
  const client = serviceRoleClient();
  if (client) {
    const { data, error } = await client.rpc('da_get_docuseal_api_key');
    if (!error && typeof data === 'string' && data.trim()) return data.trim();

    const row = await client.from('da_settings').select('docuseal_api_key').eq('id', 1).maybeSingle();
    const fromDb = String((row.data as { docuseal_api_key?: string } | null)?.docuseal_api_key ?? '').trim();
    if (fromDb) return fromDb;
  }
  return (process.env.DOCUSEAL_API_KEY ?? '').trim();
}
