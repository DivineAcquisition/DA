import type { Metadata } from 'next';
import Link from 'next/link';
import { loadActivity, loadOperators } from '@/lib/sales-workspace/team-data';
import { When, ZoneInput } from '../components/Bits';

export const metadata: Metadata = { title: 'Activity log' };
export const dynamic = 'force-dynamic';

const TYPES = [
  ['quick_log', 'Quick log'],
  ['task', 'Task'],
  ['alert', 'Alert'],
  ['eod', 'EOD'],
  ['placement', 'Placement'],
  ['target', 'Target'],
  ['role', 'Role'],
  ['view_as', 'View as'],
  ['sign_in', 'Sign-in'],
  ['settings', 'Settings'],
];

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string; operator?: string; actor?: string; zone?: string }>;
}) {
  const query = await searchParams;
  const [loaded, roster] = await Promise.all([
    loadActivity({
      type: query.type,
      from: query.from,
      to: query.to,
      operatorId: query.operator,
      actorName: query.actor,
      zone: query.zone,
    }),
    loadOperators(),
  ]);
  const { data, error } = loaded;
  const operators = roster.data?.operators ?? [];
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'The log did not load.'}</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Activity log</h1>
        <p className="mt-1 text-sm text-neutral-400">Newest first. Read-only. Nothing on this page can be edited or deleted.</p>
      </div>
      <form className="flex flex-wrap gap-2" method="get">
        <ZoneInput current={query.zone} />
        <select name="operator" defaultValue={query.operator ?? ''} aria-label="Operator" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Operator</option>
          {operators.map((row) => (
            <option key={row.operator_id} value={row.operator_id}>
              {row.name}
            </option>
          ))}
        </select>
        <input name="actor" defaultValue={query.actor ?? ''} placeholder="Person who acted" aria-label="Person who acted" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <select name="type" defaultValue={query.type ?? ''} aria-label="Type" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm">
          <option value="">Type</option>
          {TYPES.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={query.from ?? ''} aria-label="From" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <input type="date" name="to" defaultValue={query.to ?? ''} aria-label="To" className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm" />
        <button type="submit" className="h-9 rounded-lg bg-white/10 px-3 text-sm text-white">
          Filter
        </button>
      </form>
      {data.events.length === 0 ? (
        <p className="panel rounded-2xl px-6 py-10 text-center text-sm text-neutral-400">No events match.</p>
      ) : (
        <ol className="space-y-2">
          {data.events.map((event) => (
            <li key={event.id} className="panel rounded-2xl px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-white">{event.summary}</p>
                <When iso={event.at} />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {labelFor(event.type)}
                {event.actor_name ? ` · ${event.actor_name}` : ''}
                {event.operator_name ? (
                  <>
                    {' · '}
                    <Link href={`/workspace/team/workspace/operators/${event.operator_id}`} className="text-neutral-300">
                      {event.operator_name}
                    </Link>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function labelFor(type: string): string {
  return TYPES.find(([id]) => id === type)?.[1] ?? type;
}
