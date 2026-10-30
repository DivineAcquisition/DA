import type { Metadata } from 'next';
import { controlRpc } from '@/lib/ad/rpc';
import { asClientReport, formatValue, paceLabel, periodLabel, reportedLabel, type ClientReport } from '@/lib/sales-reports/client';
import { createClient } from '@/lib/supabase/server';
import { leaveFeedback } from './leave';

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };
export const dynamic = 'force-dynamic';

type Open = { state: string; reply_to?: string | null; suggested_name?: string | null; report?: unknown };

export default async function ClientReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ thanks?: string; error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<Open>(supabase, 'so_report_open', { p_token: token });
  const opened = (data ?? { state: 'expired' }) as Open;
  if (opened.state !== 'ok' || !opened.report) {
    return <Closed replyTo={opened.reply_to} />;
  }
  const report = asClientReport(opened.report);
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="text-xs font-semibold tracking-[0.16em] text-[#6A00FF]">DIVINE ACQUISITION</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight" style={{ fontFamily: 'var(--font-report), sans-serif' }}>{report.client}</h1>
      <p className="mt-2 text-sm text-[#5c5670]">{report.operator}, {report.role} · {periodLabel(report)}</p>
      <p className="text-sm text-[#5c5670]">{report.manager}</p>
      <ReportBody report={report} />
      {query.thanks ? (
        <p className="mt-8 rounded-2xl bg-white p-5 text-sm">Thank you. That note is with the team. You can add another below until this link closes.</p>
      ) : null}
      {query.error ? <p className="mt-6 text-sm text-[#9b1c1c]">{query.error}</p> : null}
      <form action={leaveFeedback} className="mt-8 space-y-4 rounded-2xl bg-white p-5">
        <input type="hidden" name="token" value={token} />
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Leave feedback</h2>
        <label className="block text-sm">
          Overall rating
          <select name="rating" required className="mt-1 w-full rounded-lg border border-[#e4dff0] px-3 py-3 text-base" defaultValue="">
            <option value="" disabled>Choose 1 to 5</option>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="block text-sm">What&apos;s working?<textarea name="working" rows={3} className="mt-1 w-full rounded-lg border border-[#e4dff0] px-3 py-3 text-base" /></label>
        <label className="block text-sm">What should we change?<textarea name="change" rows={3} className="mt-1 w-full rounded-lg border border-[#e4dff0] px-3 py-3 text-base" /></label>
        <fieldset className="text-sm">
          <legend>Is anything in this report inaccurate?</legend>
          <label className="mr-4 mt-2 inline-flex items-center gap-2"><input type="radio" name="inaccurate" value="no" defaultChecked /> No</label>
          <label className="inline-flex items-center gap-2"><input type="radio" name="inaccurate" value="yes" /> Yes</label>
        </fieldset>
        <label className="block text-sm">If yes, what looks wrong?<textarea name="note" rows={3} className="mt-1 w-full rounded-lg border border-[#e4dff0] px-3 py-3 text-base" /></label>
        <label className="block text-sm">Your name<textarea name="name" rows={1} defaultValue={opened.suggested_name ?? ''} className="mt-1 w-full rounded-lg border border-[#e4dff0] px-3 py-3 text-base" /></label>
        <button type="submit" className="w-full rounded-xl bg-[#6A00FF] px-4 py-3 text-base font-semibold text-white">Send feedback</button>
      </form>
      <p className="mt-8 text-xs text-[#8a8498]">Devotion. Value. Exclusivity.</p>
    </main>
  );
}

function ReportBody({ report }: { report: ClientReport }) {
  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl bg-white p-5">
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Headline</h2>
        <ul className="mt-3 space-y-3">
          {report.headline.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="text-right font-semibold">
                {formatValue(row.value)}
                {row.target != null ? <span className="font-normal text-[#5c5670]"> / {formatValue(row.target)}</span> : null}
                {paceLabel(row.pace) ? <span className="mt-1 block text-xs font-normal text-[#6A00FF]">{paceLabel(row.pace)}</span> : null}
                {reportedLabel(row.reported) ? <span className="mt-1 block text-xs font-normal text-[#5c5670]">Operator reported</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {report.summary ? <section className="rounded-2xl bg-white p-5 text-sm leading-6"><h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Summary</h2><p className="mt-2">{report.summary}</p>{report.next_focus ? <p className="mt-3 text-[#5c5670]">Next focus: {report.next_focus}</p> : null}</section> : null}
      {report.outcomes.length > 0 ? (
        <section className="rounded-2xl bg-white p-5 text-sm">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Positive outcomes</h2>
          <ul className="mt-3 space-y-2">{report.outcomes.map((row) => <li key={row.name} className="flex justify-between gap-3"><span>{row.name}</span><span className="font-semibold">{formatValue(row.value)}{row.previous != null ? <span className="font-normal text-[#5c5670]"> · was {formatValue(row.previous)}</span> : null}</span></li>)}</ul>
        </section>
      ) : null}
      {report.wins.length > 0 ? <section className="rounded-2xl bg-white p-5 text-sm"><h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Wins</h2><ul className="mt-2 list-disc space-y-2 pl-5">{report.wins.map((win) => <li key={win}>{win}</li>)}</ul></section> : null}
      {report.gaps.length > 0 ? <section className="rounded-2xl bg-white p-5 text-sm"><h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>Days</h2><ul className="mt-2 space-y-1">{report.gaps.map((gap) => <li key={gap.date}>{gap.date}: {gap.label}</li>)}</ul></section> : null}
    </div>
  );
}

function Closed({ replyTo }: { replyTo?: string | null }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs font-semibold tracking-[0.16em] text-[#6A00FF]">DIVINE ACQUISITION</p>
      <h1 className="mt-3 text-3xl font-semibold" style={{ fontFamily: 'var(--font-report), sans-serif' }}>This link is closed</h1>
      <p className="mt-3 text-sm leading-6 text-[#5c5670]">The report link has expired or been revoked. Reply to this address and the team will help.</p>
      {replyTo ? <p className="mt-4 text-sm font-semibold"><a className="text-[#6A00FF]" href={`mailto:${replyTo}`}>{replyTo}</a></p> : null}
    </main>
  );
}
