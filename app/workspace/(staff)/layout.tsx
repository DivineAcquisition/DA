import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { STAFF_HOME } from '@/lib/workspace/adminNav';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import { managerPathAllowed } from '@/lib/workspace/manager-paths';
import { loadNavCounts } from '@/lib/workspace/nav-counts';
import { ManagerShell } from '@/app/workspace/(portal)/components/Gates';
import { filePendingOperatorPackets } from '@/lib/workspace/placement-packet';
import LoginForm from './components/LoginForm';
import Shell from './components/Shell';
import { interDisplay } from './components/fonts';
import './workspace.css';
import RequireAdminMfa from '@/app/components/RequireAdminMfa';
import { ThemeFrame } from '@/app/workspace/components/ThemeControls';

export const metadata: Metadata = {
  title: {
    default: 'Admin | Divine Acquisition',
    template: '%s | Divine Acquisition Admin',
  },
  description: 'The live seat, the client file, and the weekly report.',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/** Inter Display, as on the Vistrial landing page, on every admin surface. */
const TYPE = `da-workspace da-admin-type ${interDisplay.variable}`;

function NotConfigured() {
  return (
    <div className={`${TYPE} flex min-h-screen items-center justify-center bg-ink-950 px-5`}>
      <div className="panel max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">Database not configured</h1>
        <p className="mt-3 text-sm text-neutral-400">
          This deploy is missing its database connection.
        </p>
      </div>
    </div>
  );
}

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname') ?? '';
  const isLogin = pathname.endsWith('/login') || pathname === '/workspace/login';

  if (!supabaseConfigured) {
    return (
      <div className={TYPE}>
        <NotConfigured />
      </div>
    );
  }

  const session = await getSessionContext();

  if (!session) {
    if (!isLogin) redirect('/workspace/login');
    return (
      <div className={TYPE}>
        <LoginForm />
      </div>
    );
  }

  if (!session.isAdmin) {
    if (session.role === 'manager') {
      if (!managerPathAllowed(pathname)) redirect(STAFF_HOME);
      const counts = await loadNavCounts();
      return (
        <ThemeFrame>
          <RequireAdminMfa email={session.email}>
            <div className={TYPE}>
              <ManagerShell name={session.fullName ?? session.email} counts={counts}>
                {children}
              </ManagerShell>
            </div>
          </RequireAdminMfa>
        </ThemeFrame>
      );
    }
    if (!isLogin) redirect('/workspace/login');
    return (
      <div className={TYPE}>
        <LoginForm />
      </div>
    );
  }

  if (isLogin) redirect(STAFF_HOME);

  // A placement queues the packet. Filing it needs Drive, Airtable, and the
  // PDF builder, so it runs here the next time an admin opens the workspace.
  await filePendingOperatorPackets().catch(() => ({ filed: 0, failed: 0 }));

  const counts = await loadNavCounts();

  return (
    <ThemeFrame>
      <RequireAdminMfa email={session.email}>
        <div className={TYPE}>
          <Shell email={session.email} counts={counts}>
            {children}
          </Shell>
        </div>
      </RequireAdminMfa>
    </ThemeFrame>
  );
}
