import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import AdminMfaGate from '@/app/components/AdminMfaGate';
import { appUrl } from '@/lib/apps';
import { currentApp } from '@/lib/appsServer';
import { adminMfaState } from '@/lib/auth/mfa';
import { hubSignOutAction } from '@/lib/vistrial/authActions';
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
    default: 'Divine Acquisition Team',
    template: '%s | Divine Acquisition Team',
  },
  description: 'Divine Acquisition Team.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function VistrialLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const app = await currentApp();
  // The training host never renders this layout. A request that still lands
  // here is not a team or admin screen.
  if (app === 'training') notFound();
  const pathname = (await headers()).get('x-pathname') ?? '';
  const operatorPath = pathname === '/vistrial/operator' || pathname.startsWith('/vistrial/operator/');
  const session = await getSessionContext();
  // The admin app has no VA screens of its own (only the View As mirror), so a
  // signed-out request for one is simply not found.
  if (!session && app === 'admin' && operatorPath) notFound();
  if (!session) return <HubSignIn app={app ?? 'team'} />;

  // Opened from a password reset email: the new password comes before anything else.
  if (pathname === '/vistrial/reset-password') return <>{children}</>;

  // session.role is who the screen presents as (the VA during View As);
  // canAccessControlPlane is the signed-in person's own role.
  const viewingAs = Boolean(session.impersonation);
  const isStaff = session.canAccessControlPlane;
  const isVa = !viewingAs && session.role === 'operator';

  // The team app: VAs and SDRs only. Staff are signed out of it and sent to the
  // admin app, which has its own session.
  if (app === 'team') {
    if (isStaff) redirect('/vistrial/auth/leave?to=admin');
    if (!isVa) return <HubSignIn app="team" wrongAudience={session.email} />;
    return <OperatorGate>{children}</OperatorGate>;
  }

  if (app === 'admin') {
    if (isVa) return <HubSignIn app="admin" wrongApp={{ email: session.email, url: appUrl('team') }} />;
    if (!isStaff) return <HubSignIn app="admin" wrongAudience={session.email} />;
    const mfa = await adminMfaState();
    if (mfa.state !== 'ok') {
      return <AdminMfaGate state={mfa.state} factorId={mfa.factorId} email={session.email} signOut={hubSignOutAction} />;
    }
    // The VA's screens exist in the admin app only as View As: a read-only
    // mirror, with the banner. Without an active View As they are not found.
    if (operatorPath && !viewingAs) notFound();
  }

  // A Sales Operator, or staff viewing as one (View As or impersonation): the
  // portal, and nothing else. It loads its own data through the portal functions.
  if (session.role === 'operator') return <OperatorGate>{children}</OperatorGate>;

  // Managers oversee the operators in their scope from the team page.
  if (session.role === 'manager') {
    return <ManagerShell name={session.fullName ?? session.email}>{children}</ManagerShell>;
  }

  if (!session.isAdmin || session.role === 'contractor' || session.role === 'client') {
    return <HubSignIn app={app ?? 'team'} wrongAudience={session.email} />;
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
