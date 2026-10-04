import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Public DivineACQ project. The anon key is a publishable client key, same
 * class as NEXT_PUBLIC_SUPABASE_ANON_KEY. The schedule page and the public
 * application use it when the deploy env does not point at this project.
 */
export const ACQ_PUBLIC_SUPABASE_URL = 'https://hfgattcqlzuyahqywuoq.supabase.co';

const ACQ_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmZ2F0dGNxbHp1eWFocXl3dW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMTgzNzAsImV4cCI6MjEwMTY5NDM3MH0.AQ2y7agX8H5Fb-BeGeHgqxLjtBbaBL5lYxFSYZ5603E';

type UntypedClient = SupabaseClient<any>;

function inTest(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

/** Clients that can read and write the public audit schedule. Tests stay offline. */
export function acqPublicClients(): UntypedClient[] {
  if (inTest()) return [];

  const targets: { url: string; key: string }[] = [
    { url: ACQ_PUBLIC_SUPABASE_URL, key: ACQ_PUBLIC_SUPABASE_ANON_KEY },
  ];

  const envUrl =
    process.env.ACQ_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const envKey =
    process.env.ACQ_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    '';
  if (envUrl && envKey && !targets.some((target) => target.url === envUrl)) {
    targets.push({ url: envUrl, key: envKey });
  }

  return targets.map((target) =>
    createClient(target.url, target.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}
