'use client';

import { useMemo, useState } from 'react';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { rerouteLeadAction } from '@/lib/ghl/actions';
import type { RoutingLog } from '@/lib/ghl/types';
import { selectClass } from '../../components/ui';
import { Feedback, useAction } from '../../operator/components/portal';
import { Empty, Panel, Pill, when } from './ui';

const KIND: Record<string, string> = {
  initial: 'New lead',
  after_hours_release: 'Released at shift start',
  reassign: 'Reassigned (rule)',
  manual: 'Assigned by hand',
};

export default function RoutingView({ log }: { log: RoutingLog }) {
  const [client, setClient] = useState('');
  const [va, setVa] = useState('');
  const { run, pending, message, error } = useAction();
  const clients = useMemo(() => [...new Set(log.decisions.map((d) => d.client))].sort(), [log]);
  const vas = useMemo(() => [...new Set(log.decisions.flatMap((d) => d.candidates.map((c) => c.name)))].sort(), [log]);
  const rows = log.decisions.filter((d) => (!client || d.client === client) && (!va || d.chosen === va || d.candidates.some((c) => c.name === va)));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Routing log</h1>

      <Panel title={`Waiting for a VA (${log.queue.length})`}>
        {log.queue.length === 0 ? (
          <Empty>No lead is waiting.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {log.queue.map((q) => (
              <li key={q.lead_id} className="flex flex-wrap items-center gap-2">
                <Pill tone={q.state === 'after_hours' ? 'muted' : 'warn'}>{q.state === 'after_hours' ? 'After hours' : q.state === 'manual' ? 'Manual' : 'Nobody eligible'}</Pill>
                <span className="text-neutral-200">{q.lead_name ?? 'Lead'}</span>
                <span className="text-xs text-neutral-500">
                  {q.client} · since {when(q.created_at)}
                </span>
                {log.can_manage ? (
                  <button type="button" disabled={pending} onClick={() => run(() => rerouteLeadAction(q.lead_id))} className={`${btnSecondary} ${btnSizeSm}`}>
                    Assign to an eligible VA now
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Feedback message={message} error={error} />
      </Panel>

      <Panel
        title="Decisions"
        actions={
          <div className="flex gap-2">
            <select value={client} onChange={(e) => setClient(e.target.value)} className={`${selectClass} py-1.5 text-xs`}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select value={va} onChange={(e) => setVa(e.target.value)} className={`${selectClass} py-1.5 text-xs`}>
              <option value="">All VAs</option>
              {vas.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <Empty>No routing decisions yet.</Empty>
        ) : (
          <ul className="space-y-2">
            {rows.map((d) => (
              <li key={d.id} className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-neutral-500">{new Date(d.at).toLocaleString()}</span>
                  <Pill tone="muted">{KIND[d.kind] ?? d.kind}</Pill>
                  <span className="text-neutral-100">{d.lead_name ?? 'Lead'}</span>
                  <span className="text-xs text-neutral-500">{d.client}</span>
                  {d.chosen ? <Pill tone="good">→ {d.chosen}</Pill> : <Pill tone="warn">Not assigned</Pill>}
                  {d.state === 'touched' ? <Pill tone="good">Responded{d.response_minutes != null ? ` in ${d.response_minutes} min` : ''}</Pill> : null}
                  {!d.counts_toward_response ? <Pill tone="muted">Not counted (after hours)</Pill> : null}
                  {d.owner_state === 'failed' ? <Pill tone="bad">GHL owner not set</Pill> : d.owner_state === 'set' ? <Pill tone="muted">GHL owner set</Pill> : null}
                </div>
                <p className="mt-1 text-xs text-neutral-300">{d.reason}</p>
                {d.candidates.length ? (
                  <p className="mt-1 text-xs text-neutral-500">
                    Considered: {d.candidates.map((c) => `${c.name}${c.skipped ? ` (${c.skipped})` : ` (eligible, ${c.open_leads} open)`}`).join('; ')}
                  </p>
                ) : null}
                {d.owner_error ? <p className="mt-1 text-xs text-flag-critical">{d.owner_error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
