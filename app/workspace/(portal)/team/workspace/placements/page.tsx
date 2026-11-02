import Link from 'next/link';
import PlacementBoard from '@/app/workspace/(staff)/sales-ops/components/PlacementBoard';

export default async function TeamPlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = '', status = '' } = await searchParams;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-white">Placements</h1>
        <Link href="/workspace/team/workspace/placements/new" className="rounded-lg bg-[#6A00FF] px-3 py-1.5 text-sm text-white">
          New placement
        </Link>
      </div>
      <form className="flex flex-wrap gap-2" action="/workspace/team/workspace/placements">
        <input name="q" defaultValue={q} placeholder="Search" className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm" />
        <select name="status" defaultValue={status} className="h-9 rounded-lg border border-white/10 bg-transparent px-3 text-sm">
          <option value="">All statuses</option>
          {['draft', 'scheduled', 'active', 'paused', 'ended'].map((item) => (
            <option key={item} value={item}>
              {item[0].toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
        <button className="h-9 rounded-lg border border-white/10 px-3 text-sm" type="submit">
          Filter
        </button>
      </form>
      <PlacementBoard query={q} status={status} />
    </div>
  );
}
