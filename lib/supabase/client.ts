'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://onobzewvjsicwxbsdlzw.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  'sb_publishable_D0zVxSKE4J38HvaFJtWGqw_HmDl0AF5';

/**
 * Browser client. Only ever given the publishable key — the secret key must
 * never reach a browser bundle, and in Next any NEXT_PUBLIC_ variable does.
 *
 * Defaults match the live Vistrial project so a deploy that forgot the env vars
 * still reaches Postgres instead of rendering the "Database not connected"
 * screen. Env vars always win when present.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
