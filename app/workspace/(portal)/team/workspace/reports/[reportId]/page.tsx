import type { Metadata } from 'next';
import Link from 'next/link';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { formatValue, paceLabel, reportedLabel, type ClientReport } from '@/lib/sales-reports/client';
import { approveReportAction, holdReportAction, resendReportAction, reviewFeedbackAction } from '@/lib/sales-reports/actions';
import ReportForm from '../ReportForm';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Report' };
export const dynamic = 'force-dynamic';

type Detail = {
  id: string;
  status: string;
  kind: string;
  hold_note: string | null;
  summary: string | null;
  next_focus: string | null;
  win_eod_ids: string[];
  drive_url: string | null;
  sent_at: string | null;
  approval_due_at: string | null;
  client: ClientReport;
  win_choices: { id: string; date: string; text: string }[];
  feedback: { id: string; rating: number; working: string | null; change: string | null; inaccurate: boolean; inaccurate_note: string | null; name: string | null; at: string; reviewed: boolean }[];
  deliveries: { id: string; channel: string; destination: string; status: string; error: string | null }[];
};

export default async function ReportDetailPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Detail>(supabase, 'so_report_get', { p_id: reportId });
  if (error || !data) return <p className="text-sm text-[#FFB020]">{error ? readable(error) : 'Report not found.'}</p>;
  const report = data.client;
  const chosen = new Set(data.win_eod_ids ?? []);
  return (
    <div className="space-y-6">
      <Link href="/workspace/team/workspace/reports" className="text-sm text-neutral-400 hover:text-white">Reports</Link>
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-brand-300">{data.status}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{report.client}</h1>
        <p className="mt-1 text-sm text-neutral-400">{report.operator}, {report.role} · {report.period_start} to {report.period_end}</p>
      </header>
      <section className="rounded-2xl border border-white/10 p-5">
        <h2 className="text-lg font-semibold text-white">What the client will see</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-200">
          {report.headline.map((row) => (
            <li key={row.key}>{row.label}: {formatValue(row.value)}{row.target != null ? ` of ${formatValue(row.target)}` : ''} {paceLabel(row.pace)} {reportedLabel(row.reported)}</li>
          ))}
        </ul>
        {report.gaps.length > 0 ? <ul className="mt-3 text-sm text-neutral-400">{report.gaps.map((gap) => <li key={gap.date}>{gap.date}: {gap.label}</li>)}</ul> : null}
        {report.wins.length > 0 ? <p className="mt-3 text-sm text-neutral-300">Wins: {report.wins.join(' · ')}</p> : null}
        {data.drive_url ? <a className="mt-3 inline-block text-sm text-brand-300" href={data.drive_url}>Drive file</a> : null}
      </section>
      {data.status === 'ready' || data.status === 'held' ? (
        <ReportForm action={approveReportAction} className="space-y-3 rounded-2xl border border-white/10 p-5">
          <input type="hidden" name="report_id" value={data.id} />
          <h2 className="text-lg font-semibold text-white">Approve</h2>
          <label className="block text-sm">Summary<textarea name="summary" required rows={4} defaultValue={data.summary ?? ''} className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2" /></label>
          <label className="block text-sm">Next focus<textarea name="next_focus" required rows={2} defaultValue={data.next_focus ?? ''} className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2" /></label>
          <fieldset className="space-y-2 text-sm">
            <legend>Wins to include</legend>
            {data.win_choices.map((win) => (
              <label key={win.id} className="flex gap-2"><input type="checkbox" name="win" value={win.id} defaultChecked={chosen.size === 0 || chosen.has(win.id)} /><span>{win.date}: {win.text}</span></label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button name="when" value="now" className="rounded-lg bg-[#6A00FF] px-3 py-2 text-sm text-white" type="submit">Approve and send</button>
            <button name="when" value="later" className="rounded-lg bg-white/10 px-3 py-2 text-sm" type="submit">Schedule for the send time</button>
          </div>
        </ReportForm>
      ) : null}
      {data.status === 'ready' || data.status === 'approved' || data.status === 'scheduled' ? (
        <ReportForm action={holdReportAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="report_id" value={data.id} />
          <input name="note" required placeholder="Why this is held" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-white/10 px-3 py-2 text-sm" type="submit">Hold</button>
        </ReportForm>
      ) : null}
      {data.status === 'sent' ? (
        <ReportForm action={resendReportAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="report_id" value={data.id} />
          <input name="emails" placeholder="Leave blank to reuse recipients" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-white/10 px-3 py-2 text-sm" type="submit">Resend</button>
        </ReportForm>
      ) : null}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Client feedback</h2>
        {data.feedback.length === 0 ? <p className="text-sm text-neutral-400">None yet.</p> : null}
        {data.feedback.map((note) => (
          <article key={note.id} className="rounded-xl border border-white/10 p-4 text-sm">
            <p className="font-semibold text-white">Rating {note.rating}{note.inaccurate ? ' · Inaccurate' : ''}</p>
            {note.working ? <p className="mt-2 text-neutral-300">{note.working}</p> : null}
            {note.change ? <p className="mt-2 text-neutral-300">{note.change}</p> : null}
            {note.inaccurate_note ? <p className="mt-2 text-neutral-300">{note.inaccurate_note}</p> : null}
            {!note.reviewed ? (
              <ReportForm action={reviewFeedbackAction} className="mt-3">
                <input type="hidden" name="feedback_id" value={note.id} />
                <button className="text-sm text-brand-300" type="submit">Mark reviewed</button>
              </ReportForm>
            ) : null}
          </article>
        ))}
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">Delivery</h2>
        <ul className="mt-2 space-y-1 text-sm text-neutral-300">
          {data.deliveries.map((item) => (
            <li key={item.id}>{item.channel} · {item.destination} · {item.status}{item.error ? ` · ${item.error}` : ''}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
