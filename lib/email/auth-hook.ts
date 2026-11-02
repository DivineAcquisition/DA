import { createHash } from 'node:crypto';
import { appUrl } from '@/lib/apps';
import { buildAuthEmail, type AuthKind } from './auth-mail';
import { authVerifyUrl } from './hook';
import { idempotencyKey } from './policy';
import { sendAppEmail } from './service';

const KINDS = new Set<AuthKind>(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'reauthentication']);

type HookBody = {
  user?: { id?: string; email?: string };
  email_data?: {
    token?: string;
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: string;
  };
};

async function fallbackRedirect(email: string, type: string): Promise<string> {
  const { serviceRoleClient } = await import('@/lib/workspace/db');
  const client = serviceRoleClient();
  let role: string | null = null;
  if (client) {
    const { data } = await client.from('profile').select('role').ilike('email', email).maybeSingle();
    role = (data as { role?: string } | null)?.role ?? null;
  }
  if (role === 'operator') {
    const { loadOperatorWorkspaceDomain } = await import('@/lib/operator-workspace/domain');
    const origin = (await loadOperatorWorkspaceDomain()).origin || appUrl('team');
    const next = type === 'recovery' ? '/reset-password' : '/workspace/operator';
    return `${origin}/workspace/auth/callback?next=${encodeURIComponent(next)}`;
  }
  if (!role) {
    const next = '/academy';
    return `${appUrl('training')}/academy/auth/callback?next=${encodeURIComponent(next)}`;
  }
  const next = type === 'recovery' ? '/workspace/reset-password' : '/workspace';
  return `${appUrl('admin')}/workspace/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function deliverAuthHook(body: HookBody): Promise<{ ok: boolean; error?: string }> {
  const email = body.user?.email?.trim().toLowerCase() ?? '';
  const userId = body.user?.id ?? '';
  const data = body.email_data ?? {};
  const type = data.email_action_type ?? '';
  if (!email || !KINDS.has(type as AuthKind)) return { ok: false, error: 'Unrecognized auth email' };
  const kind = type as AuthKind;
  const tokenHash = data.token_hash || data.token_hash_new || '';
  const redirectTo = data.redirect_to?.trim() || (kind === 'reauthentication' ? '' : await fallbackRedirect(email, kind));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || '';
  const url = tokenHash && supabaseUrl ? authVerifyUrl(supabaseUrl, tokenHash, kind === 'signup' ? 'signup' : kind, redirectTo) : '';
  const mail = buildAuthEmail({ kind, email, url, code: data.token });
  const digest = createHash('sha256').update(`${userId}:${kind}:${tokenHash || data.token || ''}`).digest('hex').slice(0, 24);
  const result = await sendAppEmail({
    purpose: 'security',
    to: email,
    replyTo: null,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    template: mail.template,
    idempotencyKey: idempotencyKey(['auth', kind, digest]),
    event: `auth.${kind}`,
    payload: { kind },
  });
  if (result.status === 'blocked' || result.status === 'suppressed') return { ok: true };
  if (!result.ok) return { ok: false, error: result.error || result.status };
  return { ok: true };
}
