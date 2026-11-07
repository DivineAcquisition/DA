import Link from 'next/link';
import { workspaceClient } from '@/lib/workspace/db';
import { LifecycleFlow } from '../components/agentic';
import PlacementBoard from '@/app/workspace/(staff)/sales-ops/components/PlacementBoard';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { PageHeader } from '@/app/workspace/(staff)/components/ui';

const STATUSES = ['', 'draft', 'scheduled', 'active', 'paused', 'ended'];

export default async function PlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const role = await salesOpsRole();
  const { q = '', status = '' } = await searchParams;
  const db = await workspaceClient();
  const { data: rows } = db ? await db.from('placement').select('status').neq('status', 'ended') : { data: [] };
  const count = (value: string) => ((rows ?? []) as { status: string }[]).filter((row) => row.status === value).length;
  return (
    <>
      <PageHeader
        title="Placements"
        description="The live seats: draft, scheduled, active, paused, and ended. A new one starts from a Ready operator or from a client case file."
        actions={
          role ? (
            <>
              <Link href="/workspace/operators/ready" className="inline-flex h-9 items-center rounded-lg border border-white/15 px-3.5 text-sm text-white hover:border-white/30">
                From a Ready operator
              </Link>
              <Link href="/workspace/clients" className="inline-flex h-9 items-center rounded-lg border border-white/15 px-3.5 text-sm text-white hover:border-white/30">
                From a client
              </Link>
            </>
          ) : null
        }
      />
      <div className="mb-5">
        <LifecycleFlow
          label="Wizard to live seat"
          stages={[
            { key: 'draft', label: 'Draft', count: count('draft'), hint: 'In the wizard', href: '/workspace/placements?status=draft', kind: 'person' },
            { key: 'scheduled', label: 'Scheduled', count: count('scheduled'), hint: 'Starts at the shift', href: '/workspace/placements?status=scheduled', kind: 'auto' },
            { key: 'active', label: 'Live', count: count('active'), hint: 'EODs and reports flowing', href: '/workspace/placements?status=active', kind: 'auto' },
            { key: 'paused', label: 'Paused', count: count('paused'), hint: 'Resume or end', href: '/workspace/placements?status=paused', kind: 'person' },
          ]}
          statuses={[
            count('draft') ? `${count('draft')} draft${count('draft') === 1 ? '' : 's'} waiting to finish the wizard` : null,
            count('scheduled') ? `${count('scheduled')} scheduled to go live` : null,
            count('active') ? `${count('active')} live seat${count('active') === 1 ? '' : 's'} reporting` : null,
            count('paused') ? `${count('paused')} paused` : null,
          ].filter((line): line is string => Boolean(line)).concat((rows ?? []).length ? [] : ['No open placements. Start one from a Ready operator.'])}
        />
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action="/workspace/placements">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search operator, client, or manager"
          className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm"
        />
        <select name="status" defaultValue={status} className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm">
          {STATUSES.map((item) => (
            <option key={item || 'all'} value={item}>
              {item ? item[0].toUpperCase() + item.slice(1) : 'All statuses'}
            </option>
          ))}
        </select>
        <button className="h-9 rounded-lg border border-white/10 px-3 text-sm" type="submit">
          Filter
        </button>
      </form>
      <PlacementBoard query={q} status={status} />
    </>
  );
}
