import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import LoginForm from './components/LoginForm';
import Shell from './components/Shell';
import './workspace.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

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
    <div className="da-workspace flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-card)] p-8 text-center">
        <h1 className="font-[family-name:var(--font-plus-jakarta)] text-xl font-semibold text-white">
          Supabase not configured
        </h1>
        <p className="mt-3 text-sm text-[var(--ws-dim)]">
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
      <div className={`da-workspace ${plusJakarta.variable}`}>
        <NotConfigured />
      </div>
    );
  }

  const session = await getSessionContext();

  if (!session?.isAdmin) {
    if (!isLogin) redirect('/workspace/login');
    return (
      <div className={`da-workspace ${plusJakarta.variable}`}>
        <LoginForm />
      </div>
    );
  }

  if (isLogin) redirect('/workspace/recipients');

  return (
    <div className={`da-workspace ${plusJakarta.variable}`}>
      <Shell email={session.email}>{children}</Shell>
    </div>
  );
}
