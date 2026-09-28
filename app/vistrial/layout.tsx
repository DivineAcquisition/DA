import type { Metadata } from 'next';
import NotConfigured from '@/app/da/components/NotConfigured';
import UnifiedAdminChrome, {
  isUnifiedAdminRequest,
} from '@/app/workspace/components/UnifiedAdminChrome';
import { loadOpsData } from '@/lib/vistrial/load';
import { OpsProvider } from '@/lib/vistrial/store';
import type { Actor } from '@/lib/vistrial/types';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import AppShell from './components/AppShell';
import { ManagerShell, OperatorGate } from './components/Gates';
import HubSignIn from './components/HubSignIn';

export const metadata: Metadata = {
  title: {
    default: 'Ops | Divine Acquisition',
    template: '%s | Divine Acquisition Ops',
  },
  description: 'Internal operations hub for the operators Divine Acquisition trains and places.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function VistrialLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const session = await getSessionContext();
  if (!session) return <HubSignIn />;

  // A Sales Operator, or staff viewing as one (View As or impersonation): the
  // portal, and nothing else. It loads its own data through the portal functions.
  if (session.role === 'operator') return <OperatorGate>{children}</OperatorGate>;

  // Managers oversee the operators in their scope from the team page.
  if (session.role === 'manager') {
    return <ManagerShell name={session.fullName ?? session.email}>{children}</ManagerShell>;
  }

  if (!session.isAdmin || session.role === 'contractor' || session.role === 'client') {
    return <HubSignIn wrongAudience={session.email} />;
  }

  const actor: Actor = { role: 'admin', id: session.userId, name: session.fullName ?? session.email };

  const data = await loadOpsData();
  const unified = session.isAdmin && (await isUnifiedAdminRequest());

  return (
    <OpsProvider data={data} actor={actor}>
      {unified ? (
        <UnifiedAdminChrome email={session.email}>{children}</UnifiedAdminChrome>
      ) : (
        <AppShell>{children}</AppShell>
      )}
    </OpsProvider>
  );
}
