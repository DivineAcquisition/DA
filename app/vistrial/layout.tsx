import type { Metadata } from 'next';
import NotConfigured from '@/app/da/components/NotConfigured';
import { loadOpsData } from '@/lib/vistrial/load';
import { OpsProvider } from '@/lib/vistrial/store';
import type { Actor } from '@/lib/vistrial/types';
import { createClient, getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import AppShell from './components/AppShell';
import HubSignIn from './components/HubSignIn';

export const metadata: Metadata = {
  title: {
    default: 'Vistrial — VA Ops Hub',
    template: '%s | Vistrial Ops',
  },
  description: 'Internal operations hub for the operators Divine Acquisition trains and places.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function VistrialLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();
  if (!session) return <HubSignIn />;

  const supabase = await createClient();

  // An operator is identified by the operator row pointing at their profile. RLS
  // then narrows every read below to what that person may see.
  const { data: operator } = await supabase
    .from('operator')
    .select('id, name')
    .eq('profile_id', session.userId)
    .maybeSingle();

  if (!session.isAdmin && !operator) return <HubSignIn wrongAudience={session.email} />;

  const actor: Actor =
    session.isAdmin && !operator
      ? { role: 'admin', id: session.userId, name: session.fullName ?? session.email }
      : session.isAdmin
        ? { role: 'admin', id: session.userId, name: session.fullName ?? session.email }
        : { role: 'operator', id: operator!.id, name: operator!.name };

  const data = await loadOpsData();

  return (
    <OpsProvider data={data} actor={actor}>
      <AppShell>{children}</AppShell>
    </OpsProvider>
  );
}
