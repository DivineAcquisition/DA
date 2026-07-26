import type { Metadata } from 'next';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import AdminShell from './components/AdminShell';
import NotConfigured from './components/NotConfigured';
import SignIn from './components/SignIn';

export const metadata: Metadata = {
  title: {
    default: 'Vistrial — Client Documentation & Growth',
    template: '%s | Vistrial',
  },
  description: "Divine Acquisition's internal record of what was delivered and what it produced.",
  // Rule 8: admin-only, and never indexed.
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();

  // Rule 8. RLS refuses the data regardless, but there is no reason to render a
  // surface that would come back empty.
  if (!session) return <SignIn />;
  if (!session.isAdmin) return <SignIn refusedFor={session.email} />;

  return <AdminShell session={session}>{children}</AdminShell>;
}
