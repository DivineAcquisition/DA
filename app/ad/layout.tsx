import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import ControlShell from './components/ControlShell';
import NotConfigured from './components/NotConfigured';
import SignIn from './components/SignIn';

export const metadata: Metadata = {
  title: {
    default: 'Vistrial — Roles & Admin',
    template: '%s | Vistrial Control',
  },
  description: 'Account lifecycle, permissions, impersonation and audit for Divine Acquisition.',
  robots: { index: false, follow: false, nocache: true },
};

function blockedMessage(state: string): string | null {
  switch (state) {
    case 'suspended':
      return 'This account is suspended. Contact an Owner.';
    case 'locked':
      return 'This account is locked after failed sign-in attempts. Wait for the lock to lift or ask an Owner to unlock it.';
    case 'expired':
      return 'This account has expired.';
    case 'archived':
      return 'This account is archived.';
    case 'pending':
      return 'This account is pending invitation acceptance and has no permissions yet.';
    default:
      return null;
  }
}

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '';
  if (pathname === '/ad/invite' || pathname.startsWith('/ad/invite/')) {
    return <>{children}</>;
  }

  const session = await getSessionContext();
  if (!session) return <SignIn />;

  const blocked = blockedMessage(session.state);
  if (blocked && session.state !== 'active') {
    return <SignIn refusedFor={session.email} blockedReason={blocked} />;
  }

  if (!session.canAccessControlPlane) {
    return <SignIn refusedFor={session.email} />;
  }

  return <ControlShell session={session}>{children}</ControlShell>;
}
