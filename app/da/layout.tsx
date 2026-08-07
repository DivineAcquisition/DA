import type { Metadata } from 'next';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import UnifiedAdminChrome, {
  isUnifiedAdminRequest,
} from '@/app/workspace/components/UnifiedAdminChrome';
import AdminShell from './components/AdminShell';
import NotConfigured from './components/NotConfigured';
import SignIn from './components/SignIn';

export const metadata: Metadata = {
  title: {
    default: 'Growth | Divine Acquisition',
    template: '%s | Divine Acquisition',
  },
  description: "Divine Acquisition's internal record of what was delivered and what it produced.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();

  if (!session) return <SignIn />;
  if (!session.isAdmin) return <SignIn refusedFor={session.email} />;

  if (await isUnifiedAdminRequest()) {
    return <UnifiedAdminChrome email={session.email}>{children}</UnifiedAdminChrome>;
  }

  return <AdminShell session={session}>{children}</AdminShell>;
}
