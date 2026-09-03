import type { Metadata } from 'next';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import NotConfigured from '@/app/da/components/NotConfigured';
import Shell from './components/Shell';
import SignIn from './components/SignIn';

export const metadata: Metadata = {
  title: {
    default: 'Call Intelligence | Divine Acquisition',
    template: '%s | Call Intelligence',
  },
  description: 'Live call briefs, phone touches, and audit debriefs for DA Client Acquisition.',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function CallsLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();
  if (!session) return <SignIn />;
  if (!session.isAdmin) return <SignIn refusedFor={session.email} />;

  return <Shell session={session}>{children}</Shell>;
}
