import Link from 'next/link';
import { PageHeader } from '../components/ui';
import { listCalls } from '@/lib/workspace/call-queries';
import CallsList from './components/CallsList';

export const dynamic = 'force-dynamic';

export default async function CallsPage() {
  const calls = await listCalls();

  return (
    <div className="animate-rise">
      <PageHeader
        title="Calls"
        description="15-minute qualifying calls. The only goal is booking the practice audit."
        actions={
          <Link
            href="/workspace/calls/new"
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_12px_34px_-14px_rgba(154,136,252,0.9)] hover:bg-brand-400"
          >
            New call
          </Link>
        }
      />
      <CallsList calls={calls} />
    </div>
  );
}
