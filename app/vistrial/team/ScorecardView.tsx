import { formatMonth } from '@/lib/portal/time';
import type { Scorecard } from '@/lib/team/types';
import { Surface } from '@/components/ui/surface';
import { Badge } from '../components/ui';

/** DA's own commitments across every VA in scope. The firm sees its misses first. */
export default function ScorecardView({ data }: { data: Scorecard }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">DA&apos;s scorecard</h1>
        <p className="mt-1 text-sm text-neutral-400">{formatMonth(data.month)}: what DA promised its VAs, and whether DA delivered.</p>
      </div>
      {data.commitments.map((c) => (
        <Surface as="section" key={c.key} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{c.label}</h2>
              <p className="text-xs text-neutral-500">{c.target}</p>
            </div>
            <Badge tone={c.misses.length === 0 ? 'good' : 'warning'}>
              {c.total === 0 ? 'Nothing due' : `${c.rate ?? 0}% on time (${c.on_time} of ${c.total})`}
            </Badge>
          </div>
          {c.misses.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {c.misses.map((m, i) => (
                <li key={i} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-neutral-200">
                  <span className="font-medium">{m.operator_name}:</span> {m.text}
                </li>
              ))}
            </ul>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}
