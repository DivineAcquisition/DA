/**
 * Resolve a public /s/<token> to its DocuSeal destination.
 *
 * Signing links are minted against DivineACQ. During cutover the Vercel deploy
 * may still point NEXT_PUBLIC_SUPABASE_* at an older project, which makes the
 * page look "expired". Prefer the deploy's Supabase when it works; fall back to
 * the DivineACQ project (anon key is public by design).
 */

export type ResolvedSigning = {
  destination_url: string;
  recipient_name?: string;
  template_name?: string;
  status?: string;
};

const DIVINEACQ_URL = 'https://hfgattcqlzuyahqywuoq.supabase.co';
/** Public anon key for DivineACQ — safe to ship; RLS + grants still apply. */
const DIVINEACQ_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZ2F0dGNxbHp1eWFocXl3dW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTgzNzAsImV4cCI6MjEwMTY5NDM3MH0.AQ2y7agX8H5Fb-BeGeHgqxLjtBbaBL5lYxFSYZ5603E';

function firstEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

async function rpcResolve(
  baseUrl: string,
  apiKey: string,
  token: string,
): Promise<ResolvedSigning | null> {
  if (!baseUrl || !apiKey || token.trim().length < 32) return null;

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/rest/v1/rpc/da_resolve_signing_token`, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as ResolvedSigning | null;
    if (!data?.destination_url) return null;
    return data;
  } catch {
    return null;
  }
}

/** Public signing base used in emails and stored signing_url values. */
export function signingPublicBaseUrl(settingsBase?: string | null): string {
  const fromEnv = firstEnv('NEXT_PUBLIC_TALENT_HOST', 'DA_SIGNING_PUBLIC_BASE_URL');
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const fromSettings = (settingsBase ?? '').trim().replace(/\/+$/, '');
  if (fromSettings) return fromSettings;
  return 'https://talent.divineacquisition.io';
}

export async function resolveSigningToken(token: string): Promise<ResolvedSigning | null> {
  const trimmed = token.trim();
  if (trimmed.length < 32) return null;

  const primaryUrl = firstEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const primaryKey = firstEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  );

  if (primaryUrl && primaryKey) {
    const primary = await rpcResolve(primaryUrl, primaryKey, trimmed);
    if (primary) return primary;
  }

  // Cutover fallback: agreements live on DivineACQ even if the deploy's
  // NEXT_PUBLIC_SUPABASE_* still points elsewhere.
  if (primaryUrl.replace(/\/+$/, '') !== DIVINEACQ_URL) {
    return rpcResolve(DIVINEACQ_URL, DIVINEACQ_ANON, trimmed);
  }

  return null;
}
