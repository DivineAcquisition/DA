/**
 * Public DivineACQ RPC helpers for tokenized signing pages.
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

function supabaseTargets(): Array<{ url: string; key: string }> {
  const primaryUrl = firstEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL').replace(/\/+$/, '');
  const primaryKey = firstEnv(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  );
  const targets: Array<{ url: string; key: string }> = [];
  if (primaryUrl && primaryKey) targets.push({ url: primaryUrl, key: primaryKey });
  if (primaryUrl !== DIVINEACQ_URL) {
    targets.push({ url: DIVINEACQ_URL, key: DIVINEACQ_ANON });
  }
  return targets;
}

/**
 * Call a security-definer public RPC, with DivineACQ cutover fallback.
 * `accept` decides whether a 200 payload is usable (default: non-null).
 */
export async function publicDaRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  accept: (data: T) => boolean = (data) => data != null,
): Promise<T | null> {
  for (const target of supabaseTargets()) {
    try {
      const response = await fetch(`${target.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: target.key,
          Authorization: `Bearer ${target.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
      if (!response.ok) continue;
      const data = (await response.json()) as T | null;
      if (data == null || !accept(data)) continue;
      return data;
    } catch {
      // try next target
    }
  }
  return null;
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
  const data = await publicDaRpc<ResolvedSigning>('da_resolve_signing_token', { p_token: trimmed });
  if (!data?.destination_url) return null;
  return data;
}
