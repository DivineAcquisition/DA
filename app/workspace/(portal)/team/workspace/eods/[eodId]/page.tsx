import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCount } from '@/lib/sales-workspace/team';
import { loadEod } from '@/lib/sales-workspace/team-data';
import { EodPill, When } from '../../components/Bits';

export const metadata: Metadata = { title: 'EOD' };
export const dynamic = 'force-dynamic';

export default async function EodDetailPage({ params }: { params: Promise<{ eodId: string }> }) {
  const { eodId } = await params;
  const { data, error } = await loadEod(eodId);
  if (error?.includes('not on file')) notFound();
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'This EOD did not load.'}</p>;
  }
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs text-neutral-500">
          <Link href={`/workspace/team/workspace/operators/${data.operator_id}`} className="text-neutral-300">
            {data.operator_name}
          </Link>{' '}
          · {data.client_name}
          {data.manager_name ? ` · ${data.manager_name}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{data.work_date}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
          <EodPill status={data.status} wasLate={data.was_late} />
          <span>
            Deadline <When iso={data.deadline_at} operatorZone={data.time_zone} />
          </span>
          {data.submitted_at ? (
            <span>
              Submitted <When iso={data.submitted_at} operatorZone={data.time_zone} />
            </span>
          ) : null}
        </div>
      </header>
      <section className="panel space-y-3 rounded-2xl p-5 text-sm">
        <Block label="Wins" text={data.wins} />
        <Block label="Blockers" text={data.blockers} />
        <Block label="Tomorrow" text={data.tomorrow_plan} />
        {data.hours_worked != null ? <Block label="Hours" text={String(data.hours_worked)} /> : null}
        {data.note_to_manager ? <Block label="Note to manager" text={data.note_to_manager} /> : null}
      </section>
      <section className="panel rounded-2xl p-5">
        <h2 className="mb-3 text-base font-semibold text-white">Numbers</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-neutral-500">
            <tr>
              <th className="pb-2 font-medium">Metric</th>
              <th className="pb-2 font-medium">Logged</th>
              {data.is_admin ? <th className="pb-2 font-medium">GHL</th> : null}
            </tr>
          </thead>
          <tbody>
            {data.numbers.map((metric) => (
              <tr key={metric.key} className="border-t border-white/[0.06]">
                <td className="py-2 text-white">{metric.label}</td>
                <td className="py-2 tabular-nums">{formatCount(metric.operator)}</td>
                {data.is_admin ? <td className="py-2 text-neutral-300">{metric.ghl == null ? 'Pending sync' : formatCount(metric.ghl)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel rounded-2xl p-5">
        <h2 className="mb-3 text-base font-semibold text-white">Feedback</h2>
        {data.feedback.length === 0 ? (
          <p className="text-sm text-neutral-500">No feedback yet.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {data.feedback.map((item) => (
              <li key={item.id}>
                <p className="text-white">{item.body}</p>
                <p className="text-xs text-neutral-500">
                  {item.author_name ?? item.author_kind} · <When iso={item.created_at} />
                  {item.rating ? ` · ${item.rating}/5` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border border-dashed border-white/15 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Review</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Leaving feedback, review actions, and the client feedback link land here in the next prompts. This report stays read-only until then.
        </p>
      </section>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-white">{text?.trim() ? text : '—'}</p>
    </div>
  );
}
