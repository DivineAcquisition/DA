import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
} from '@/app/vistrial/components/ui';
import { readFreshness, orGap } from '@/lib/ingest/rules/freshness';
import {
  INGEST_STATUS_LABELS,
  isQuiet,
  sortByAttention,
  whatToDo,
} from '@/lib/ingest/rules/status';
import {
  getCrossClientRollup,
  getIngestHealth,
  listAuthFailures,
  listCaseFileOptions,
  listEventsNeedingAttention,
  listIngestEndpoints,
  listIngestEventTypes,
  listIngestSources,
} from '@/lib/ingest/queries';
import AdminGate from '../components/AdminGate';
import IngestEventActions from '../components/IngestEventActions';
import {
  DoorActions,
  DrainBacklogButton,
  MapAccountForm,
  RefreshRollupButton,
  RegisterDoorForm,
} from '../components/IngestDoorForms';

export const dynamic = 'force-dynamic';

const PROVIDER_LABELS: Record<string, string> = {
  gohighlevel: 'GoHighLevel',
  payments: 'Payments',
};

const when = (value: string | null) =>
  value ? value.slice(0, 16).replace('T', ' ') : '—';

const money = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default async function IngestionPage() {
  return (
    <AdminGate>
      <Ingestion />
    </AdminGate>
  );
}

