import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACTIVITY_CATEGORIES } from '@/lib/sales-workspace/types';
import { isOpenEnd, STATUS_LABEL, statusFromDb } from '@/lib/sales-workspace/view';
import { formatDate } from '@/lib/workspace/format';
import { getPlacement, placementDetail, placementFormOptions, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { Badge, PageHeader } from '../../../components/ui';
import { ws } from '../../../components/tokens';
import OutcomeEditor from '../../components/OutcomeEditor';
import PlacementForm from '../../components/PlacementForm';
import PlacementStatusControl from '../../components/PlacementStatusControl';
import { ExcuseForm } from '../../eods/ReviewPanel';
import GhlPlacement from '../../components/GhlPlacement';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${ws.card} space-y-4 p-5 sm:p-6`}>
      <h2 className={`${ws.heading} text-base font-semibold`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function PlacementPage({ params }: { params: Promise<{ placementId: string }> }) {
  const { placementId } = await params;
  const role = await salesOpsRole();
  if (role === 'manager') return <ManagerPlacement placementId={placementId} />;
  const [data, options, detail] = await Promise.all([getPlacement(placementId), placementFormOptions(), placementDetail(placementId)]);
  if (!data) notFound();
  const { placement: p, outcomes, ghl } = data;
  const status = statusFromDb(p.status);
  const ended = status === 'ended';

  return (
    <>
      <PageHeader
        title={`${p.operator?.name ?? 'Operator'} at ${p.client?.name ?? 'client'}`}
        description={
          p.placement_type
            ? undefined
            : 'This placement predates the workspace. Choose a type and categories below to bring it in.'
        }
        actions={
          <>
            <Badge tone={status === 'active' ? 'success' : status === 'pending' ? 'pending' : 'neutral'}>
              {STATUS_LABEL[status]}
            </Badge>
            <Link href="/workspace/sales-ops/placements" className="text-sm text-[var(--ws-dim)] hover:text-white">
              All placements
            </Link>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <PlacementForm options={options} placement={p} />
          <Panel title="Positive outcomes">
            <p className="text-sm text-[var(--ws-dim)]">
              What counts as a win for this client. An active placement always keeps at least one.
            </p>
            <OutcomeEditor placementId={p.id} outcomes={outcomes} readOnly={ended} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Status">
            <PlacementStatusControl
              placementId={p.id}
              status={status}
              activeOutcomes={outcomes.filter((o) => o.active).length}
            />
          </Panel>

          <Panel title="Review">
            <p className="text-sm text-white">
              {p.review_on ? formatDate(p.review_on) : 'Not set'}
            </p>
            <p className="text-xs leading-relaxed text-[var(--ws-dim)]">
              {isOpenEnd(p.end_date)
                ? 'No end date. This placement stays active until someone ends it. The review date alerts the assigned manager and DA Admin.'
                : `End date ${formatDate(p.end_date)}. Ending it is still a manual status change.`}
            </p>
          </Panel>

          <Panel title="GHL links">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[var(--ws-dim)]">Client sub-account</dt>
                <dd className="mt-0.5 text-white">
                  {ghl.location ? (
                    <>
                      {ghl.location.location_name || 'Linked'}{' '}
                      <span className="font-mono text-xs text-[var(--ws-dim)]">{ghl.location.location_id}</span>
                    </>
                  ) : (
                    <Badge tone="pending">Not linked</Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--ws-dim)]">Operator&apos;s GHL user</dt>
                <dd className="mt-0.5 text-white">
                  {ghl.user ? (
                    <>
                      {ghl.user.name || ghl.user.email || 'Linked'}{' '}
                      {ghl.user.deactivated_at ? <Badge tone="error">Deactivated</Badge> : null}
                    </>
                  ) : (
                    <Badge tone="pending">Not linked</Badge>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-[var(--ws-dim)]">
              These come from the existing GHL connection. Link the sub-account on the{' '}
              <Link href={`/workspace/team/ghl/client/${p.case_file_id}`} className="underline hover:text-white">
                client&apos;s GHL page
              </Link>{' '}
              and the operator under{' '}
              <Link href="/workspace/team/ghl/access" className="underline hover:text-white">
                GHL access
              </Link>
              . Keys stay in the vault and never reach operators or managers.
            </p>
          </Panel>
          <Panel title="End of day">
            {detail && detail.eods.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {detail.eods.map((e) => (
                  <li key={e.id}>
                    <Link href={`/workspace/sales-ops/eods/${e.id}`} className="text-white hover:underline">
                      {formatDate(e.work_date)}
                    </Link>{' '}
                    <span className="text-[var(--ws-dim)]">
                      {e.status.replaceAll('_', ' ')}
                      {e.was_late ? ' · late' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--ws-dim)]">No reports yet.</p>
            )}
            <ExcuseForm placementId={p.id} />
          </Panel>
          <GhlSection placementId={p.id} />
        </div>
      </div>
    </>
  );
}

async function ManagerPlacement({ placementId }: { placementId: string }) {
  const data = await placementDetail(placementId);
  if (!data) notFound();
  const p = data.placement;
  const categories = (p.activity_categories ?? []).map((c) => ACTIVITY_CATEGORIES.find((a) => a.value === c)?.label ?? c);
  return (
    <>
      <PageHeader
        title={`${p.operator_name} at ${p.client_name}`}
        description="Read only. The assigned manager is who gets alerts and feedback. Every manager can see this placement."
        actions={
          <Link href="/workspace/sales-ops/placements" className="text-sm text-[var(--ws-dim)] hover:text-white">
            All placements
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Placement">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[var(--ws-dim)]">Status</dt>
              <dd className="text-white capitalize">{p.status}</dd>
            </div>
            <div>
              <dt className="text-[var(--ws-dim)]">Manager</dt>
              <dd className="text-white">{p.manager_name ?? 'Not assigned'}</dd>
            </div>
            <div>
              <dt className="text-[var(--ws-dim)]">Shift</dt>
              <dd className="text-white">
                {p.shift_start}–{p.shift_end} {p.time_zone}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--ws-dim)]">EOD deadline</dt>
              <dd className="text-white">{p.eod_deadline}</dd>
            </div>
            <div>
              <dt className="text-[var(--ws-dim)]">Review date</dt>
              <dd className="text-white">{p.review_on ? formatDate(p.review_on) : 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-[var(--ws-dim)]">End date</dt>
              <dd className="text-white">{isOpenEnd(p.end_date) ? 'None. Stays active until someone ends it.' : formatDate(p.end_date)}</dd>
            </div>
          </dl>
          <p className="text-sm text-[var(--ws-dim)]">{categories.join(', ') || 'No categories'}</p>
          {p.campaign_summary ? <p className="text-sm text-white">{p.campaign_summary}</p> : null}
          <p className="text-sm text-[var(--ws-dim)]">{p.tracks_results ? 'Show rate and closes are tracked from GHL.' : 'Show rate and closes are off.'}</p>
        </Panel>
        <Panel title="Positive outcomes">
          {data.outcomes.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">None yet.</p> : null}
          <ul className="space-y-2 text-sm">
            {data.outcomes.map((o) => (
              <li key={o.id}>
                <span className="text-white">{o.name}</span>{' '}
                <span className="text-[var(--ws-dim)]">{o.active ? o.definition : 'Retired'}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="End of day">
          {data.eods.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No reports yet.</p> : null}
          <ul className="space-y-2 text-sm">
            {data.eods.map((e) => (
              <li key={e.id} className="text-[var(--ws-dim)]">
                <Link href={`/workspace/sales-ops/eods/${e.id}`} className="text-white hover:underline">
                  {formatDate(e.work_date)}
                </Link>{' '}
                {e.status.replaceAll('_', ' ')}
                {e.was_late ? ' · late' : ''}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Excuse a day">
          <p className="text-sm text-[var(--ws-dim)]">No EOD is due, and reminders stop. The operator can see the day. They cannot excuse themselves.</p>
          <ExcuseForm placementId={placementId} />
        </Panel>
        <Panel title="Feedback">
          {data.feedback.length === 0 ? <p className="text-sm text-[var(--ws-dim)]">No feedback yet.</p> : null}
          <ul className="space-y-2 text-sm">
            {data.feedback.map((f) => (
              <li key={f.id}>
                <span className="text-[var(--ws-dim)]">{f.author_kind} · </span>
                <span className="text-white">{f.body}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

async function GhlSection({ placementId }: { placementId: string }) {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Parameters<typeof GhlPlacement>[0]['panel']>(supabase, 'so_ghl_panel', { p_placement: placementId });
  return (
    <Panel title="GHL">
      {error || !data ? <p className="text-sm text-amber-200">{error ? error.message : 'GHL settings did not load.'}</p> : <GhlPlacement panel={data} />}
    </Panel>
  );
}
