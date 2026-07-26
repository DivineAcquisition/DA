'use client';

import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDay, formatMoney } from '@/lib/vistrial/format';
import { OPERATOR_STATUS_LABELS } from '@/lib/vistrial/rules/lifecycle';
import { useOps } from '@/lib/vistrial/store';
import { Badge, DefinitionList, KeyValue, PageHeader, Panel, SectionHeader } from '../../components/ui';

/**
 * What an operator sees with no live placement. Certified and waiting is a real
 * state, not an error, so it gets a real screen: profile, history, and whatever
 * training is assigned.
 */
export default function BenchState() {
  const { gateway, actor } = useOps();
  const operator = gateway.operator(actor.id);
  if (!operator) return null;

  const history = gateway.myHistory().sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  const tasks = gateway.tasksFor(operator.id).filter((task) => !task.completedOn);
  const outstanding = operator.trainingAssignments.filter((item) => !item.completedOn);
  const onBench = operator.status === 'on-bench';

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={OPERATOR_STATUS_LABELS[operator.status]}
        title={onBench ? 'On the bench, available now' : 'Working toward certification'}
        description={
          onBench
            ? 'Your record follows you, not the client. Everything below carries into your next placement.'
            : 'You will land on your placement surface as soon as certification is signed off and a placement opens.'
        }
      />

      <Panel className="p-5">
        <DefinitionList>
          <KeyValue label="Status">
            <Badge tone={onBench ? 'warning' : 'neutral'}>{OPERATOR_STATUS_LABELS[operator.status]}</Badge>
          </KeyValue>
          <KeyValue label="Tier">
            Tier {operator.tier} · {formatMoney(operator.baseMonthly)} monthly base when placed
          </KeyValue>
          <KeyValue label="Certified">
            {operator.certifiedOn ? formatDay(operator.certifiedOn) : 'Not yet certified'}
          </KeyValue>
          <KeyValue label="Time zone">{operator.timeZone}</KeyValue>
          <KeyValue label="Preferred channel">{operator.preferredChannel}</KeyValue>
        </DefinitionList>
      </Panel>

      {(outstanding.length > 0 || tasks.length > 0) && (
        <section>
          <SectionHeader title="Assigned to you" />
          <ul className="space-y-2.5">
            {outstanding.map((item) => (
              <li key={item.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <Badge tone="brand">Training</Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{item.detail}</p>
                </Panel>
              </li>
            ))}
            {tasks.map((task) => (
              <li key={task.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{task.title}</p>
                    {task.dueOn && <Badge tone="neutral">Due {formatDay(task.dueOn)}</Badge>}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{task.detail}</p>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Completed training" />
        <Panel className="divide-y divide-white/[0.05] px-5">
          {operator.trainingAssignments
            .filter((item) => item.completedOn)
            .map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3.5">
                <p className="text-sm text-neutral-200">{item.title}</p>
                <Badge tone="good">{formatDay(item.completedOn!)}</Badge>
              </div>
            ))}
        </Panel>
      </section>

      <section>
        <SectionHeader title="Your placement history" hint="Retained across every engagement you have held." />
        {history.length === 0 ? (
          <Panel className="px-5 py-8 text-center text-sm text-neutral-500">
            No placements yet. Your first one will appear here.
          </Panel>
        ) : (
          <ul className="space-y-2.5">
            {history.map((placement) => (
              <li key={placement.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{gateway.clientName(placement.clientId)}</p>
                    <Badge tone="neutral">{placement.status}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    {formatDay(placement.startDate)} – {formatDay(placement.closedOn ?? placement.endDate)} ·{' '}
                    {gateway.confirmedFor(placement.id).length} confirmed bookings ·{' '}
                    {gateway.currentReportsFor(placement.id).length} EOD reports
                  </p>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/vistrial/operator/pay" className={`${btnSecondary} ${btnSizeSm}`}>
        View past pay statements
      </Link>
    </div>
  );
}
