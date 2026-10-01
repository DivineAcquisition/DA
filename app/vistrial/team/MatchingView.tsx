import Link from 'next/link';
import { formatDate } from '@/lib/portal/time';
import type { AvailabilityRow } from '@/lib/team/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Certified and benched VAs, with the windows they can work: for placing people. */
export default function MatchingView({ rows }: { rows: AvailabilityRow[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Availability</h1>
        <p className="mt-1 text-sm text-neutral-400">Certified and on-bench VAs, in their own time zones. Use this when creating a placement.</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-neutral-500">No VAs waiting for placement.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.operator_id} className="panel rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/vistrial/team/operator/${row.operator_id}`} className="text-sm font-semibold text-white hover:underline">
                {row.name}
              </Link>
              <span className="text-xs text-neutral-500">
                Tier {row.tier ?? 1}
                {row.certified_on ? ` · certified ${formatDate(row.certified_on, true)}` : ''} · {row.time_zone}
              </span>
            </div>
            {row.windows.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">No availability set yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {row.windows.map((w, i) => (
                  <li key={i} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-neutral-300">
                    {DAYS[w.iso_day - 1]} {w.starts} to {w.ends}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
