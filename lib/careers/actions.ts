'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { readable, type ActionResult } from '@/lib/ad/rpc';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/server';

/**
 * The careers door.
 *
 * An applicant has no session, so this uses a sessionless client and the
 * anon-granted submit_role_application(), the same arrangement the machine doors
 * use. Everything is validated in Postgres, which is where the constraints are.
 */

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function submitApplicationAction(
  roleSlug: string,
  roleTitle: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!supabaseConfigured) {
    // Fail visibly. Telling somebody their application was received when there is
    // nowhere to put it is what this whole change exists to stop.
    return {
      ok: false,
      error: 'Applications are not accepting submissions right now. Please try again shortly.',
    };
  }

  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  const requestHeaders = await headers();

  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as RpcClient;

  const { error } = await supabase.rpc('submit_role_application', {
    p_role_slug: roleSlug,
    p_role_title: roleTitle,
    p_full_name: text('fullName'),
    p_email: text('email'),
    p_phone: text('phone'),
    p_linkedin_url: text('linkedin'),
    p_portfolio_url: text('portfolio'),
    p_loom_url: text('loomVideo'),
    p_experience: text('experience'),
    p_why_you: text('whyYou'),
    p_availability: text('availability'),
    p_ip: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    p_user_agent: requestHeaders.get('user-agent'),
  });

  if (error) return { ok: false, error: readable(error) };

  return {
    ok: true,
    message: 'Application received. It is on record and somebody will read it.',
  };
}
