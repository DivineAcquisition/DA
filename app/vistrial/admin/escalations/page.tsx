'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatRelative } from '@/lib/vistrial/format';
import { isEscalationOverdue } from '@/lib/vistrial/rules/metrics';
import { useOps } from '@/lib/vistrial/store';
import type { Escalation } from '@/lib/vistrial/types';
import { AdminOnly } from '../../components/AppShell';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  inputClass,
  labelClass,
} from '../../components/ui';

export default function EscalationsPage() {
  return (
    <AdminOnly>
      <Escalations />
    </AdminOnly>
  );
}

function Escalations() {
  const { gateway } = useOps();
  const all = gateway.allEscalations();
  const overdue = all.filter((item) => isEscalationOverdue(item, gateway.now));
  const open = all.filter((item) => item.status === 'open' && !isEscalationOverdue(item, gateway.now));
  const resolved = all.filter((item) => item.status !== 'open');

  // Repeated escalations of the same kind on one client mean a missing script.
  const patterns = Object.entries(
    all.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.clientId}::${item.category}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Escalations"
        title="Questions outside operator authority"
        description="Operators raise rather than improvise. An escalation past its response window is a customer waiting, which is why it leads the queue."
      />

      <StatGrid columns={3}>
        <StatTile label="Overdue" value={String(overdue.length)} tone={overdue.length > 0 ? 'critical' : 'good'} />
        <StatTile label="Open, in window" value={String(open.length)} />
        <StatTile label="Answered or closed" value={String(resolved.length)} />
      </StatGrid>

      {patterns.length > 0 && (
        <Panel className="p-5">
          <h2 className="text-sm font-semibold text-white">Patterns worth fixing</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
            Repeated escalations of the same kind mean a script is missing. That is a system fix, not an
            operator problem.
          </p>
          <ul className="mt-3 space-y-2">
            {patterns.map(([key, count]) => {
              const [clientId, category] = key.split('::');
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-neutral-300">
                    {gateway.clientName(clientId)} — {category.replace('-', ' ')}
                  </span>
                  <Badge tone="warning">{count} times</Badge>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {overdue.length > 0 && (
        <section>
          <SectionHeader title="Overdue" hint="Past the response window set on the case file." />
          <ul className="space-y-2.5">
            {overdue.map((escalation) => (
              <EscalationCard key={escalation.id} escalation={escalation} overdue />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Open" />
        {open.length === 0 ? (
          <EmptyState title="Nothing open inside its window" />
        ) : (
          <ul className="space-y-2.5">
            {open.map((escalation) => (
              <EscalationCard key={escalation.id} escalation={escalation} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="Resolved" hint="The log per client becomes valuable over time." />
        <ul className="space-y-2.5">
          {resolved.map((escalation) => (
            <EscalationCard key={escalation.id} escalation={escalation} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function EscalationCard({ escalation, overdue = false }: { escalation: Escalation; overdue?: boolean }) {
  const { gateway, answerEscalation, closeEscalation } = useOps();
  const [answer, setAnswer] = useState('');
  const [answering, setAnswering] = useState(false);

  const tone = overdue
    ? 'critical'
    : escalation.status === 'open'
      ? 'warning'
      : escalation.status === 'answered'
        ? 'brand'
        : 'neutral';

  return (
    <li id={escalation.id} className="scroll-mt-28">
      <Panel className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{escalation.category.replace('-', ' ')}</Badge>
              <Badge tone="neutral">{escalation.status}</Badge>
              {overdue && (
                <span className="text-[11px] font-semibold text-flag-critical">
                  due {formatRelative(escalation.responseDueAt, gateway.now)}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-white">{escalation.needed}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{escalation.customerContext}</p>
            <p className="mt-2 text-xs text-neutral-600">
              <Link
                href={`/vistrial/admin/operators/${escalation.operatorId}`}
                className="hover:text-brand-200"
              >
                {gateway.operatorName(escalation.operatorId)}
              </Link>
              {' · '}
              <Link href={`/vistrial/admin/clients/${escalation.clientId}`} className="hover:text-brand-200">
                {gateway.clientName(escalation.clientId)}
              </Link>
              {' · raised '}
              {formatDateTime(escalation.raisedAt)} · routed to {escalation.routedTo.join(', ')}
            </p>
          </div>
        </div>

        {escalation.answer && (
          <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
              {escalation.answeredBy} answered
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-brand-50">{escalation.answer}</p>
          </div>
        )}

        {escalation.status === 'open' &&
          (answering ? (
            <div className="mt-4">
              <label className={labelClass} htmlFor={`answer-${escalation.id}`}>
                Answer
              </label>
              <textarea
                id={`answer-${escalation.id}`}
                rows={3}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="Give the operator a decision they can act on."
              />
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!answer.trim()}
                  onClick={() => answerEscalation(escalation.id, answer.trim())}
                  className={`${btnPrimary} ${btnSizeSm}`}
                >
                  Send answer
                </button>
                <button type="button" onClick={() => setAnswering(false)} className={`${btnSecondary} ${btnSizeSm}`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAnswering(true)} className={`${btnPrimary} ${btnSizeSm} mt-4`}>
              Answer
            </button>
          ))}

        {escalation.status === 'answered' && (
          <button
            type="button"
            onClick={() => closeEscalation(escalation.id)}
            className={`${btnSecondary} ${btnSizeSm} mt-4`}
          >
            Close escalation
          </button>
        )}
      </Panel>
    </li>
  );
}
