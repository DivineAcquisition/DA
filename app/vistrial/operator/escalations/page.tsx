'use client';

import Link from 'next/link';
import { useState } from 'react';
import { btnPrimary, btnSecondary, btnSizeMd, btnSizeSm } from '@/app/components/ui';
import { formatDateTime, formatRelative } from '@/lib/vistrial/format';
import { isEscalationOverdue } from '@/lib/vistrial/rules/metrics';
import { useOps } from '@/lib/vistrial/store';
import type { EscalationCategory } from '@/lib/vistrial/types';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  inputClass,
  labelClass,
  selectClass,
} from '../../components/ui';
import BenchState from '../components/BenchState';
import PlacementSwitcher from '../components/PlacementSwitcher';

const CATEGORIES: { id: EscalationCategory; label: string; hint: string }[] = [
  { id: 'clinical', label: 'Clinical question', hint: 'Anything medical or treatment-related. Never answer these yourself.' },
  { id: 'pricing-exception', label: 'Pricing exception', hint: 'A discount, an old rate, or anything off the price list.' },
  { id: 'complaint', label: 'Complaint', hint: 'An unhappy customer asking for something you cannot grant.' },
  { id: 'scheduling-conflict', label: 'Scheduling conflict', hint: 'Calendar problems you cannot resolve alone.' },
  { id: 'scope', label: 'Scope question', hint: 'A request for something the client does not offer.' },
  { id: 'other', label: 'Something else', hint: 'Outside your authority and not covered above.' },
];

export default function OperatorEscalationsPage() {
  const { gateway, activePlacement } = useOps();

  if (gateway.isAdmin) {
    return (
      <EmptyState
        title="Operator surface"
        detail="Switch to an operator workspace to raise an escalation."
        action={
          <Link href="/vistrial/admin/escalations" className={`${btnSecondary} ${btnSizeSm}`}>
            Go to the escalation queue
          </Link>
        }
      />
    );
  }

  if (!activePlacement) return <BenchState />;
  return <Escalations />;
}

function Escalations() {
  const { gateway, activePlacement, raiseEscalation } = useOps();
  const placement = activePlacement!;
  const client = gateway.client(placement.clientId)!;

  const mine = [...gateway.escalationsFor(placement.id)].sort(
    (a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt),
  );

  const [category, setCategory] = useState<EscalationCategory>('clinical');
  const [customerContext, setCustomerContext] = useState('');
  const [needed, setNeeded] = useState('');
  const [raised, setRaised] = useState(false);

  const selected = CATEGORIES.find((option) => option.id === category)!;
  const contact = client.config.escalationContact;

  const submit = () => {
    if (!customerContext.trim() || !needed.trim()) return;
    raiseEscalation({
      placementId: placement.id,
      category,
      customerContext: customerContext.trim(),
      needed: needed.trim(),
    });
    setRaised(true);
    setCustomerContext('');
    setNeeded('');
  };

  return (
    <div>
      <PlacementSwitcher />

      <PageHeader
        eyebrow={client.name}
        title="Escalations"
        description="When something is outside your authority, raise it rather than improvising. Raising is the behaviour we want; guessing is not."
      />

      <div className="space-y-8">
        {raised && (
          <Panel className="border-brand-500/25 bg-brand-500/[0.07] p-5">
            <Badge tone="brand">Raised</Badge>
            <p className="mt-2 text-sm leading-relaxed text-white">
              It is with DA Admin{contact ? ` and ${contact.name}` : ''} now, due back within{' '}
              {client.config.escalationResponseHours} hours. If it goes past that window it moves to the top of
              the admin&apos;s queue automatically.
            </p>
          </Panel>
        )}

        <section>
          <SectionHeader
            title="Raise an escalation"
            hint={`Response window is ${client.config.escalationResponseHours} hours for this client.`}
          />
          <Panel className="p-5">
            <div className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="category">
                  What kind of question
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as EscalationCategory)}
                  className={selectClass}
                >
                  {CATEGORIES.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{selected.hint}</p>
              </div>

              <div>
                <label className={labelClass} htmlFor="context">
                  Customer context *
                </label>
                <textarea
                  id="context"
                  rows={3}
                  value={customerContext}
                  onChange={(event) => setCustomerContext(event.target.value)}
                  className={`${inputClass} resize-none`}
                  placeholder="Who they are, what they asked, and what you have already told them."
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="needed">
                  What you need *
                </label>
                <textarea
                  id="needed"
                  rows={2}
                  value={needed}
                  onChange={(event) => setNeeded(event.target.value)}
                  className={`${inputClass} resize-none`}
                  placeholder="A decision you can act on. Be specific."
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                Routes to DA Admin
                {contact ? ` and ${contact.name} (${contact.role}) via ${contact.channel}` : ' only'}.
              </p>
              <button
                type="button"
                disabled={!customerContext.trim() || !needed.trim()}
                onClick={submit}
                className={`${btnPrimary} ${btnSizeMd}`}
              >
                Raise it
              </button>
            </div>
          </Panel>
        </section>

        <section>
          <SectionHeader title="Your escalations on this placement" />
          {mine.length === 0 ? (
            <EmptyState title="Nothing raised yet" />
          ) : (
            <ul className="space-y-2.5">
              {mine.map((escalation) => {
                const overdue = isEscalationOverdue(escalation, gateway.now);
                return (
                  <li key={escalation.id}>
                    <Panel className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              overdue
                                ? 'critical'
                                : escalation.status === 'open'
                                  ? 'warning'
                                  : escalation.status === 'answered'
                                    ? 'brand'
                                    : 'neutral'
                            }
                          >
                            {escalation.category.replace('-', ' ')}
                          </Badge>
                          <Badge tone="neutral">{escalation.status}</Badge>
                        </div>
                        <span className="text-[11px] text-neutral-600">
                          {escalation.status === 'open'
                            ? `due ${formatRelative(escalation.responseDueAt, gateway.now)}`
                            : formatDateTime(escalation.raisedAt)}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-medium text-white">{escalation.needed}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                        {escalation.customerContext}
                      </p>

                      {escalation.answer && (
                        <div className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                            {escalation.answeredBy} answered
                          </p>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-brand-50">{escalation.answer}</p>
                        </div>
                      )}
                    </Panel>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
