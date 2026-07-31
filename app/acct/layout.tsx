import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSessionContext, supabaseConfigured } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import NotConfigured from '@/app/da/components/NotConfigured';
import ClientShell from './components/ClientShell';
import ClientSignIn from './components/ClientSignIn';

export const metadata: Metadata = {
  title: { default: 'Your account', template: '%s | Vistrial' },
  description: 'Your funnel, your growth, and your documents.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function AcctLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;

  const pathname = (await headers()).get('x-pathname') ?? '';
  // Invite acceptance must render before a client_account exists.
  if (pathname.startsWith('/acct/invite')) {
    return <>{children}</>;
  }

  const session = await getSessionContext();
  if (!session) return <ClientSignIn />;

  const supabase = await createClient();

  // Rule 1: one row, or none. There is no shape of this query that returns a list.
  const { data: account } = await supabase
    .from('client_account')
    .select('*, client_case_file(name, vertical, status)')
    .maybeSingle();

  // An admin or operator landing here has no client_account, so there is nothing
  // to show them — and RLS would return nothing regardless.
  if (!account) return <ClientSignIn wrongAudience={session.email} />;

  return (
    <ClientShell
      account={account}
      businessName={(account.client_case_file as { name: string } | null)?.name ?? 'Your account'}
      email={session.email}
    >
      {children}
    </ClientShell>
  );
}
