import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/workspace/db';
import { EmptyState } from '../components/ui';
import SalesOpsTabs from './components/SalesOpsTabs';

export const metadata: Metadata = { title: 'Workspace setup' };

export const dynamic = 'force-dynamic';

export default async function SalesOpsLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) {
    return (
      <EmptyState
        title="DA Admin only."
        description="Sales Operator workspace setup is limited to DA Admin. Managers see their operators under Team, Sales workspace."
      />
    );
  }
  return (
    <div className="animate-rise">
      <SalesOpsTabs />
      {children}
    </div>
  );
}
