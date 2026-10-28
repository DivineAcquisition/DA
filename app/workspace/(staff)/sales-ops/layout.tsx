import type { Metadata } from 'next';
import { signOutAction } from '@/lib/workspace/actions';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { EmptyState } from '../components/ui';
import SalesOpsTabs from './components/SalesOpsTabs';

export const metadata: Metadata = { title: 'Workspace setup' };

export const dynamic = 'force-dynamic';

export default async function SalesOpsLayout({ children }: { children: React.ReactNode }) {
  const role = await salesOpsRole();
  if (!role) {
    return (
      <EmptyState
        title="Managers and DA Admin only."
        description="Sales Operator workspace setup is limited to managers and DA Admin."
      />
    );
  }
  return (
    <div className="animate-rise">
      {role === 'manager' ? (
        <header className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--ws-dim)]">Sales workspace. You can see every operator. DA Admin edits placements.</p>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-[var(--ws-dim)] hover:text-white">
              Sign out
            </button>
          </form>
        </header>
      ) : null}
      <SalesOpsTabs role={role} />
      {children}
    </div>
  );
}
