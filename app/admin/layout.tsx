import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { passwordPageKind } from '@/lib/auth/password';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import UnifiedAdminChrome from '@/app/workspace/(staff)/components/UnifiedAdminChrome';
import AdminSignIn from './components/AdminSignIn';
import NotConfigured from './components/NotConfigured';
import RequireAdminMfa from '@/app/components/RequireAdminMfa';

export const metadata: Metadata = {
  title: {
    default: 'Assessment Admin | Divine Acquisition',
    template: '%s | Assessment Admin',
  },
  description: 'Send tokenized assessment booking invites.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function AssessmentAdminLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const passwordPage = passwordPageKind((await headers()).get('x-pathname') ?? '');
  if (passwordPage === 'forgot') return <>{children}</>;

  const session = await getSessionContext();
  if (passwordPage === 'reset') return session ? <>{children}</> : <AdminSignIn />;
  if (!session) return <AdminSignIn />;
  if (!session.isAdmin) return <AdminSignIn refusedFor={session.email} />;

  return (
    <RequireAdminMfa email={session.email}>
      <UnifiedAdminChrome email={session.email}>{children}</UnifiedAdminChrome>
    </RequireAdminMfa>
  );
}
