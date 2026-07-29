import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { controlRpc } from '@/lib/ad/rpc';
import type { AccountState, ImpersonationContext, UserRole } from '@/lib/ad/types';
import type { Database } from './database.types';

/**
 * Which project this deploy talks to comes from the environment and nowhere else.
 *
 * These used to fall back to the live project's URL and publishable key, so a
 * deploy that forgot its environment variables silently talked to production
 * instead of showing the "not connected" screen. That is the opposite of degrading
 * visibly: a preview or a misconfigured environment reads and writes real client
 * data while looking like it is working. Every surface already checks
 * `supabaseConfigured` and renders NotConfigured, so the absence is now visible.
 */
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
  /** The profile the UI is presenting as — differs during impersonation. */
  actingUserId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  state: AccountState;
  /** Owner and Admin — surfaces that previously gated on role === 'admin'. */
  isAdmin: boolean;
  /** Owner / Admin / Manager — who may enter the control-plane workspace. */
  canAccessControlPlane: boolean;
  mustChangePassword: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number | null;
  impersonation: ImpersonationContext | null;
};

type ProfileRow = {
  role: string;
  full_name: string | null;
  email: string;
  state: string;
  must_change_password: boolean | null;
  mfa_required: boolean | null;
  session_timeout_minutes: number | null;
};

function asRole(value: string | null | undefined): UserRole {
  if (
    value === 'owner' ||
    value === 'admin' ||
    value === 'manager' ||
    value === 'operator' ||
    value === 'contractor' ||
    value === 'client'
  ) {
    return value;
  }
  return 'client';
}

function asState(value: string | null | undefined): AccountState {
  if (
    value === 'pending' ||
    value === 'active' ||
    value === 'suspended' ||
    value === 'locked' ||
    value === 'expired' ||
    value === 'archived'
  ) {
    return value;
  }
  return 'pending';
}

/**
 * Resolves the caller and their role. Uses getUser() rather than getSession()
 * so the token is validated against the auth server instead of trusted from a
 * cookie, and reads the role from `profile` rather than user metadata, which the
 * user can edit themselves.
 *
 * Owner is treated as admin-capable so existing /da and /vistrial gates keep
 * working after the control-plane promotion of admin@vistrial.io.
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
    .select('role, full_name, email, state, must_change_password, mfa_required, session_timeout_minutes')
    .eq('id', user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;
  const role = asRole(row?.role);
  const state = asState(row?.state);

  let impersonation: ImpersonationContext | null = null;
  const { data: ctx } = await controlRpc<ImpersonationContext[] | ImpersonationContext>(
    supabase,
    'impersonation_context',
  );
  if (Array.isArray(ctx) && ctx.length > 0) impersonation = ctx[0];
  else if (ctx && !Array.isArray(ctx) && 'id' in ctx) impersonation = ctx;

  const actingUserId = impersonation?.target_profile_id ?? user.id;
  let actingRole = role;
  let actingEmail = row?.email ?? user.email ?? '';
  let actingName = row?.full_name ?? null;
  let actingState = state;
  let mustChangePassword = Boolean(row?.must_change_password);
  let mfaRequired =
    row?.mfa_required === true || role === 'owner' || role === 'admin' || role === 'manager';
  let sessionTimeoutMinutes = row?.session_timeout_minutes ?? null;

  if (impersonation && impersonation.target_profile_id !== user.id) {
    const { data: target } = await supabase
      .from('profile')
      .select('role, full_name, email, state, must_change_password, mfa_required, session_timeout_minutes')
      .eq('id', impersonation.target_profile_id)
      .maybeSingle();
    const targetRow = target as ProfileRow | null;
    if (targetRow) {
      actingRole = asRole(targetRow.role);
      actingEmail = targetRow.email;
      actingName = targetRow.full_name;
      actingState = asState(targetRow.state);
      mustChangePassword = Boolean(targetRow.must_change_password);
      mfaRequired = targetRow.mfa_required === true;
      sessionTimeoutMinutes = targetRow.session_timeout_minutes;
    } else {
      actingRole = asRole(impersonation.target_role ?? undefined);
      actingEmail = impersonation.target_email ?? actingEmail;
      actingName = impersonation.target_full_name;
    }
  }

  const isAdmin = role === 'owner' || role === 'admin';
  const canAccessControlPlane = role === 'owner' || role === 'admin' || role === 'manager';

  return {
    userId: user.id,
    actingUserId,
    email: actingEmail,
    fullName: actingName,
    role: actingRole,
    state: actingState,
    isAdmin,
    canAccessControlPlane,
    mustChangePassword,
    mfaRequired,
    sessionTimeoutMinutes,
    impersonation,
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

export const isControlPlaneSession = cache(async (): Promise<boolean> => {
  const session = await getSessionContext();
  return session?.canAccessControlPlane ?? false;
});
