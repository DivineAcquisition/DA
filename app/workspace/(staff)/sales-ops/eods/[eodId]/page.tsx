import Link from 'next/link';
import { notFound } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { formatDate, formatDateTime } from '@/lib/workspace/format';
import { salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '../../../components/ui';
import { ws } from '../../../components/tokens';
import { BlockerTaskForm, EscalateForm, FeedbackForm, ReviewActions, UnlockForm } from '../ReviewPanel';

type StaffEod = {
  id: string;
  work_date: string;
  status: string;
  was_late: boolean;
  needs_help: boolean;
  wins: string | null;
  blockers: string | null;
  plan_items: { text?: string }[] | null;
  note_to_manager: string | null;
  hours_worked: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  edited_after_submit: boolean;
  prior_status: string | null;
  placement_id: string;
  operator_id: string;
  operator_name: string;
  client_name: string;
  feedback: { id: string; parent_id: string | null; author_kind: string; author_name: string; body: string; rating: number | null; created_at: string }[];
  events: { step: string | null; detail: string | null; happened_at: string; from_status: string | null; to_status: string | null }[];
  revisions: { revision: number; edited_at: string }[];
};

export const dynamic = 'force-dynamic';

export default async function StaffEodPage({ params }: { params: Promise<{ eodId: string }> }) {
  const { eodId } = await params;
  const supabase = await createClient();
  const [report, role] = await Promise.all([controlRpc<StaffEod>(supabase, 'so_eod_staff', { p_eod: eodId }), salesOpsRole()]);
  if (!report.data && !report.error) notFound();
  const data = report.data;

  return (
    <>
      <PageHeader
        title={data ? `${data.operator_name} · ${formatDate(data.work_date)}` : 'EOD'}
        description={data ? `${data.client_name}. ${data.status.replaceAll('_', ' ')}${data.was_late ? ', late' : ''}.` : undefined}
        actions={
          <Link href="/workspace/sales-ops/eods" className="text-sm text-[var(--ws-dim)] hover:text-white">
            All EODs
          </Link>
        }
      />
      {report.error || !data ? <p className="text-sm text-amber-200">{report.error ? readable(report.error) : 'This EOD could not load.'}</p> : null}
      {data ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Panel title="Report">
              {data.needs_help ? <p className="text-sm font-semibold text-[#FFB020]">Needs manager help.</p> : null}
              {data.escalated_at ? <p className="text-sm font-semibold text-[#FFB020]">Escalated. {data.escalation_reason}</p> : null}
              {data.edited_after_submit ? <p className="text-sm text-white">Edited after submission. {data.revisions.length} edit{data.revisions.length === 1 ? '' : 's'}.</p> : null}
              {data.prior_status ? <p className="text-sm text-[var(--ws-dim)]">Was {data.prior_status} before it was excused.</p> : null}
              <Block label="Wins" value={data.wins} />
              <Block label="Blockers" value={data.blockers} />
              <Block label="Tomorrow" value={(data.plan_items ?? []).map((item) => item.text).filter(Boolean).join('\n')} />
              {data.hours_worked != null ? <Block label="Hours" value={String(data.hours_worked)} /> : null}
              {data.note_to_manager ? <Block label="Note" value={data.note_to_manager} /> : null}
              {data.submitted_at ? <p className="text-xs text-[var(--ws-dim)]">Submitted {formatDateTime(data.submitted_at)}</p> : null}
            </Panel>
            <Panel title="Feedback">
              {data.feedback.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No feedback yet.</p> : null}
              <ul className="space-y-3">
                {data.feedback.map((note) => (
                  <li key={note.id} className={note.parent_id ? 'ml-4' : ''}>
                    <p className="text-xs uppercase tracking-wide text-brand-300">
                      {note.author_kind} · {note.author_name} · {formatDateTime(note.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-white">{note.body}</p>
                    {note.rating != null ? <p className="text-xs text-[var(--ws-dim)]">Rating {note.rating} of 5</p> : null}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[var(--ws-dim)]">Feedback cannot be edited. Send a correction as a new note. Client feedback arrives with the client report.</p>
              <FeedbackForm eodId={data.id} />
            </Panel>
            <Panel title="History">
              {data.events.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No status changes yet.</p> : null}
              <ul className="space-y-2 text-sm text-[var(--ws-dim)]">
                {data.events.map((event, index) => (
                  <li key={`${event.happened_at}-${index}`}>
                    {formatDateTime(event.happened_at)} · {event.step ?? event.to_status} · {event.detail}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="space-y-6">
            <Panel title="Review">
              <ReviewActions eodId={data.id} reviewed={Boolean(data.reviewed_at)} />
              {data.reviewed_at ? <p className="text-xs text-[var(--ws-dim)]">{formatDateTime(data.reviewed_at)}</p> : null}
            </Panel>
            <Panel title="Escalate">
              <EscalateForm eodId={data.id} />
            </Panel>
            <Panel title="Blocker">
              <BlockerTaskForm
                eodId={data.id}
                operatorId={data.operator_id}
                placementId={data.placement_id}
                blockers={data.blockers ?? ''}
                workDate={data.work_date}
                needsHelp={data.needs_help}
              />
            </Panel>
            {role === 'admin' ? (
              <Panel title="Unlock">
                <p className="text-sm text-[var(--ws-dim)]">DA Admin only. The operator is told, and the reason is in the audit log.</p>
                <UnlockForm eodId={data.id} />
              </Panel>
            ) : null}
            <p className="text-sm">
              <Link href={`/workspace/sales-ops/placements/${data.placement_id}`} className="text-brand-300 hover:underline">
                Operator placement
              </Link>
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${ws.card} space-y-4 p-5`}>
      <h2 className={`${ws.heading} text-base font-semibold`}>{title}</h2>
      {children}
    </section>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--ws-dim)]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-white">{value?.trim() ? value : 'Nothing written.'}</p>
    </div>
  );
}
