import type { Metadata } from 'next';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import UnifiedAdminChrome, {
  isUnifiedAdminRequest,
} from '@/app/workspace/components/UnifiedAdminChrome';
import AdminSignIn from './components/AdminSignIn';
import NotConfigured from './components/NotConfigured';

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

  const session = await getSessionContext();
  if (!session) return <AdminSignIn />;
  if (!session.isAdmin) return <AdminSignIn refusedFor={session.email} />;

  if (await isUnifiedAdminRequest()) {
    return <UnifiedAdminChrome email={session.email}>{children}</UnifiedAdminChrome>;
  }

  return <>{children}</>;
}
