import Link from 'next/link';
import { formatMonth } from '@/lib/portal/time';
import type { CommitmentsData } from '@/lib/portal/types';
import { Badge } from '../../components/ui';
import { Card } from './portal';

/** DA goes first: what DA promised, and whether DA delivered. Misses are shown plainly. */
export default function CommitmentsView({ data }: { data: CommitmentsData }) {
  const misses = data.commitments.reduce((sum, c) => sum + c.misses.length, 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">DA&apos;s Commitments</h1>
        <p className="mt-1 text-sm text-neutral-400">
          What DA owes you, measured from the record, for {formatMonth(data.month)}.
          {misses > 0 ? ` DA missed ${misses} ${misses === 1 ? 'time' : 'times'} this month, listed below.` : ' No misses this month.'}
        </p>
      </div>
      {data.commitments.map((c) => (
        <Card key={c.key}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">{c.label}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {c.target}
                {c.target_value !== null && ['pay_on_schedule', 'pay_questions'].includes(c.key) ? `: ${c.target_value}` : ''}
              </p>
            </div>
            {c.total > 0 ? (
              <Badge tone={c.misses.length === 0 ? 'good' : 'neutral'}>
                {c.on_time} of {c.total} on time
              </Badge>
            ) : (
              <Badge tone="neutral">Nothing due yet</Badge>
            )}
          </div>
          {c.detail ? <p className="mt-2 text-xs text-neutral-500">{c.detail}</p> : null}
          {c.misses.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {c.misses.map((miss, i) => (
                <li key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-200">
                  <Link href={miss.link} className="hover:underline">
                    {miss.text}
                  </Link>
                  {c.key === 'escalations' ? (
                    <p className="mt-0.5 text-xs text-neutral-500">Your response-time misses while you waited are left out of your numbers.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
