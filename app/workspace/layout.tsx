import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import LoginForm from './components/LoginForm';
import Shell from './components/Shell';
import './workspace.css';

export const metadata: Metadata = {
  title: {
    default: 'Admin | Divine Acquisition',
    template: '%s | Divine Acquisition Admin',
  },
  description: 'Agreements, tokenized pages, and calendar links.',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

function NotConfigured() {
  return (
    <div className="da-workspace flex min-h-screen items-center justify-center bg-ink-950 px-5">
      <div className="panel max-w-md rounded-2xl p-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-white">Supabase not configured</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY on this deploy.
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
      <div className="da-workspace">
        <NotConfigured />
      </div>
    );
  }

  const session = await getSessionContext();

  if (!session?.isAdmin) {
    if (!isLogin) redirect('/workspace/login');
    return (
      <div className="da-workspace">
        <LoginForm />
      </div>
    );
  }

  if (isLogin) redirect('/workspace/overview');

  return (
    <div className="da-workspace">
      <Shell email={session.email}>{children}</Shell>
    </div>
  );
}
