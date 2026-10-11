import { createClient } from '@supabase/supabase-js';

/**
 * The DivineACQ GHL Private Integration Token. GHL_PIT_TOKEN (or GHL_PIT_KEY)
 * wins; otherwise the one saved in Workspace settings (da_settings.ghl_pit_token),
 * which only the service role can read. Server-side only: never log it, never
 * return it to a client.
 */
export function envGhlPit(): string {
  return process.env.GHL_PIT_TOKEN?.trim() || process.env.GHL_PIT_KEY?.trim() || '';
}

const TTL_MS = 5 * 60 * 1000;
let stored = { value: '', at: 0 };
let inflight: Promise<string> | null = null;

async function loadStored(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!url || !key) return '';
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('da_get_ghl_pit');
  if (error) return '';
  return typeof data === 'string' ? data.trim() : '';
}

export async function ghlPit(): Promise<string> {
  const fromEnv = envGhlPit();
  if (fromEnv) return fromEnv;
  if (Date.now() - stored.at < TTL_MS) return stored.value;
  if (!inflight) {
    inflight = loadStored()
      .catch(() => '')
      .then((value) => {
        stored = { value, at: Date.now() };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Last known token without a lookup. Empty until ghlPit() has run once. */
export function ghlPitSync(): string {
  return envGhlPit() || stored.value;
}

export function forgetGhlPit(): void {
  stored = { value: '', at: 0 };
}

export async function ghlPitSource(): Promise<'env' | 'settings' | 'none'> {
  if (envGhlPit()) return 'env';
  return (await ghlPit()) ? 'settings' : 'none';
}