async function Ingestion() {
  const [endpoints, health, queue, sources, eventTypes, failures, rollup, caseFiles] =
    await Promise.all([
      listIngestEndpoints(),
      getIngestHealth(),
      listEventsNeedingAttention(),
      listIngestSources(),
      listIngestEventTypes(),
      listAuthFailures(),
      getCrossClientRollup(),
      listCaseFileOptions(),
    ]);

  // Read once per request. This page is force-dynamic, so it renders once.
  const now = new Date().getTime();
  const awaiting = health.reduce((sum, row) => sum + row.awaiting, 0);
  const openDoors = endpoints.filter((endpoint) => endpoint.active);
  const quietDoors = openDoors.filter((endpoint) => isQuiet(endpoint.last_event_at, now));
  const freshness = readFreshness(rollup, now);
  const totals = rollup?.payload?.totals;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Ingestion"
        title="What came through the doors"
        description="Every machine delivery is logged before it is interpreted, so nothing here was lost by failing to be understood. What could not be attributed or handled is queued below rather than dropped."
        actions={
          <>
            <DrainBacklogButton />
            <Link href="/da" className={`${btnSecondary} ${btnSizeSm}`}>
              All engagements
            </Link>
          </>
        }
      />

      <StatGrid columns={4}>
        <StatTile
          label="Needs attention"
          value={String(queue.length)}
          tone={queue.length > 0 ? 'critical' : 'good'}
          hint="Unattributed, unhandled or failed"
        />
        <StatTile
          label="Queued"
          value={String(awaiting)}
          tone={awaiting > 0 ? 'warning' : 'good'}
          hint="Processes within a minute"
        />
        <StatTile label="Doors open" value={String(openDoors.length)} />
        <StatTile
          label="Gone quiet"
          value={String(quietDoors.length)}
          tone={quietDoors.length > 0 ? 'warning' : 'good'}
          hint="Nothing for 24 hours"
        />
      </StatGrid>

      {/* --------------------------------------------------------------------
          The queue. This is the whole reason an unattributable delivery is
          stored rather than discarded, so it leads with what to do about it.
         -------------------------------------------------------------------- */}
      <section>
        <SectionHeader
          title="Waiting on somebody"
          hint="Highest consequence first. The payload is on record in every case, so nothing here needs to be asked for again."
        />
        {queue.length === 0 ? (
          <EmptyState
            title="Everything that arrived was understood"
            detail="No delivery is unattributed, unhandled or failed."
          />
        ) : (
          <ul className="space-y-2.5">
            {sortByAttention(queue).map((event) => (
              <li key={event.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={event.status === 'failed' ? 'critical' : 'warning'}>
                        {INGEST_STATUS_LABELS[event.status]}
                      </Badge>
                      <span className="text-xs text-neutral-300">
                        {PROVIDER_LABELS[event.provider] ?? event.provider}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {event.event_type ?? 'no type in payload'}
                      </span>
                      {event.account_ref && (
                        <span className="text-[11px] text-neutral-600">account {event.account_ref}</span>
                      )}
                    </div>
                    <span className="text-[11px] tabular-nums text-neutral-600">
                      {when(event.received_at)}
                      {event.attempts > 1 && ` · ${event.attempts} attempts`}
                    </span>
                  </div>

                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-200">{whatToDo(event)}</p>

                  {event.error && (
                    <p className="mt-1.5 break-words text-[11px] leading-relaxed text-neutral-500">
                      {event.error}
                    </p>
                  )}

                  <IngestEventActions
                    eventId={event.id}
                    status={event.status}
                    rawBody={event.raw_body}
                    caseFiles={caseFiles}
                  />
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------------------
          A cached figure, shown with its age. Section 5: a cache is a
          performance decision, never a correctness one.
         -------------------------------------------------------------------- */}
      <section>
        <SectionHeader
          title="Across every client"
          hint={
            rollup?.payload
              ? `Trailing ${rollup.payload.window_days} days. Cached, so it is read with its age rather than recomputed on this page load.`
              : 'Cached, and recomputed every ten minutes.'
          }
          actions={<RefreshRollupButton />}
        />

        <Panel
          className={`mb-2.5 px-5 py-3 ${freshness.stale ? 'border-flag-warning/25' : ''}`}
        >
          <p className="flex flex-wrap items-center gap-2 text-xs leading-relaxed text-neutral-400">
            <Badge tone={freshness.stale ? 'warning' : 'good'}>
              {freshness.stale ? 'Stale' : 'Current'}
            </Badge>
            {freshness.label}
            {freshness.failing && rollup?.last_error && (
              <span className="text-flag-critical">{rollup.last_error}</span>
            )}
          </p>
        </Panel>

        {!totals ? (
          <EmptyState
            title="Not computed yet"
            detail="This is different from every figure being zero. The rollup has not run, so it knows nothing — the next scheduled refresh will fill it in."
          />
        ) : (
          <>
            <StatGrid columns={4}>
              <StatTile label="Leads" value={String(totals.leads)} />
              <StatTile label="Bookings credited" value={String(totals.bookings_credited)} />
              <StatTile
                label="Claims pending"
                value={String(totals.claims_pending)}
                tone={totals.claims_pending > 0 ? 'warning' : 'neutral'}
                hint="Counted toward nothing"
              />
              <StatTile
                label="Response inside standard"
                value={orGap(totals.response_compliance, (value) => `${Math.round(value * 100)}%`)}
              />
            </StatGrid>

            <ul className="mt-2.5 space-y-2.5">
              {rollup.payload?.clients.map((client) => (
                <li key={client.case_file_id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/da/${client.slug}`}
                          className="text-sm font-medium text-white transition-colors hover:text-brand-200"
                        >
                          {client.name}
                        </Link>
                        <Badge tone="neutral">{client.status}</Badge>
                        {client.ingest_needs_attention > 0 && (
                          <Badge tone="warning">{client.ingest_needs_attention} to resolve</Badge>
                        )}
                        {isQuiet(client.last_ingest_at, now) && <Badge tone="critical">gone quiet</Badge>}
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-600">
                        last delivery {when(client.last_ingest_at)}
                      </span>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-5">
                      {[
                        { label: 'Leads', value: String(client.leads) },
                        {
                          label: 'Answered',
                          value: `${client.leads_answered}/${client.leads}`,
                        },
                        {
                          label: 'Response',
                          value: orGap(client.avg_response_minutes, (value) => `${value} min`),
                        },
                        { label: 'Credited', value: String(client.bookings_credited) },
                        { label: 'Collected', value: money(client.revenue_collected) },
                      ].map((item) => (
                        <div key={item.label}>
                          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                            {item.label}
                          </dt>
                          <dd className="mt-0.5 tabular-nums text-neutral-200">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </Panel>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* -------------------------------------------------------------------- */}
      <section>
        <SectionHeader
          title="Doors"
          hint="A door authenticates a delivery before its body is parsed. Secrets are shown once and stored as a digest, or in the Vault when the provider signs."
          actions={<RegisterDoorForm caseFiles={caseFiles} />}
        />

        {endpoints.length === 0 ? (
          <EmptyState
            title="No doors open"
            detail="Nothing can arrive from GoHighLevel or the payment processor until one is."
          />
        ) : (
          <ul className="space-y-2.5">
            {endpoints.map((endpoint) => {
              const quiet = endpoint.active && isQuiet(endpoint.last_event_at, now);
              const stats = health.find((row) => row.endpoint_id === endpoint.id);

              return (
                <li key={endpoint.id}>
                  <Panel className={`px-5 py-4 ${quiet ? 'border-flag-warning/25' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={endpoint.active ? 'good' : 'neutral'}>
                          {endpoint.active ? 'open' : 'closed'}
                        </Badge>
                        <span className="text-sm font-medium text-white">{endpoint.label}</span>
                        <span className="text-xs text-neutral-500">
                          {PROVIDER_LABELS[endpoint.provider] ?? endpoint.provider}
                        </span>
                        <Badge tone="neutral">
                          {endpoint.auth_mode === 'hmac_sha256' ? 'signed body' : 'header secret'}
                        </Badge>
                        {endpoint.client_name ? (
                          <span className="text-[11px] text-neutral-600">{endpoint.client_name}</span>
                        ) : (
                          <span className="text-[11px] text-neutral-600">tenant from the payload</span>
                        )}
                        {quiet && <Badge tone="warning">gone quiet</Badge>}
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-600">
                        last delivery {when(endpoint.last_event_at)}
                      </span>
                    </div>

                    <p className="mt-2 break-all font-mono text-[11px] text-neutral-500">
                      /api/webhooks/{endpoint.provider === 'gohighlevel' ? 'ghl' : 'payments'}/{endpoint.key}
                    </p>

                    {stats && (
                      <p className="mt-1.5 text-[11px] text-neutral-600">
                        {stats.events} delivered · {stats.processed} processed
                        {stats.failed > 0 && ` · ${stats.failed} failed`}
                        {stats.unattributed > 0 && ` · ${stats.unattributed} unattributed`}
                        {stats.unknown_type > 0 && ` · ${stats.unknown_type} unhandled`}
                      </p>
                    )}

                    {quiet && (
                      <p className="mt-2 text-[13px] leading-relaxed text-flag-warning">
                        Nothing has arrived for a day. Silence produces no error, so check the workflow is still
                        posting rather than assuming the client went quiet.
                      </p>
                    )}

                    <DoorActions endpointId={endpoint.id} active={endpoint.active} />
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* -------------------------------------------------------------------- */}
      <section>
        <SectionHeader
          title="Sending accounts"
          hint="One account resolves to exactly one client. An account with no mapping stores its events unattributed rather than guessing."
          actions={<MapAccountForm caseFiles={caseFiles} />}
        />

        {sources.length === 0 ? (
          <EmptyState title="No accounts mapped yet" />
        ) : (
          <Panel className="divide-y divide-white/[0.05] px-5">
            {sources.map((source) => (
              <div key={source.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-xs text-neutral-300">{source.account_ref}</span>
                  <span className="text-[11px] text-neutral-600">
                    {PROVIDER_LABELS[source.provider] ?? source.provider}
                  </span>
                  {source.label && <span className="text-[11px] text-neutral-600">{source.label}</span>}
                </span>
                <span className="text-xs text-neutral-400">{source.client_name ?? 'unknown client'}</span>
              </div>
            ))}
          </Panel>
        )}
      </section>

      {/* -------------------------------------------------------------------- */}
      <section>
        <SectionHeader
          title="What the system knows how to handle"
          hint="An event type absent from this list is logged as unhandled and raised, which is usually a workflow added without a handler behind it."
        />
        <Panel className="divide-y divide-white/[0.05] px-5">
          {eventTypes.map((type) => (
            <div
              key={`${type.provider}-${type.event_type}`}
              className="flex flex-wrap items-baseline justify-between gap-3 py-2.5"
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-neutral-300">{type.event_type}</span>
                <span className="text-[11px] text-neutral-600">
                  {PROVIDER_LABELS[type.provider] ?? type.provider}
                </span>
                {type.handler === 'none' && <Badge tone="neutral">inert</Badge>}
              </span>
              <span className="max-w-md text-right text-[11px] leading-relaxed text-neutral-500">
                {type.description}
              </span>
            </div>
          ))}
        </Panel>
      </section>

      {/* --------------------------------------------------------------------
          Refused before the body was read, so deliberately not in the event
          log: an unauthenticated payload is not evidence of anything.
         -------------------------------------------------------------------- */}
      {failures.length > 0 && (
        <section>
          <SectionHeader
            title="Refused at the door"
            hint="These never reached the event log, because nothing was accepted. One is a misconfigured workflow; a run of them is a rotation left half done, or a key being guessed at."
          />
          <Panel className="divide-y divide-white/[0.05] px-5">
            {failures.map((failure) => (
              <div key={failure.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <span className="flex flex-wrap items-baseline gap-2">
                  <Badge tone="critical">{failure.reason}</Badge>
                  <span className="text-[11px] text-neutral-600">
                    {failure.provider ? PROVIDER_LABELS[failure.provider] ?? failure.provider : 'unknown door'}
                  </span>
                  {failure.body_bytes !== null && (
                    <span className="text-[11px] text-neutral-600">{failure.body_bytes} bytes, unread</span>
                  )}
                </span>
                <span className="text-[11px] tabular-nums text-neutral-600">{when(failure.at)}</span>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}
