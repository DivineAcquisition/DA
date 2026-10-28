import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STATUS_LABEL, statusFromDb } from '@/lib/sales-workspace/view';
import { getPlacement, placementFormOptions } from '@/lib/workspace/sales-ops-queries';
import { Badge, PageHeader } from '../../../components/ui';
import { ws } from '../../../components/tokens';
import OutcomeEditor from '../../components/OutcomeEditor';
import PlacementForm from '../../components/PlacementForm';
import PlacementStatusControl from '../../components/PlacementStatusControl';

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
  const [data, options] = await Promise.all([getPlacement(placementId), placementFormOptions()]);
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
              <Link href={`/vistrial/team/ghl/client/${p.case_file_id}`} className="underline hover:text-white">
                client&apos;s GHL page
              </Link>{' '}
              and the operator under{' '}
              <Link href="/vistrial/team/ghl/access" className="underline hover:text-white">
                GHL access
              </Link>
              . Keys stay in the vault and never reach operators or managers.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
