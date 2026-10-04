'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ActivityHealth } from '@/lib/ghl/types';
import { Empty, Panel, Pill, when } from './ui';

const KIND_LABEL: Record<string, string> = {
  va: 'VA',
  staff: 'DA staff',
  client: 'Client staff',
  automated: 'Automated',
  unattributed: 'Unattributed',
  unknown: 'No signal',
};

export default function ActivityView({ rows }: { rows: ActivityHealth }) {
  const [now] = useState(() => Date.now());
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Activity health</h1>
      {rows.length === 0 ? <Empty>No client sub-account is connected yet.</Empty> : null}
      {rows.map((r) => {
        const silent = r.on_shift_now && (!r.last_event_at || now - new Date(r.last_event_at).getTime() > 3 * 3600_000);
        return (
          <Panel
            key={r.case_file_id}
            title={r.name}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {r.is_test ? <Pill tone="muted">Test</Pill> : null}
                {r.on_shift_now ? <Pill tone="good">On shift now</Pill> : <Pill tone="muted">Off shift</Pill>}
                {silent ? <Pill tone="bad">Silent during business hours</Pill> : null}
                <Link href={`/vistrial/team/ghl/client/${r.case_file_id}`} className="text-xs text-neutral-400 hover:text-white">
                  Open client
                </Link>
              </div>
            }
          >
            <dl className="grid gap-x-4 gap-y-1 text-xs text-neutral-400 sm:grid-cols-3">
              <div>Last event: <span className="text-neutral-200">{when(r.last_event_at)}</span></div>
              <div>Messages last read: <span className="text-neutral-200">{when(r.polled_at)}</span></div>
              <div>Webhook endpoint: <span className="text-neutral-200">{r.endpoint ? 'open' : 'not set up'}</span></div>
              <div>Received (24 h): <span className="text-neutral-200">{Object.values(r.status_24h).reduce((a, b) => a + b, 0)}</span></div>
              <div>Processed: <span className="text-neutral-200">{r.status_24h.processed ?? 0}</span></div>
              <div>Waiting: <span className={r.waiting ? 'text-amber-300' : 'text-neutral-200'}>{r.waiting}</span></div>
              <div>Failed: <span className={r.failed_24h ? 'text-flag-critical' : 'text-neutral-200'}>{r.failed_24h}</span></div>
              <div>Unattributed: <span className={r.unattributed_24h ? 'text-amber-300' : 'text-neutral-200'}>{r.unattributed_24h}</span></div>
              <div>Unknown type: <span className={r.unknown_24h ? 'text-amber-300' : 'text-neutral-200'}>{r.unknown_24h}</span></div>
              <div>Refused deliveries: <span className={r.auth_failures_24h ? 'text-flag-critical' : 'text-neutral-200'}>{r.auth_failures_24h}</span></div>
              <div>Estimated attributions: <span className="text-neutral-200">{r.estimated_24h}</span></div>
            </dl>
            <p className="mt-3 text-xs text-neutral-400">
              Outbound touches (24 h):{' '}
              {Object.keys(r.touches_24h).length
                ? Object.entries(r.touches_24h).map(([k, n]) => `${KIND_LABEL[k] ?? k} ${n}`).join(' · ')
                : 'none'}
            </p>
            {Object.keys(r.by_type).length ? (
              <p className="mt-1 text-xs text-neutral-500">
                By type: {Object.entries(r.by_type).map(([t, v]) => `${t} ${v.day} today (last ${when(v.last)})`).join(' · ')}
              </p>
            ) : null}
            {r.unrecognised_users.length ? (
              <p className="mt-2 text-xs text-amber-300">
                Unknown GHL users sent messages: {r.unrecognised_users.join(', ')}. Resolve them on the Unattributed page; they are never guessed.
              </p>
            ) : null}
            {r.recent_failures.length ? (
              <ul className="mt-2 space-y-0.5 text-xs text-flag-critical">
                {r.recent_failures.map((f) => (
                  <li key={f.id}>
                    {when(f.received_at)} · {f.event_type ?? 'untyped'} · {f.status} · {f.error}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}
