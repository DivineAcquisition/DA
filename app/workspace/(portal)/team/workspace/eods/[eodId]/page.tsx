import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { formatCount } from '@/lib/sales-workspace/team';
import { loadEod } from '@/lib/sales-workspace/team-data';
import { createClient } from '@/lib/supabase/server';
import { EodPill, When } from '../../components/Bits';
import { BlockerTask, EscalateBox, FeedbackBox, ReviewForm, UnlockBox } from '../../components/EodReview';

export const metadata: Metadata = { title: 'EOD' };
export const dynamic = 'force-dynamic';

export default async function EodDetailPage({ params }: { params: Promise<{ eodId: string }> }) {
  const { eodId } = await params;
  const supabase = await createClient();
  const [{ data, error }, staff] = await Promise.all([
    loadEod(eodId),
    controlRpc<{
      placement_id: string;
      operator_id: string;
      blockers: string | null;
      needs_help: boolean;
      reviewed_at: string | null;
      escalated_at: string | null;
      escalation_reason: string | null;
      work_date: string;
    }>(supabase, 'so_eod_staff', { p_eod: eodId }),
  ]);
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
      <section className="panel space-y-4 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white">Review</h2>
        {staff.data?.needs_help ? <p className="text-sm font-semibold text-flag-warning">Needs manager help.</p> : null}
        {staff.data?.escalated_at ? <p className="text-sm font-semibold text-flag-warning">Escalated. {staff.data.escalation_reason}</p> : null}
        {staff.data ? <ReviewForm eodId={data.id} reviewed={Boolean(staff.data.reviewed_at)} /> : null}
        <FeedbackBox eodId={data.id} />
        <EscalateBox eodId={data.id} />
        {staff.data ? (
          <BlockerTask
            eodId={data.id}
            operatorId={staff.data.operator_id}
            placementId={staff.data.placement_id}
            blockers={data.blockers ?? staff.data.blockers ?? ''}
            workDate={data.work_date}
            needsHelp={Boolean(staff.data.needs_help)}
          />
        ) : null}
        {data.is_admin && staff.data ? (
          <div className="border-t border-white/[0.06] pt-4">
            <h3 className="mb-2 text-sm font-semibold text-white">Unlock</h3>
            <p className="mb-2 text-xs text-neutral-500">DA Admin only. The operator is told, and the reason is in the audit log.</p>
            <UnlockBox eodId={data.id} />
          </div>
        ) : null}
        <p className="text-xs text-neutral-500">Client feedback shows on this report when the client report goes out.</p>
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
