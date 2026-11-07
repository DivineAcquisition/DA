import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OfferBriefView } from '@/app/components/placement/OfferBrief';
import { controlRpc, readable } from '@/lib/ad/rpc';
import type { CheckItem } from '@/lib/placement/types';

type LaunchStatus = {
  summary_enabled: boolean;
  summary_days: number;
  combine_short_week: boolean;
  review_due: boolean;
  review: { decision: string; note: string; at: string } | null;
  health: { overall: string; ran_at: string; results: { key: string; area: string; result: string; reason: string; admin_only?: boolean }[] } | null;
};
import type { OfferBrief } from '@/lib/placement/offer';
import { ACTIVITY_CATEGORIES } from '@/lib/sales-workspace/types';
import { isOpenEnd, STATUS_LABEL, statusFromDb } from '@/lib/sales-workspace/view';
import { formatDate } from '@/lib/workspace/format';
import { getPlacement, placementDetail, placementFormOptions, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { createClient } from '@/lib/supabase/server';
import { Badge, PageHeader } from '@/app/workspace/(staff)/components/ui';
import { ws } from '@/app/workspace/(staff)/components/tokens';
import GhlPlacement from '@/app/workspace/(staff)/sales-ops/components/GhlPlacement';
import OutcomeEditor from '@/app/workspace/(staff)/sales-ops/components/OutcomeEditor';
import PlacementForm from '@/app/workspace/(staff)/sales-ops/components/PlacementForm';
import { HealthCheck, LaunchChecklist, LaunchSettingsForm, ReviewForm } from '@/app/workspace/(staff)/sales-ops/components/LaunchControls';
import PlacementLifecycle from '@/app/workspace/(staff)/sales-ops/components/PlacementLifecycle';
import PlacementStatusControl from '@/app/workspace/(staff)/sales-ops/components/PlacementStatusControl';
import ReportPlacement from '@/app/workspace/(staff)/sales-ops/components/ReportPlacement';
import { ExcuseForm } from '../ReviewPanel';

const TABS = [
  ['overview', 'Overview'],
  ['schedule', 'Schedule and Work'],
  ['offer', 'Offer Brief'],
  ['reporting', 'Reporting'],
  ['ghl', 'GHL'],
  ['targets', 'Targets'],
  ['checklist', 'Launch Checklist'],
  ['history', 'History'],
] as const;

type Extras = {
  wizard_id: string | null;
  wizard_status: string | null;
  scheduled_for: string | null;
  pending_on: string | null;
  pending_schedule: Record<string, unknown> | null;
  end_on: string | null;
  pause_return: string | null;
  offer: Partial<OfferBrief>;
  phone: string | null;
  launch_week: boolean;
  checklist: CheckItem[];
  targets: Array<{ metric: string; daily: number | null; weekly: number | null; from: string }>;
  history: Array<{ at: string; action: string; summary: string | null; actor: string | null }>;
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${ws.card} space-y-4 p-5 sm:p-6`}>
      <h2 className={`${ws.heading} text-base font-semibold`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function PlacementPage({
  params,
  searchParams,
}: {
  params: Promise<{ placementId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { placementId } = await params;
  const { tab = 'overview' } = await searchParams;
  const role = await salesOpsRole();
  const current = TABS.some(([key]) => key === tab) ? tab : 'overview';
  const supabase = await createClient();
  const [extrasResult, launchResult] = await Promise.all([
    controlRpc<Extras>(supabase, 'so_placement_extras', { p_placement: placementId }),
    controlRpc<LaunchStatus>(supabase, 'so_launch_status', { p_placement: placementId }),
  ]);
  const extras = extrasResult.data;
  const launch = launchResult.data;

  if (role === 'manager') return <ManagerPlacement placementId={placementId} tab={current} extras={extras} launch={launch} />;
  const [data, options, detail] = await Promise.all([getPlacement(placementId), placementFormOptions(), placementDetail(placementId)]);
  if (!data) notFound();
  const { placement: p, outcomes, ghl } = data;
  const status = statusFromDb(p.status);
  const ended = status === 'ended';

  return (
    <>
      <PageHeader
        title={`${p.operator?.name ?? 'Operator'} at ${p.client?.name ?? 'client'}`}
        description={p.status === 'scheduled' && extras?.scheduled_for ? `Scheduled. It becomes active at the shift start on ${formatDate(extras.scheduled_for)}.` : undefined}
        actions={
          <>
            <Badge tone={p.status === 'active' ? 'success' : p.status === 'draft' || p.status === 'scheduled' ? 'pending' : 'neutral'}>
              {p.status === 'draft' ? 'Draft' : p.status === 'scheduled' ? 'Scheduled' : STATUS_LABEL[status]}
            </Badge>
            <Link href={`/workspace/operators/${p.operator_id}`} className="text-sm text-[var(--ws-dim)] hover:text-white">
              Operator file
            </Link>
            <Link href={`/workspace/clients/${p.case_file_id}?tab=team`} className="text-sm text-[var(--ws-dim)] hover:text-white">
              Client file
            </Link>
            <Link href={`/workspace/review/eods?status=&operator=${p.operator_id}&client=${p.case_file_id}`} className="text-sm text-[var(--ws-dim)] hover:text-white">
              EODs
            </Link>
            <Link href={`/workspace/clients/${p.case_file_id}?tab=delivery`} className="text-sm text-[var(--ws-dim)] hover:text-white">
              Reports sent
            </Link>
          </>
        }
      />
      <Tabs placementId={placementId} tab={current} />
      {extras?.wizard_status === 'draft' && extras.wizard_id ? (
        <p className="mb-4 text-sm">
          <Link className="underline" href={`/workspace/placements/new?draft=${extras.wizard_id}`}>
            Continue this draft in the wizard
          </Link>
        </p>
      ) : null}

      {current === 'overview' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Status">
            {extras?.wizard_id && p.status === 'draft' ? (
              <p className="text-sm text-[var(--ws-dim)]">This draft is activated from the wizard, after the launch checklist.</p>
            ) : (
              <PlacementStatusControl placementId={p.id} status={status} activeOutcomes={outcomes.filter((outcome) => outcome.active).length} />
            )}
            <PlacementLifecycle placementId={p.id} status={p.status} offer={extras?.offer ?? {}} />
          </Panel>
          <Panel title="Review">
            <p className="text-sm text-white">{p.review_on ? formatDate(p.review_on) : 'Not set'}</p>
            <p className="text-xs leading-relaxed text-[var(--ws-dim)]">
              {isOpenEnd(p.end_date)
                ? 'No end date. This placement stays active until someone ends it.'
                : `End date ${formatDate(p.end_date)}.`}
              {extras?.end_on ? ` Ending on ${formatDate(extras.end_on)}.` : ''}
              {extras?.pause_return ? ` Expected back ${formatDate(extras.pause_return)}.` : ''}
              {extras?.launch_week === false ? ' Launch week summary is off.' : ''}
            </p>
            <p className="text-sm text-[var(--ws-dim)]">
              GHL sub-account: {ghl.location ? ghl.location.location_name || ghl.location.location_id : 'Not linked'}. Operator user:{' '}
              {ghl.user ? ghl.user.name || ghl.user.email || 'Linked' : 'Not linked'}.
              {extras?.phone ? ` Phone: ${extras.phone.replaceAll('_', ' ')}.` : ''}
            </p>
          </Panel>
          <Panel title="End of day">
            {detail && detail.eods.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {detail.eods.map((eod) => (
                  <li key={eod.id}>
                    <Link href={`/workspace/review/eods/${eod.id}`} className="text-white hover:underline">
                      {formatDate(eod.work_date)}
                    </Link>{' '}
                    <span className="text-[var(--ws-dim)]">{eod.status.replaceAll('_', ' ')}{eod.was_late ? ' · late' : ''}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ws-dim)]">No reports yet.</p>
            )}
            <ExcuseForm placementId={p.id} />
          </Panel>
        </div>
      ) : null}

      {current === 'schedule' ? (
        <div className="space-y-6">
          {extras?.pending_on ? (
            <p className="text-sm text-amber-200">A schedule change is waiting for the next working day, {formatDate(extras.pending_on)}.</p>
          ) : null}
          <PlacementForm options={options} placement={p} />
          <Panel title="Positive outcomes">
            <OutcomeEditor placementId={p.id} outcomes={outcomes} readOnly={ended} />
          </Panel>
        </div>
      ) : null}

      {current === 'offer' ? (
        <Panel title="Offer brief">
          <OfferBriefView
            client={p.client?.name}
            offer={extras?.offer ?? { one_liner: p.campaign_summary ?? '' }}
            outcomes={outcomes.filter((outcome) => outcome.active).map((outcome) => ({ name: outcome.name, definition: outcome.definition }))}
          />
        </Panel>
      ) : null}
      {current === 'reporting' ? <ReportSection placementId={p.id} /> : null}
      {current === 'ghl' ? <GhlSection placementId={p.id} /> : null}
      {current === 'targets' ? <Targets extras={extras} /> : null}
      {current === 'checklist' ? (
        <div className="space-y-6">
          <Panel title="Launch checklist">
            <LaunchChecklist placementId={p.id} items={extras?.checklist ?? []} isAdmin={role === 'admin'} />
          </Panel>
          <Panel title="Health check">
            <HealthCheck placementId={p.id} isAdmin={role === 'admin'} latest={launch?.health ?? null} />
          </Panel>
          <Panel title="Launch summaries">
            <LaunchSettingsForm
              placementId={p.id}
              enabled={launch?.summary_enabled ?? true}
              days={launch?.summary_days ?? 5}
              combine={launch?.combine_short_week ?? true}
            />
          </Panel>
          {launch?.review_due ? (
            <Panel title="30-day review">
              {launch.review ? <p className="text-sm text-white">{launch.review.decision}. {launch.review.note}</p> : <ReviewForm placementId={p.id} />}
            </Panel>
          ) : null}
        </div>
      ) : null}
      {current === 'history' ? <History extras={extras} /> : null}
    </>
  );
}

function Tabs({ placementId, tab }: { placementId: string; tab: string }) {
  return (
    <nav aria-label="Placement" className="mb-6 flex gap-1 overflow-x-auto">
      {TABS.map(([key, label]) => (
        <Link
          key={key}
          href={`/workspace/placements/${placementId}?tab=${key}`}
          aria-current={tab === key ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${tab === key ? 'bg-brand-500/15 text-white' : 'text-[var(--ws-dim)] hover:text-white'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

async function ManagerPlacement({
  placementId,
  tab,
  extras,
  launch,
}: {
  placementId: string;
  tab: string;
  extras: Extras | null;
  launch: LaunchStatus | null;
}) {
  const data = await placementDetail(placementId);
  if (!data) notFound();
  const p = data.placement;
  const categories = (p.activity_categories ?? []).map((category) => ACTIVITY_CATEGORIES.find((item) => item.value === category)?.label ?? category);
  return (
    <>
      <PageHeader
        title={`${p.operator_name} at ${p.client_name}`}
        description="The connection, token, and GHL user stay with DA Admin."
        actions={
          <Link href="/workspace/placements" className="text-sm text-[var(--ws-dim)] hover:text-white">
            All placements
          </Link>
        }
      />
      <Tabs placementId={placementId} tab={tab} />
      {tab === 'overview' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Placement">
            <p className="text-sm capitalize text-white">{p.status}</p>
            <p className="text-sm text-[var(--ws-dim)]">
              {p.shift_start}–{p.shift_end} {p.time_zone}. EOD {p.eod_deadline}.
            </p>
            <p className="text-sm text-[var(--ws-dim)]">{categories.join(', ') || 'No categories'}</p>
            <p className="text-sm text-[var(--ws-dim)]">{p.tracks_results ? 'Show rate and closes are on.' : 'Show rate and closes are off.'}</p>
          </Panel>
          <Panel title="Changes">
            <PlacementLifecycle placementId={placementId} status={p.status} offer={extras?.offer ?? {}} />
          </Panel>
        </div>
      ) : null}
      {tab === 'schedule' ? (
        <Panel title="Schedule and work">
          <p className="text-sm text-white">
            {p.shift_start}–{p.shift_end} {p.time_zone}
          </p>
          <p className="text-sm text-[var(--ws-dim)]">{categories.join(', ')}</p>
          <ul className="space-y-2 text-sm">
            {data.outcomes.map((outcome) => (
              <li key={outcome.id}>
                <span className="text-white">{outcome.name}</span> <span className="text-[var(--ws-dim)]">{outcome.definition}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      {tab === 'offer' ? (
        <Panel title="Offer brief">
          <OfferBriefView client={p.client_name} offer={extras?.offer ?? { one_liner: p.campaign_summary ?? '' }} outcomes={data.outcomes.filter((outcome) => outcome.active)} />
        </Panel>
      ) : null}
      {tab === 'reporting' ? <ReportSection placementId={placementId} /> : null}
      {tab === 'ghl' ? <GhlSection placementId={placementId} manager /> : null}
      {tab === 'targets' ? <Targets extras={extras} /> : null}
      {tab === 'checklist' ? (
        <div className="space-y-6">
          <Panel title="Launch checklist">
            <LaunchChecklist placementId={placementId} items={extras?.checklist ?? []} isAdmin={false} />
          </Panel>
          <Panel title="Health check">
            <HealthCheck placementId={placementId} isAdmin={false} latest={launch?.health ?? null} />
          </Panel>
          {launch?.review_due ? (
            <Panel title="30-day review">
              {launch.review ? <p className="text-sm text-white">{launch.review.decision}. {launch.review.note}</p> : <ReviewForm placementId={placementId} />}
            </Panel>
          ) : null}
        </div>
      ) : null}
      {tab === 'history' ? <History extras={extras} /> : null}
    </>
  );
}

function Targets({ extras }: { extras: Extras | null }) {
  return (
    <Panel title="Targets">
      {!extras || extras.targets.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No placement targets. Leaving these empty is the recommendation for a new placement. Defaults still apply.</p> : null}
      <ul className="space-y-2 text-sm">
        {(extras?.targets ?? []).map((target) => (
          <li key={`${target.metric}-${target.from}`}>
            <span className="text-white">{target.metric}</span>{' '}
            <span className="text-[var(--ws-dim)]">
              daily {target.daily ?? '—'} · weekly {target.weekly ?? '—'} · from {formatDate(target.from)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function History({ extras }: { extras: Extras | null }) {
  return (
    <Panel title="History">
      {(extras?.history ?? []).length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No audit entries for this placement yet.</p> : null}
      <ul className="space-y-2 text-sm">
        {(extras?.history ?? []).map((event) => (
          <li key={`${event.at}-${event.action}`}>
            <span className="text-white">{event.summary || event.action}</span>
            <span className="text-[var(--ws-dim)]">
              {' '}
              · {event.actor || 'System'} · {formatDate(event.at)}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

async function ReportSection({ placementId }: { placementId: string }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Parameters<typeof ReportPlacement>[0]['panel']>(supabase, 'so_report_panel', { p_placement: placementId });
  return (
    <Panel title="Client reporting">
      {error || !data ? <p className="text-sm text-amber-200">{error ? readable(error) : 'Client reporting did not load.'}</p> : <ReportPlacement placementId={placementId} panel={data} />}
    </Panel>
  );
}

async function GhlSection({ placementId, manager = false }: { placementId: string; manager?: boolean }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Parameters<typeof GhlPlacement>[0]['panel']>(
    supabase,
    manager ? 'so_ghl_outcome_panel' : 'so_ghl_panel',
    { p_placement: placementId },
  );
  return (
    <Panel title={manager ? 'GHL outcomes' : 'GHL'}>
      {error || !data ? (
        <p className="text-sm text-amber-200">{error ? readable(error) : 'GHL settings did not load.'}</p>
      ) : (
        <GhlPlacement panel={data} mode={manager ? 'mapping' : 'admin'} />
      )}
    </Panel>
  );
}
