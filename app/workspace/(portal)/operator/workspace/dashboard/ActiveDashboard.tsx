import Link from 'next/link';
import { Suspense } from 'react';
import { appUrl } from '@/lib/apps';
import { formatDate, formatDateTime, formatTime } from '@/lib/portal/time';
import {
  EOD_STATUS_LABEL,
  formatSpan,
  placementTypeLabel,
  VIEW_AS_BLOCK,
  type CertBanner,
  type DashboardResponse,
  type EodCard,
} from '@/lib/sales-workspace/dashboard';
import { shiftLabel } from '@/lib/sales-workspace/view';
import { brand } from '../WorkspaceFrame';
import { WinsList } from './parts';
import Board from './Board';

export default function ActiveDashboard({ data }: { data: DashboardResponse & { state: 'active'; today: string; placement: NonNullable<DashboardResponse['placement']>; eod: NonNullable<DashboardResponse['eod']>; viewer: NonNullable<DashboardResponse['viewer']> } }) {
  const placement = data.placement;
  const readOnly = data.viewer.view_as;
  return (
    <div className="space-y-4">
      <section className={brand.panel}>
        <p className={brand.eyebrow}>Today · {formatDate(data.today)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className={`${brand.heading} text-2xl sm:text-3xl`}>{placement.client_name ?? 'Client not set'}</h1>
          <span className="rounded-full border border-[#937DFF]/40 bg-[#6A00FF]/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#937DFF]">
            {placementTypeLabel(placement.placement_type)}
          </span>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <Fact label="Manager" value={placement.manager_name ?? 'Not assigned yet'} />
          <Fact label="Shift" value={shiftLabel(placement)} />
          <Fact label="Today's EOD deadline" value={formatDateTime(data.eod.today.deadline_at, placement.time_zone)} />
        </dl>
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-white">Offer</h2>
          <p className="mt-1 text-sm leading-relaxed text-neutral-300">{placement.campaign_summary ?? 'No offer summary yet.'}</p>
        </div>
        <div className="mt-5">
          <WinsList outcomes={placement.outcomes} />
        </div>
      </section>

      <section className={brand.panel} aria-labelledby="eod-heading">
        {data.certification ? <CertNotice cert={data.certification} /> : null}
        <h2 id="eod-heading" className={`${brand.heading} text-lg`}>
          End of day
        </h2>
        {data.eod.yesterday ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Previous working day · {formatDate(data.eod.yesterday.work_date)}</p>
            <EodStatus card={data.eod.yesterday} zone={placement.time_zone} readOnly={readOnly} />
          </div>
        ) : null}
        <div className={data.eod.yesterday ? 'mt-4 border-t border-white/[0.06] pt-4' : 'mt-4'}>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Today</p>
          <EodStatus card={data.eod.today} zone={placement.time_zone} readOnly={readOnly} />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/workspace/operator/workspace/history" className="font-semibold text-[#937DFF]">
            Past EODs
          </Link>
        </p>
      </section>

      <Suspense fallback={<p className="rounded-3xl border border-white/[0.07] px-5 py-8 text-sm text-neutral-400">Loading tasks and numbers.</p>}>
        <Board timeZone={placement.time_zone} />
      </Suspense>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold text-white">{value}</dd>
    </div>
  );
}

function CertNotice({ cert }: { cert: CertBanner }) {
  const date = formatDate(cert.recertify_on, true);
  const through = formatDate(cert.grace_ends_on, true);
  return (
    <div className={`mb-5 rounded-2xl border px-4 py-3 ${brand.warn}`}>
      <p className="text-sm font-semibold text-white">
        {cert.phase === 'grace' ? `Certification date passed on ${date}.` : `Recertify by ${date}.`}
      </p>
      <p className="mt-1 text-sm text-neutral-200">
        {cert.phase === 'grace' ? `You are in the grace period through ${through}.` : 'You are inside the warning window.'}
      </p>
      <a href={appUrl('training')} className="mt-3 inline-flex text-sm font-semibold text-[#937DFF]">
        Open the Academy
      </a>
    </div>
  );
}

function EodStatus({ card, zone, readOnly }: { card: EodCard; zone: string; readOnly: boolean }) {
  const warning = card.status === 'late' || card.status === 'missed';
  const remaining = formatSpan(card.remaining_seconds);
  const late = formatSpan(card.late_seconds);
  return (
    <div className={`mt-2 rounded-2xl border px-4 py-4 ${warning ? brand.warn : 'border-white/[0.06]'}`}>
      <p className={`text-sm font-semibold ${warning ? 'text-[#FFB020]' : 'text-white'}`}>{EOD_STATUS_LABEL[card.status]}</p>
      {card.status === 'not_started' ? <p className="mt-1 text-sm text-neutral-300">{remaining ? `${remaining} until the deadline.` : 'The deadline has passed.'}</p> : null}
      {card.status === 'draft' ? (
        <p className="mt-1 text-sm text-neutral-300">
          Draft saved{card.updated_at ? ` ${formatTime(card.updated_at, zone)}` : ''}.{remaining ? ` ${remaining} until the deadline.` : ' The deadline has passed.'}
        </p>
      ) : null}
      {card.status === 'submitted' ? (
        <p className="mt-1 text-sm text-neutral-300">
          Submitted {card.submitted_at ? formatTime(card.submitted_at, zone) : ''}.
          {card.was_late ? <span className="text-[#FFB020]"> Submitted late.</span> : null}{' '}
          {card.feedback_count > 0 ? `${card.feedback_count} feedback note${card.feedback_count === 1 ? '' : 's'}.` : 'No feedback yet.'}
        </p>
      ) : null}
      {card.status === 'late' ? <p className="mt-1 text-sm">{late ? `${late} late.` : 'Past the deadline.'}</p> : null}
      {card.status === 'missed' ? <p className="mt-1 text-sm">This working day was missed. You can still submit it. It stays marked missed.</p> : null}
      {card.status === 'excused' ? <p className="mt-1 text-sm text-neutral-300">No EOD is due. Reminders are off.</p> : null}
      {card.edited_after_submit ? <p className="mt-1 text-sm text-neutral-300">Edited after submission.</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <EodButton card={card} readOnly={readOnly} />
        {(card.status === 'submitted' || (card.status === 'missed' && card.submitted_at)) && card.id ? (
          <Link href={`/workspace/operator/workspace/history/${card.id}`} className="text-sm font-semibold text-[#937DFF]">
            {card.feedback_count > 0 ? 'Read feedback' : 'View EOD'}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function EodButton({ card, readOnly }: { card: EodCard; readOnly: boolean }) {
  const open = card.status === 'not_started' || card.status === 'draft' || card.status === 'late' || (card.status === 'missed' && !card.submitted_at);
  const editable = card.status === 'submitted' && card.editable;
  const label = card.status === 'draft' ? 'Continue EOD' : card.status === 'late' || card.status === 'missed' ? 'Submit now' : card.status === 'not_started' ? 'Start EOD' : editable ? 'Edit EOD' : null;
  if (!label || (!open && !editable)) return null;
  if (readOnly) return <p className="text-sm text-neutral-300">{VIEW_AS_BLOCK}</p>;
  return (
    <Link href={`/workspace/operator/workspace/eod?day=${card.work_date}`} className={brand.primaryButton}>
      {label}
    </Link>
  );
}
