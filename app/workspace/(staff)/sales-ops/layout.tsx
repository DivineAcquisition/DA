import type { Metadata } from 'next';
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
      {role === 'admin' ? <SalesOpsTabs role={role} /> : null}
      {children}
    </div>
  );
}
