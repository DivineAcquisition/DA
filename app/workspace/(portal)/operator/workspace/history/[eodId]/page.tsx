import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { formatDate, formatDateTime } from '@/lib/portal/time';
import { EOD_STATUS_LABEL, formatMetric, type EodDetail, type EodNumber } from '@/lib/sales-workspace/dashboard';
import { createClient } from '@/lib/supabase/server';
import { brand } from '../../WorkspaceFrame';
import { WorkspaceShell } from '../../shell';
import ReplyForm from '../ReplyForm';

export const metadata: Metadata = { title: 'EOD' };
export const dynamic = 'force-dynamic';

export default async function EodDetailPage({ params }: { params: Promise<{ eodId: string }> }) {
  const { eodId } = await params;
  const supabase = await createClient();
  const [report, session] = await Promise.all([
    controlRpc<EodDetail>(supabase, 'so_eod_read', { p_eod_id: eodId }),
    controlRpc<{ time_zone: string | null }>(supabase, 'so_session'),
  ]);
  const { data, error } = report;
  const zone = session.data?.time_zone ?? 'America/New_York';
  if (!data && !error) notFound();

  return (
    <WorkspaceShell>
      <Link href="/workspace/operator/workspace/history" className="text-sm text-neutral-400 hover:text-white">
        Past EODs
      </Link>
      {error || !data ? (
        <p className="mt-6 text-sm text-[#FFB020]">{error ? readable(error) : 'This EOD could not load.'}</p>
      ) : (
        <article className="mt-4 space-y-4">
          <header>
            <p className={brand.eyebrow}>{formatDate(data.work_date, true)}</p>
            <h1 className={`${brand.heading} mt-2 text-2xl`}>
              {EOD_STATUS_LABEL[data.status] ?? data.status}
              {data.was_late ? ' · Late' : ''}
              {data.edited_after_submit ? ' · Edited after submission' : ''}
            </h1>
            {data.submitted_at ? <p className="mt-2 text-sm text-neutral-400">Submitted {formatDateTime(data.submitted_at, zone)}</p> : null}
          </header>
          <Narrative label="Wins" value={data.wins} />
          <Narrative label="Blockers" value={data.blockers} />
          <Narrative label="Tomorrow" value={data.tomorrow_plan} />
          {data.hours_worked != null ? <Narrative label="Hours worked" value={String(data.hours_worked)} /> : null}
          {data.note_to_manager ? <Narrative label="Note to manager" value={data.note_to_manager} /> : null}
          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Numbers</h2>
            <NumberGroups rows={data.numbers} />
          </section>
          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Feedback</h2>
            {data.feedback.length === 0 ? <p className="mt-3 text-sm text-neutral-400">No feedback yet.</p> : null}
            <ul className="mt-3 space-y-3">
              {data.feedback.map((note) => (
                <li key={note.id} className={`rounded-2xl border border-white/[0.06] px-4 py-3 ${note.parent_id ? 'ml-4' : ''}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#937DFF]">
                    {note.author_kind === 'admin' ? 'DA Admin' : note.author_kind === 'client' ? 'Client' : note.author_kind === 'operator' ? 'You' : 'Manager'} · {note.author_name}
                    {' · '}
                    {formatDateTime(note.created_at, zone)}
                  </p>
                  <p className="mt-2 text-sm text-neutral-200">{note.body}</p>
                  {note.rating != null ? <p className="mt-1 text-xs text-neutral-500">Rating {note.rating} of 5</p> : null}
                  {note.author_kind === 'manager' || note.author_kind === 'admin' ? (
                    <ReplyForm eodId={data.id} parentId={note.id} readOnly={Boolean(data.view_as)} />
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section className={brand.panel}>
            <h2 className={`${brand.heading} text-lg`}>Client feedback</h2>
            <p className="mt-2 text-sm text-neutral-400">Client feedback shows here when the client report goes out. Nothing to answer yet.</p>
          </section>
        </article>
      )}
    </WorkspaceShell>
  );
}

function Narrative({ label, value }: { label: string; value: string | null }) {
  return (
    <section className={brand.panel}>
      <h2 className="text-sm font-semibold text-white">{label}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">{value?.trim() ? value : 'Nothing written.'}</p>
    </section>
  );
}

function NumberGroups({ rows }: { rows: EodNumber[] }) {
  const groups: { group: string; rows: EodNumber[] }[] = [];
  for (const row of rows) {
    const existing = groups.find((group) => group.group === row.group);
    if (existing) existing.rows.push(row);
    else groups.push({ group: row.group, rows: [row] });
  }
  if (groups.length === 0) return <p className="mt-3 text-sm text-neutral-400">No numbers for this day.</p>;
  return (
    <div className="mt-3 space-y-4">
      {groups.map((group) => (
        <div key={group.group}>
          <h3 className={brand.eyebrow}>{group.group}</h3>
          <ul className="mt-2">
            {group.rows.map((row) => (
              <li key={`${group.group}-${row.label}`} className="flex items-center justify-between gap-3 border-t border-white/[0.06] py-2 text-sm">
                <span className="text-neutral-300">{row.label}</span>
                <span className="font-semibold text-white">{row.display === 'pending_sync' ? 'Pending sync' : formatMetric(row.unit, row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
