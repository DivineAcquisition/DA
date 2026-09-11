import Link from 'next/link';
import { PageHeader } from '../../components/ui';
import { listHsCalls } from '@/lib/workspace/hs-call-queries';
import HsCallsList from './components/HsCallsList';

export const dynamic = 'force-dynamic';

export default async function HsCallsPage() {
  const calls = await listHsCalls();

  return (
    <div className="animate-rise">
      <PageHeader
        title="HS calls"
        description="15-minute qualifying calls with home-services owners. The only goal is booking the operations audit."
        actions={
          <Link
            href="/workspace/hs/calls/new"
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: '#6A00FF' }}
          >
            New call
          </Link>
        }
      />
      <HsCallsList calls={calls} />
    </div>
  );
}
