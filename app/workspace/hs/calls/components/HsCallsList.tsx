'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable, EmptyState } from '../../../components/ui';
import { formatDate } from '@/lib/workspace/format';
import {
  HS_CALL_STATUSES,
  HS_TRADES,
  hsCallStatusColor,
  hsCallStatusLabel,
  hsPhoneCoverageLabel,
  hsTradeLabel,
  matchesHsCallSearch,
  type HsCallRecord,
  type HsCallStatus,
  type HsTrade,
} from '@/lib/workspace/hs-calls';

function StatusBadge({ status }: { status: HsCallStatus }) {
  const color = hsCallStatusColor(status);
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}18` }}
    >
      {hsCallStatusLabel(status)}
    </span>
  );
}

export default function HsCallsList({ calls }: { calls: HsCallRecord[] }) {
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<HsCallStatus[]>([]);
  const [trades, setTrades] = useState<HsTrade[]>([]);

  const visible = useMemo(() => {
    return calls.filter((call) => {
      if (!matchesHsCallSearch(call, query)) return false;
      if (statuses.length > 0 && !statuses.includes(call.status)) return false;
      if (trades.length > 0 && !trades.includes(call.trade)) return false;
      return true;
    });
  }, [calls, query, statuses, trades]);

  function toggleStatus(status: HsCallStatus) {
    setStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
    );
  }

  function toggleTrade(trade: HsTrade) {
    setTrades((current) =>
      current.includes(trade) ? current.filter((item) => item !== trade) : [...current, trade],
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3">
        <label className="block sm:max-w-sm">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6E6C80]">
            Search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Contact or company"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-brand-500/60"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {HS_CALL_STATUSES.map((status) => {
            const active = statuses.includes(status);
            const color = hsCallStatusColor(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? color : '#6E6C80',
                  borderColor: active ? `${color}88` : '#2A2A3A',
                  backgroundColor: active ? `${color}22` : 'transparent',
                }}
              >
                {hsCallStatusLabel(status)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {HS_TRADES.map((trade) => {
            const active = trades.includes(trade);
            return (
              <button
                key={trade}
                type="button"
                onClick={() => toggleTrade(trade)}
                className="rounded-full border px-3 py-1 text-[12px] font-semibold transition"
                style={{
                  color: active ? '#937DFF' : '#6E6C80',
                  borderColor: active ? '#937DFF88' : '#2A2A3A',
                  backgroundColor: active ? '#937DFF22' : 'transparent',
                }}
              >
                {hsTradeLabel(trade)}
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
              : 'Clear the status or trade pills, or search, to see more records.'
          }
        />
      ) : (
        <DataTable headers={['Contact', 'Company', 'Trade', 'Who answers', 'Status', 'Created']}>
          {visible.map((call) => (
            <tr key={call.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link
                  href={`/workspace/hs/calls/${call.id}`}
                  className="font-medium text-white hover:text-[#937DFF]"
                >
                  {call.contact_name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#B0AEC0]">{call.company_name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full border border-[#937DFF]/25 bg-[#937DFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#937DFF]">
                  {hsTradeLabel(call.trade)}
                </span>
              </td>
              <td className="px-4 py-3 text-white">{hsPhoneCoverageLabel(call.who_answers_phone)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-4 py-3 text-[#6E6C80]">{formatDate(call.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
