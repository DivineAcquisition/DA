'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatDay, formatMoney, orGap } from '@/lib/vistrial/format';
import { EOD_CORE_FIELDS } from '@/lib/vistrial/eodCore';
import { PLACEMENT_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { useOps } from '@/lib/vistrial/store';
import type { EodReport } from '@/lib/vistrial/types';
import { AdminOnly } from '../../../components/AppShell';
import {
  Badge,
  DefinitionList,
  EmptyState,
  KeyValue,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  inputClass,
  labelClass,
} from '../../../components/ui';

type LogFilter = 'all' | 'eod' | 'bookings' | 'escalations' | 'notes' | 'evidence';

const PAGE_SIZE = 20;

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'eod', label: 'EOD reports' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'notes', label: 'Admin notes' },
  { id: 'evidence', label: 'Evidence' },
];

export default function CaseFilePage() {
  return (
    <AdminOnly>
      <CaseFile />
    </AdminOnly>
  );
}

function CaseFile() {
  const params = useParams();
  const clientId = params.clientId as string;
  const { gateway, commentOnEod, endPlacementNow } = useOps();

  const [filter, setFilter] = useState<LogFilter>('all');
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const client = gateway.client(clientId);
  if (!client) {
    return <EmptyState title="Case file not found" action={<Link href="/vistrial/admin/clients" className={`${btnSecondary} ${btnSizeSm}`}>Back to case files</Link>} />;
  }

  const placements = gateway.placementsForClient(clientId);
  const live = placements.find((placement) => placement.status === 'active');
  const past = placements.filter((placement) => placement.status !== 'active');
  const reports = placements.flatMap((placement) => gateway.reportsFor(placement.id));
  const bookings = placements.flatMap((placement) => gateway.bookingsFor(placement.id));
  const escalations = placements.flatMap((placement) => gateway.escalationsFor(placement.id));
  const notes = gateway.adminNotesFor(clientId);
  const evidence = gateway.evidenceFor(clientId);
  const scopeRequests = gateway.scopeRequestsFor(clientId);

  const timeline = (() => {
    type Entry = {
      id: string;
      at: string;
      kind: LogFilter;
      label: string;
      title: string;
      body: string;
      report?: EodReport;
    };

    const entries: Entry[] = [];

    for (const report of reports) {
      entries.push({
        id: report.id,
        at: report.submittedAt,
        kind: 'eod',
        label: report.version > 1 ? `EOD · correction v${report.version}` : 'EOD report',
        title: `${gateway.operatorName(report.operatorId)} — shift of ${formatDay(report.shiftDate)}`,
        body: `${report.core.conversationsHandled} conversations, ${report.core.appointmentsBooked} booked, ${report.core.followUpsCompleted} follow-ups.`,
        report,
      });
    }

    for (const booking of bookings) {
      entries.push({
        id: booking.id,
        at: booking.recordedAt,
        kind: 'bookings',
        label:
          booking.state === 'pending-review'
            ? 'Booking claim'
            : booking.state === 'system-only'
              ? 'Booking (GHL only)'
              : booking.state === 'rejected'
                ? 'Booking rejected'
                : 'Booking confirmed',
        title: booking.customerName,
        body: booking.operatorNote ?? `Scheduled for ${formatDateTime(booking.scheduledFor)}.`,
      });
    }

    for (const escalation of escalations) {
      entries.push({
        id: escalation.id,
        at: escalation.raisedAt,
        kind: 'escalations',
        label: `Escalation · ${escalation.status}`,
        title: escalation.needed,
        body: escalation.customerContext,
      });
    }

    for (const note of notes) {
      entries.push({
        id: note.id,
        at: note.createdAt,
        kind: 'notes',
        label: 'Admin note',
        title: note.authorName,
        body: note.body,
      });
    }

    for (const item of evidence) {
      entries.push({
        id: item.id,
        at: item.uploadedAt,
        kind: 'evidence',
        label: `Evidence · ${item.kind}`,
        title: item.label,
        body: `Uploaded by ${item.uploadedBy === 'client' ? 'the client' : 'Divine Acquisition'} · ${item.sizeLabel}`,
      });
    }

    return entries
      .filter((entry) => filter === 'all' || entry.kind === filter)
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  })();

  const config = client.config;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Case file"
        title={client.name}
        description={`${client.vertical} · ${config.industryName} template · onboarded ${formatDay(client.onboardedOn)}`}
        actions={
          live && (
            <button
              type="button"
              onClick={() => endPlacementNow(live.id)}
              className={`${btnSecondary} ${btnSizeSm}`}
            >
              End placement
            </button>
          )
        }
      />

      <StatGrid>
        <StatTile label="EOD reports" value={String(reports.length)} hint="Every version retained" />
        <StatTile label="Bookings" value={String(bookings.length)} hint={`${bookings.filter((b) => b.state === 'pending-review').length} awaiting review`} />
        <StatTile label="Escalations" value={String(escalations.length)} hint={`${escalations.filter((e) => e.status === 'open').length} open`} />
        <StatTile label="Placements" value={String(placements.length)} hint={`${past.length} closed`} />
      </StatGrid>

      {/* Configuration */}
      <section>
        <SectionHeader
          title="Configuration"
          hint="The template and the qualified-booking definition are the client's own. The operating window and the commercial terms belong to the live placement, so a client without one shows a gap rather than a default."
        />
        <Panel className="px-5 py-2">
          <DefinitionList>
            <KeyValue label="Industry template">{config.industryName}</KeyValue>
            <KeyValue label="Shift window">
              {config.shiftStart && config.shiftEnd
                ? `${config.shiftStart} – ${config.shiftEnd}${config.timeZone ? ` ${config.timeZone}` : ''}`
                : 'No live placement'}
            </KeyValue>
            <KeyValue label="Monthly booking quota">
              {orGap(config.monthlyBookingQuota, (quota) => `${quota} confirmed bookings`)}
            </KeyValue>
            <KeyValue label="Commission rate">
              {orGap(
                config.commissionPerBooking,
                (rate) => `${formatMoney(rate)} per confirmed booking above quota`,
              )}
            </KeyValue>
            <KeyValue label="Response standard">
              {orGap(config.responseStandardMinutes, (minutes) => `Inside ${minutes} minutes`)}
            </KeyValue>
            <KeyValue label="Escalation window">
              {orGap(config.escalationResponseHours, (hours) => `${hours} hours`)}
            </KeyValue>
            <KeyValue label="Client escalation contact">
              {config.escalationContact
                ? [
                    config.escalationContact.name,
                    config.escalationContact.role && `(${config.escalationContact.role})`,
                    config.escalationContact.channel && `via ${config.escalationContact.channel}`,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : 'None recorded'}
            </KeyValue>
            <KeyValue label="Qualified booking">
              {config.qualifiedBookingDefinition ?? 'Not defined for this client yet'}
            </KeyValue>
          </DefinitionList>
        </Panel>
      </section>

      {/* EOD form shape */}
      <section>
        <SectionHeader
          title="EOD form shape"
          hint="Locked core, then the configured block for this client."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Core</h3>
              <Badge tone="neutral">Locked</Badge>
            </div>
            <ul className="space-y-1.5">
              {EOD_CORE_FIELDS.map((field) => (
                <li key={field.key} className="flex items-center justify-between text-[13px]">
                  <span className="text-neutral-300">{field.label}</span>
                  <span className="text-[11px] text-neutral-600">{field.type}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-neutral-500">
              Identical for every client and industry. Comparability across operators depends on it, so
              these are never removed or renamed.
            </p>
          </Panel>

          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Configured block</h3>
              <Badge tone="brand">Per client</Badge>
            </div>
            {config.configuredFields.length === 0 ? (
              <p className="text-[13px] text-neutral-500">
                Core only. No industry fields configured for this client yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {config.configuredFields.map((field) => (
                  <li key={field.key} className="flex items-start justify-between gap-3 text-[13px]">
                    <span className="text-neutral-300">
                      {field.label}
                      {field.required && <span className="ml-1 text-brand-400">*</span>}
                      {field.help && <span className="mt-0.5 block text-[11px] text-neutral-600">{field.help}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-600">{field.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      {/* Placements */}
      <section>
        <SectionHeader title="Placements" hint="Everything logged attaches to one of these, never to the client directly." />
        <ul className="space-y-2.5">
          {[...(live ? [live] : []), ...past].map((placement) => {
            const status = gateway.statusOf(placement);
            return (
              <li key={placement.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vistrial/admin/operators/${placement.operatorId}`}
                          className="text-sm font-semibold text-white hover:text-brand-200"
                        >
                          {gateway.operatorName(placement.operatorId)}
                        </Link>
                        <Badge
                          tone={
                            status === 'active'
                              ? 'good'
                              : status === 'expiring'
                                ? 'warning'
                                : status === 'renewed'
                                  ? 'brand'
                                  : 'neutral'
                          }
                        >
                          {PLACEMENT_STATUS_LABELS[status]}
                        </Badge>
                        {placement.renewedFromId && <Badge tone="neutral">Renewal</Badge>}
                      </div>
                      <p className="mt-1.5 text-xs text-neutral-500">
                        {formatDay(placement.startDate)} – {formatDay(placement.closedOn ?? placement.endDate)} ·{' '}
                        {placement.termMonths}-month term · quota {placement.monthlyBookingQuota}/mo
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-neutral-500">
                      {gateway.reportsFor(placement.id).length} reports ·{' '}
                      {gateway.confirmedFor(placement.id).length} confirmed bookings
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Scope requests */}
      {scopeRequests.length > 0 && (
        <section>
          <SectionHeader title="Scope requests" />
          <ul className="space-y-2.5">
            {scopeRequests.map((request) => (
              <li key={request.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{request.summary}</p>
                    <Badge
                      tone={request.status === 'open' ? 'warning' : request.status === 'approved' ? 'good' : 'neutral'}
                    >
                      {request.status}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{request.detail}</p>
                  <p className="mt-2 text-xs text-neutral-600">
                    Raised by {request.requestedBy} · {formatDateTime(request.createdAt)}
                  </p>
                  {request.resolution && (
                    <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs leading-relaxed text-neutral-400">
                      {request.resolution}
                    </p>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Log timeline */}
      <section>
        <SectionHeader
          title="Log"
          hint="Reverse chronological, filterable by type."
          actions={
            <div className="flex gap-1 overflow-x-auto">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setFilter(option.id);
                    setVisible(PAGE_SIZE);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    filter === option.id
                      ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                      : 'text-neutral-500 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        {timeline.length === 0 ? (
          <EmptyState title="Nothing logged of this type yet" />
        ) : (
          <ol className="space-y-2.5">
            {timeline.slice(0, visible).map((entry) => (
              <li key={entry.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      tone={
                        entry.label.includes('claim')
                          ? 'warning'
                          : entry.label.includes('rejected')
                            ? 'critical'
                            : entry.label.startsWith('EOD')
                              ? 'brand'
                              : 'neutral'
                      }
                    >
                      {entry.label}
                    </Badge>
                    <span className="text-[11px] tabular-nums text-neutral-600">{formatDateTime(entry.at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{entry.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{entry.body}</p>

                  {entry.report && (
                    <ReportDetail
                      report={entry.report}
                      open={openReport === entry.report.id}
                      onToggle={() =>
                        setOpenReport((current) => (current === entry.report!.id ? null : entry.report!.id))
                      }
                      comment={comment}
                      setComment={setComment}
                      onComment={() => {
                        if (!comment.trim()) return;
                        commentOnEod(entry.report!.id, comment.trim());
                        setComment('');
                      }}
                    />
                  )}
                </Panel>
              </li>
            ))}
          </ol>
        )}

        {timeline.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className={`${btnSecondary} ${btnSizeSm} mt-3 w-full`}
          >
            Show {Math.min(PAGE_SIZE, timeline.length - visible)} more of {timeline.length}
          </button>
        )}
      </section>
    </div>
  );
}

function ReportDetail({
  report,
  open,
  onToggle,
  comment,
  setComment,
  onComment,
}: {
  report: EodReport;
  open: boolean;
  onToggle: () => void;
  comment: string;
  setComment: (value: string) => void;
  onComment: () => void;
}) {
  const { gateway } = useOps();
  const versions = gateway.reportVersions(report.placementId, report.shiftDate);
  const client = gateway.client(gateway.placement(report.placementId)!.clientId)!;

  return (
    <div className="mt-3 border-t border-white/[0.06] pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-semibold text-brand-300 transition-colors hover:text-brand-200"
      >
        {open ? 'Hide report' : 'Open report'}
        {versions.length > 1 && ` · ${versions.length} versions`}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {report.correctionReason && (
            <p className="rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-brand-100">
              Correction reason: {report.correctionReason}
            </p>
          )}

          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {EOD_CORE_FIELDS.map((field) => {
              const value = report.core[field.key as keyof typeof report.core];
              return (
                <div key={field.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-neutral-500">{field.label}</span>
                  <span className="text-right text-neutral-200">
                    {value === '' || value === null ? '—' : String(value)}
                  </span>
                </div>
              );
            })}
          </div>

          {client.config.configuredFields.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                {client.name} fields
              </p>
              <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {client.config.configuredFields.map((field) => (
                  <div key={field.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-neutral-500">{field.label}</span>
                    <span className="text-right text-neutral-200">
                      {String(report.configured[field.key] ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {versions.length > 1 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                Version history
              </p>
              <ul className="space-y-1">
                {versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between text-xs">
                    <span className={version.supersededById ? 'text-neutral-600 line-through' : 'text-neutral-300'}>
                      v{version.version} · {formatDateTime(version.submittedAt)}
                    </span>
                    <span className="text-neutral-600">
                      {version.supersededById ? 'superseded' : 'in force'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
                Submitted reports are immutable. Both versions stay on file, which is what makes the case
                file usable as evidence.
              </p>
            </div>
          )}

          {report.adminComments.length > 0 && (
            <ul className="space-y-2">
              {report.adminComments.map((entry) => (
                <li key={entry.id} className="rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-white">{entry.authorName}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{entry.body}</p>
                  <p className="mt-1 text-[11px] text-neutral-600">{formatDateTime(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label className={labelClass} htmlFor={`comment-${report.id}`}>
              Comment for the operator
            </label>
            <textarea
              id={`comment-${report.id}`}
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="They will see this on their shift surface."
            />
            <button type="button" onClick={onComment} className={`${btnPrimary} ${btnSizeSm} mt-2`}>
              Post comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
