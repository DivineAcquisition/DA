'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, EmptyState } from '../../components/ui';
import { formatDate } from '@/lib/workspace/format';
import {
  CALL_STATUSES,
  callStatusColor,
  callStatusLabel,
  frontDeskLabel,
  matchesCallSearch,
  practiceTypeLabel,
  type CallRecord,
  type CallStatus,
} from '@/lib/workspace/calls';

function StatusBadge({ status }: { status: CallStatus }) {
  const color = callStatusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}18` }}
    >
      {callStatusLabel(status)}
    </span>
  );
}

export default function CallsList({ calls }: { calls: CallRecord[] }) {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<CallStatus[]>([]);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      if (!matchesCallSearch(call, query)) return false;
      if (statuses.length > 0 && !statuses.includes(call.status)) return false;
      return true;
    });
  }, [calls, query, statuses]);

  function toggleStatus(status: CallStatus) {
    setStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block flex-1 sm:max-w-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Contact or practice"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500/60"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CALL_STATUSES.map((status) => {
            const active = statuses.includes(status);
            const color = callStatusColor(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? color : '#6E6C80',
                  borderColor: active ? `${color}88` : 'rgba(255,255,255,0.1)',
                  backgroundColor: active ? `${color}22` : 'transparent',
                }}
              >
                {callStatusLabel(status)}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={calls.length === 0 ? 'No calls yet' : 'No matching calls'}
          description={
            calls.length === 0
              ? 'Create a call record to open the live workspace.'
              : 'Clear the status pills or search to see more records.'
          }
        />
      ) : (
        <DataTable
          headers={['Contact', 'Practice', 'Type', 'Front desk', 'Status', 'Created']}
        >
          {visible.map((call) => (
            <tr key={call.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link href={`/workspace/calls/${call.id}`} className="font-medium text-white hover:text-brand-300">
                  {call.contact_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--ws-body)]">{call.practice_name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-300">
                  {practiceTypeLabel(call.practice_type)}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-white">{frontDeskLabel(call.front_desk_size)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(call.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
