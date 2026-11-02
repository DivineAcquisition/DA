import Link from 'next/link';
import PlacementBoard from '../components/PlacementBoard';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { PageHeader } from '../../components/ui';

const STATUSES = ['', 'draft', 'scheduled', 'active', 'paused', 'ended'];

export default async function PlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const role = await salesOpsRole();
  const { q = '', status = '' } = await searchParams;
  return (
    <>
      <PageHeader
        title="Placements"
        description="Draft, scheduled, active, paused, and ended. One operator has one open placement. A client can have more than one."
        actions={
          role ? (
            <Link
              href="/workspace/sales-ops/placements/new"
              className="inline-flex h-9 items-center rounded-lg border border-primary bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              New placement
            </Link>
          ) : null
        }
      />
      <form className="mb-4 flex flex-wrap gap-2" action="/workspace/sales-ops/placements">
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
