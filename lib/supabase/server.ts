import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from './database.types';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/**
 * Server-side client. A fresh one per render — never shared across requests,
 * because each carries the caller's session.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes sessions,
          // so this is safe to swallow here.
        }
      },
    },
  });
}

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

/**
 * Resolves the caller and their role. Uses getUser() rather than getSession()
 * so the token is validated against the auth server instead of trusted from a
 * cookie, and reads the role from `profile` rather than user metadata, which the
 * user can edit themselves.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profile')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name ?? null,
    isAdmin: profile?.role === 'admin',
  };
}

/**
 * Whether this request belongs to an admin, resolved once per request.
 *
 * A layout that refuses a surface does not stop Next rendering the page beneath
 * it, so without this the admin read helpers fire on every unauthenticated visit
 * and Postgres correctly refuses them. RLS is still the boundary; this only keeps
 * a refusal from surfacing as a server error on a page nobody is going to see.
 */
export const isAdminSession = cache(async (): Promise<boolean> => {
  const session = await getSessionContext();
  return session?.isAdmin ?? false;
});
