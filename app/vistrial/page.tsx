'use client';

import { useRouter } from 'next/navigation';
import { btnPrimary, btnSizeSm } from '@/app/components/ui';
import { OPERATOR_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { useOps } from '@/lib/vistrial/store';
import type { Actor } from '@/lib/vistrial/types';
import { Avatar, Badge, PageHeader, Panel, SectionHeader } from './components/ui';

/**
 * Workspace picker. Stands in for authentication: choosing a workspace sets the
 * actor, and every read from that point is scoped to them.
 */
export default function VistrialHome() {
  const { data, admin, actor, setActor, gateway } = useOps();
  const router = useRouter();

  const enter = (next: Actor) => {
    setActor(next);
    router.push(next.role === 'admin' ? '/vistrial/admin' : '/vistrial/operator');
  };

  const placed = data.operators.filter((operator) => operator.status === 'placed');
  const bench = data.operators.filter((operator) => operator.status === 'on-bench');

  return (
    <div>
      <PageHeader
        eyebrow="VA Ops Hub"
        title="Two faces, one system"
        description="Operators log and track their own work. The admin sees everything, intervenes, and runs payroll. Choose a workspace to see the hub from that side."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Badge tone="brand">Admin</Badge>
              <h2 className="mt-3 text-lg font-semibold text-white">{admin.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Every client, placement, operator, log and metric. Configure case files, review booking
                claims, answer escalations, and close pay periods.
              </p>
            </div>
            <Avatar name={admin.name} />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-4">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                Needs attention
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-flag-critical">
                {gateway.isAdmin ? gateway.exceptions().length : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                Placed
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{placed.length}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                On bench
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{bench.length}</dd>
            </div>
          </dl>

          <button type="button" onClick={() => enter(admin)} className={`${btnPrimary} ${btnSizeSm} mt-5 w-full`}>
            Open the admin view
          </button>
        </Panel>

        <div>
          <SectionHeader title="Operators" hint="Each one sees only their own placement and numbers." />
          <ul className="space-y-2.5">
            {data.operators.map((operator) => {
              const placement = data.placements.find(
                (item) => item.operatorId === operator.id && item.status === 'active',
              );
              const client = placement
                ? data.clients.find((candidate) => candidate.id === placement.clientId)
                : undefined;
              const isCurrent = actor.id === operator.id;

              return (
                <li key={operator.id}>
                  <button
                    type="button"
                    onClick={() => enter({ role: 'operator', id: operator.id, name: operator.name })}
                    className={`panel panel-hover flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left ${
                      isCurrent ? 'ring-1 ring-inset ring-brand-500/30' : ''
                    }`}
                  >
                    <Avatar name={operator.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{operator.name}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        {client ? `Placed on ${client.name}` : OPERATOR_STATUS_LABELS[operator.status]} · Tier{' '}
                        {operator.tier}
                      </span>
                    </span>
                    <Badge
                      tone={
                        operator.status === 'placed'
                          ? 'good'
                          : operator.status === 'on-bench'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {OPERATOR_STATUS_LABELS[operator.status]}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
