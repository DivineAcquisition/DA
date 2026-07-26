'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDay, formatPercent } from '@/lib/vistrial/format';
import { OPERATOR_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { useOps } from '@/lib/vistrial/store';
import type { OperatorStatus } from '@/lib/vistrial/types';
import { AdminOnly } from '../../components/AppShell';
import { Avatar, Badge, EmptyState, PageHeader, SectionHeader, StatGrid, StatTile } from '../../components/ui';

const GROUPS: { id: OperatorStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'placed', label: 'Placed' },
  { id: 'on-bench', label: 'On bench' },
  { id: 'in-training', label: 'In training' },
  { id: 'certified', label: 'Certified' },
  { id: 'inactive', label: 'Inactive' },
];

export default function OperatorsPage() {
  return (
    <AdminOnly>
      <Roster />
    </AdminOnly>
  );
}

function Roster() {
  const { gateway } = useOps();
  const [group, setGroup] = useState<OperatorStatus | 'all'>('all');

  const operators = gateway.allOperators();
  const filtered = group === 'all' ? operators : operators.filter((operator) => operator.status === group);

  const counts = operators.reduce<Record<string, number>>((acc, operator) => {
    acc[operator.status] = (acc[operator.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Operators"
        title="Roster"
        description="Operators exist independently of any client. Their record carries tier, certification, and their full history across every placement they have held."
      />

      <StatGrid>
        <StatTile label="Placed" value={String(counts.placed ?? 0)} tone="good" />
        <StatTile
          label="On bench"
          value={String(counts['on-bench'] ?? 0)}
          hint="Certified and available"
          tone="warning"
        />
        <StatTile label="In training" value={String(counts['in-training'] ?? 0)} />
        <StatTile label="Total" value={String(operators.length)} />
      </StatGrid>

      <div>
        <SectionHeader
          title="Filter"
          actions={
            <div className="flex gap-1 overflow-x-auto">
              {GROUPS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setGroup(option.id)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    group === option.id
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

        {filtered.length === 0 ? (
          <EmptyState title="No operators in this state" />
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((operator) => {
              const placements = gateway.placementsForOperator(operator.id);
              const live = placements.find((placement) => placement.status === 'active');
              const metrics = live ? gateway.metricsFor(live.id) : null;

              return (
                <li key={operator.id}>
                  <Link
                    href={`/vistrial/admin/operators/${operator.id}`}
                    className="panel panel-hover block rounded-2xl px-5 py-4"
                  >
                    <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={operator.name} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{operator.name}</p>
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
                            <Badge tone="brand">Tier {operator.tier}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-neutral-500">
                            {live
                              ? `${gateway.clientName(live.clientId)} · until ${formatDay(live.endDate)}`
                              : operator.certifiedOn
                                ? `Certified ${formatDay(operator.certifiedOn)} · ${placements.length} past placement${placements.length === 1 ? '' : 's'}`
                                : `Joined ${formatDay(operator.joinedOn)}`}
                            {' · '}
                            {operator.timeZone}
                          </p>
                        </div>
                      </div>

                      {metrics ? (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Badge tone={metrics.responseComplianceRate >= 0.9 ? 'good' : 'critical'}>
                            {formatPercent(metrics.responseComplianceRate)} response
                          </Badge>
                          <Badge tone={metrics.eodSubmissionRate >= 0.95 ? 'good' : 'warning'}>
                            {formatPercent(metrics.eodSubmissionRate)} EOD
                          </Badge>
                          <Badge tone={metrics.quotaProgress >= 1 ? 'good' : 'neutral'}>
                            {metrics.confirmedBookings}/{metrics.monthlyQuota}
                          </Badge>
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-neutral-600">No live placement</span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
