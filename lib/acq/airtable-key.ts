import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { controlRpc } from '@/lib/ad/rpc';
import { SUPABASE_URL } from '@/lib/supabase/server';

/**
 * DA Pipeline Airtable token.
 *
 * Production source is `da_settings.pipeline_airtable_pat` (Supabase backend).
 * `AIRTABLE_API_KEY` is a local-dev fallback only — never a NEXT_PUBLIC value,
 * never sent to a client component.
 */
export function pickAirtableApiKey(fromSettings: string, fromEnv: string): string {
  return fromSettings.trim() || fromEnv.trim();
}

export function envAirtableApiKey(): string {
  return process.env.AIRTABLE_API_KEY?.trim() || '';
}

let memoryKey = '';
let settingsResolved = false;
let inflight: Promise<string> | null = null;

export function cachedAirtableApiKey(): string {
  return pickAirtableApiKey(memoryKey, envAirtableApiKey());
}

export function airtableKeyConfiguredSync(): boolean {
  return Boolean(cachedAirtableApiKey());
}

function serviceRoleForSecrets() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
  if (!SUPABASE_URL || !key) return null;
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadSettingsPat(): Promise<string> {
  const supabase = serviceRoleForSecrets();
  if (!supabase) return '';
  const { data, error } = await controlRpc<string>(supabase as never, 'da_get_pipeline_airtable_pat', {});
  if (error) return '';
  return (data ?? '').trim();
}

export async function resolveAirtableApiKey(): Promise<string> {
  const fromEnv = envAirtableApiKey();
  if (settingsResolved) return pickAirtableApiKey(memoryKey, fromEnv);
  if (!inflight) {
    inflight = (async () => {
      memoryKey = await loadSettingsPat();
      settingsResolved = true;
      return pickAirtableApiKey(memoryKey, fromEnv);
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
