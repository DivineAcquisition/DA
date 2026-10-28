import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, PageHeader } from '../../components/ui';
import { formatDateTime } from '@/lib/workspace/format';
import {
  leadOfferLabel,
  marketLabel,
  offerLineLabel,
  stageLabel,
  stageTone,
  touchChannelLabel,
  type LeadEvent,
  type OfferLine,
} from '@/lib/workspace/pipeline';
import { getPipelineLead } from '@/lib/workspace/pipeline-queries';
import { LeadActivityForm, LeadUpdateForm } from '../components/LeadForms';

export const metadata: Metadata = { title: 'Lead' };
export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-[var(--ws-dim)]">{label}</dt>
      <dd className="min-w-0 break-words text-right text-neutral-200">{children}</dd>
    </div>
  );
}

function describe(event: LeadEvent, line: OfferLine, names: Map<string, string>): string {
  const person = (id: unknown) =>
    typeof id === 'string' && id ? names.get(id) ?? 'former staff' : 'nobody';
  switch (event.kind) {
    case 'created':
      return event.toStage ? `Lead created at ${stageLabel(event.toStage, line)}` : 'Lead created';
    case 'note':
      return event.body;
    case 'stage':
      return `${event.fromStage ? stageLabel(event.fromStage, line) : 'No stage'} → ${stageLabel(event.toStage ?? '', line)}`;
    case 'owner':
      return `Owner ${person(event.meta.from)} → ${person(event.meta.to)}`;
    case 'touch':
      return `${touchChannelLabel(event.channel ?? 'other')}${event.body ? `: ${event.body}` : ''}`;
    case 'booking': {
      const at = typeof event.meta.scheduled_for === 'string' ? ` for ${formatDateTime(event.meta.scheduled_for)}` : '';
      return `${event.body || 'Call booked'}${at}`;
    }
    default:
      return event.body;
  }
}

const KIND_LABEL: Record<LeadEvent['kind'], string> = {
  created: 'Created',
  stage: 'Stage',
  owner: 'Owner',
  note: 'Note',
  touch: 'Touch',
  booking: 'Booking',
};

const APPLICATION_KEYS: { key: string; label: string }[] = [
  { key: 'niche', label: 'Niche' },
  { key: 'spendBand', label: 'Ad spend band' },
  { key: 'inquiriesPerMonth', label: 'Inquiries per month' },
  { key: 'headlineVariant', label: 'Headline seen' },
  { key: 'source', label: 'Form' },
];

export default async function PipelineLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getPipelineLead(id);
  if (!detail) notFound();

  const { lead, events, sessions, assignees, markets, payload, qualification, notes } = detail;
  const names = new Map(assignees.map((person) => [person.id, person.name]));
  const tracking =
    payload.tracking && typeof payload.tracking === 'object' && !Array.isArray(payload.tracking)
      ? Object.entries(payload.tracking as Record<string, unknown>).filter(([, value]) => typeof value === 'string' && value)
      : [];
  const application = APPLICATION_KEYS.filter(({ key }) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');

  return (
    <div className="space-y-6">
      <Link href="/workspace/pipeline" className="text-sm text-[var(--ws-dim)] hover:text-white">
        ← Pipeline
      </Link>
      <PageHeader
        title={lead.fullName}
        description={[lead.companyName, leadOfferLabel(lead, markets), lead.trade, lead.source].filter(Boolean).join(' · ')}
        actions={<Badge tone={stageTone(lead.stage)}>{stageLabel(lead.stage, lead.offerLine)}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <LeadUpdateForm
            id={lead.id}
            stage={lead.stage}
            ownerId={lead.ownerId}
            nextAction={lead.nextAction}
            offerLine={lead.offerLine}
            market={lead.market}
            assignees={assignees}
            markets={markets}
          />
          <LeadActivityForm id={lead.id} />

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Timeline</h2>
            {events.length === 0 ? (
              <p className="text-sm text-[var(--ws-dim)]">Nothing recorded yet. The lead was added {formatDateTime(lead.createdAt)}.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3 text-sm">
                    <span className="mt-0.5 w-16 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                      {KIND_LABEL[event.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-neutral-200">{describe(event, lead.offerLine, names)}</p>
                      <p className="mt-0.5 text-xs text-[var(--ws-dim)]">
                        {formatDateTime(event.createdAt)} · {event.actorId ? names.get(event.actorId) ?? 'Former staff' : 'System'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-white">Contact</h2>
            <dl className="divide-y divide-white/[0.06]">
              <Row label="Email">{lead.email ? <a href={`mailto:${lead.email}`} className="hover:text-white">{lead.email}</a> : '—'}</Row>
              <Row label="Phone">{lead.phone ? <a href={`tel:${lead.phone}`} className="hover:text-white">{lead.phone}</a> : '—'}</Row>
              <Row label="Company">{lead.companyName || '—'}</Row>
              <Row label="Offer">{offerLineLabel(lead.offerLine)}</Row>
              {lead.offerLine === 'local' && <Row label="Market">{marketLabel(lead.market, markets) || '—'}</Row>}
              {lead.trade && <Row label="Specialty">{lead.trade}</Row>}
              <Row label="Added">{formatDateTime(lead.createdAt)}</Row>
              <Row label="First touch">{lead.firstTouchAt ? formatDateTime(lead.firstTouchAt) : 'Never'}</Row>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold text-white">Calls</h2>
            {lead.offerLine === 'coaching' ? (
              <dl className="divide-y divide-white/[0.06]">
                <Row label="Audit">{formatDateTime(lead.callAt)}</Row>
                <Row label="Meet link">
                  {lead.meetUrl ? (
                    <a href={lead.meetUrl} target="_blank" rel="noreferrer" className="text-brand-200 hover:text-white">
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </Row>
              </dl>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-[var(--ws-dim)]">No call booked through go. yet. Log calls you book by hand as touches.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-200">{formatDateTime(session.scheduledFor)}</span>
                    {session.meetUrl ? (
                      <a href={session.meetUrl} target="_blank" rel="noreferrer" className="text-brand-200 hover:text-white">
                        Meet
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--ws-dim)]">No link</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {lead.offerLine === 'coaching' && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-white">Application</h2>
              <dl className="divide-y divide-white/[0.06]">
                <Row label="Result">{qualification.result ?? '—'}</Row>
                <Row label="Readiness">{qualification.score ?? '—'}</Row>
                <Row label="Coaching niche">{lead.niche || '—'}</Row>
                <Row label="Monthly ad spend">{lead.monthlyAdSpend || '—'}</Row>
                <Row label="Program price">{qualification.programPrice || '—'}</Row>
                <Row label="Follow-up owner">{qualification.followUpOwner || '—'}</Row>
                {application.map(({ key, label }) => (
                  <Row key={key} label={label}>
                    {String(payload[key])}
                  </Row>
                ))}
              </dl>
            </Card>
          )}

          {tracking.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-white">Attribution</h2>
              <dl className="divide-y divide-white/[0.06]">
                {tracking.map(([key, value]) => (
                  <Row key={key} label={key}>
                    {String(value)}
                  </Row>
                ))}
              </dl>
            </Card>
          )}

          {notes && (
            <Card className="p-5">
              <h2 className="mb-2 text-sm font-semibold text-white">Intake notes</h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-300">{notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
