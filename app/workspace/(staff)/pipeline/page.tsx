import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, Inbox, PhoneCall } from 'lucide-react';
import { bookingSummary, INQUIRY_LABEL, leadName, STAGE_LABEL, stageTone, type PipelineRow } from '@/lib/pipeline/desk';
import { loadPipeline, type PipelineView } from '@/lib/pipeline/data';
import { DeskHeader, Empty, Pill, Problem, Stat, when } from '../components/desk';

export const metadata: Metadata = { title: 'Pipeline' };
export const dynamic = 'force-dynamic';

const VIEWS: Array<[PipelineView, string]> = [
  ['open', 'Open'],
  ['closed', 'Closed'],
  ['all', 'All'],
];

function counts(rows: PipelineRow[]) {
  const booked = rows.filter((row) => row.booking && ['booked', 'rescheduled'].includes(row.booking.status)).length;
  const notBooked = rows.filter((row) => row.stage === 'Qualified - Not Booked' && !row.booking).length;
  const review = rows.filter((row) => row.stage === 'Manual Review').length;
  return { booked, notBooked, review };
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const query = await searchParams;
  const view: PipelineView = query.view === 'closed' || query.view === 'all' ? query.view : 'open';
  const { data, error } = await loadPipeline(view);

  return (
    <div>
      <DeskHeader
        title="Pipeline"
        description="Every inquiry from the site and the acquisition forms, as it arrives. Booking status comes from the calendar. Open a lead to log the discovery call."
      />
      <nav aria-label="Pipeline view" className="mb-5 flex gap-1 text-sm">
        {VIEWS.map(([value, label]) => (
          <Link
            key={value}
            href={value === 'open' ? '/workspace/pipeline' : `/workspace/pipeline?view=${value}`}
            aria-current={view === value ? 'page' : undefined}
            className={`rounded-lg px-3 py-1.5 ${view === value ? 'bg-brand-500/20 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {error || !data ? (
        <Problem>{error ?? 'The pipeline did not load.'}</Problem>
      ) : data.length === 0 ? (
        <Empty>{view === 'open' ? 'No open leads. New inquiries show here the moment they are submitted.' : 'Nothing here yet.'}</Empty>
      ) : (
        <>
          {view === 'open' ? (
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Open leads" value={data.length} />
              <Stat label="Call booked" value={counts(data).booked} />
              <Stat label="Not booked yet" value={counts(data).notBooked} />
              <Stat label="Needs review" value={counts(data).review} />
            </div>
          ) : null}
          <ul className="panel divide-y divide-white/[0.06] overflow-hidden rounded-2xl">
            {data.map((row) => {
              const booking = bookingSummary(row.booking);
              return (
                <li key={row.id}>
                  <Link
                    href={`/workspace/pipeline/${row.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-medium text-white">{leadName(row)}</p>
                      <p className="truncate text-[13px] text-neutral-500">
                        {[row.full_name && row.company ? row.company : null, row.source].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={stageTone(row.stage)}>{STAGE_LABEL[row.stage] ?? row.stage}</Pill>
                      <span className="inline-flex items-center gap-1.5 text-[13px] text-neutral-300">
                        <CalendarCheck className="size-3.5 text-neutral-500" aria-hidden />
                        {booking.label}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-4 text-[12px] text-neutral-500 sm:w-auto">
                      {row.last_inquiry ? (
                        <span className="inline-flex items-center gap-1">
                          <Inbox className="size-3.5" aria-hidden />
                          {INQUIRY_LABEL[row.last_inquiry.kind] ?? 'Inquiry'}
                        </span>
                      ) : null}
                      {row.calls ? (
                        <span className="inline-flex items-center gap-1">
                          <PhoneCall className="size-3.5" aria-hidden />
                          {row.calls}
                        </span>
                      ) : null}
                      <span className="tabular-nums">{when(row.last_activity)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
