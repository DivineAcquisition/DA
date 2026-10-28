'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ACTIVITY_LABEL,
  KEY_METRIC_KEYS,
  PLACEMENT_TYPE_LABEL,
  SHIFT_LABEL,
  attentionRank,
  formatCount,
  initials,
  metricNumber,
  type ShiftStatus,
  type TeamRow,
} from '@/lib/sales-workspace/team';
import { CertPill, EodPill, PacePill, ShiftPill, When } from './Bits';

const NUMBER_LABEL: Record<(typeof KEY_METRIC_KEYS)[number], string> = {
  conversations_held: 'Conversations',
  positive_outcomes: 'Positive',
  texts_sent: 'Texts',
  emails_sent: 'Emails',
  reactivated_bookings: 'Reactivated',
};

type SortKey = 'attention' | 'name' | 'client' | 'manager' | 'shift' | 'eod' | 'pace' | 'tasks' | 'cert';

export default function OperatorTable({ rows, isAdmin }: { rows: TeamRow[]; isAdmin: boolean }) {
  const [query, setQuery] = useState('');
  const [manager, setManager] = useState('');
  const [client, setClient] = useState('');
  const [placementType, setPlacementType] = useState('');
  const [eod, setEod] = useState('');
  const [shift, setShift] = useState('');
  const [cert, setCert] = useState('');
  const [sort, setSort] = useState<SortKey>('attention');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const managers = unique(rows.map((row) => row.manager_name));
  const clients = unique(rows.map((row) => row.client_name));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (q && !`${row.name} ${row.client_name ?? ''}`.toLowerCase().includes(q)) return false;
      if (manager && row.manager_name !== manager) return false;
      if (client && row.client_name !== client) return false;
      if (placementType && row.placement_type !== placementType) return false;
      if (eod && row.eod_status !== eod) return false;
      if (shift && row.shift_status !== shift) return false;
      if (cert && row.certification !== cert) return false;
      return true;
    });
    const factor = dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => factor * compare(a, b, sort) || a.name.localeCompare(b.name));
  }, [rows, query, manager, client, placementType, eod, shift, cert, sort, dir]);

  function toggle(next: SortKey) {
    if (sort === next) setDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(next);
      setDir('asc');
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search operator or client"
          aria-label="Search operator or client"
          className="h-9 min-w-[12rem] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white"
        />
        <Filter label="Manager" value={manager} onChange={setManager} options={managers} />
        <Filter label="Client" value={client} onChange={setClient} options={clients} />
        <Select
          label="Placement"
          value={placementType}
          onChange={setPlacementType}
          options={[
            ['client_placed', 'Client-placed'],
            ['da_internal', 'DA internal'],
          ]}
        />
        <Select
          label="EOD"
          value={eod}
          onChange={setEod}
          options={[
            ['not_started', 'Not started'],
            ['draft', 'Draft'],
            ['submitted', 'Submitted'],
            ['late', 'Late'],
            ['missed', 'Missed'],
          ]}
        />
        <Select
          label="Shift"
          value={shift}
          onChange={setShift}
          options={(Object.keys(SHIFT_LABEL) as ShiftStatus[]).map((key) => [key, SHIFT_LABEL[key]])}
        />
        <Select
          label="Certification"
          value={cert}
          onChange={setCert}
          options={[
            ['current', 'Current'],
            ['warning', 'In warning window'],
            ['grace', 'In grace period'],
            ['lapsed', 'Lapsed'],
            ['none', 'Not certified'],
          ]}
        />
      </div>
      <p className="mb-2 text-xs text-neutral-500">
        {shown.length} of {rows.length}. GHL sync is pending.
      </p>
      {shown.length === 0 ? (
        <section className="panel rounded-2xl px-6 py-12 text-center text-sm text-neutral-400">No operators match.</section>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <Th onClick={() => toggle('name')}>Operator</Th>
                  <Th onClick={() => toggle('client')}>Client</Th>
                  <Th onClick={() => toggle('manager')}>Manager</Th>
                  <Th onClick={() => toggle('shift')}>Shift</Th>
                  <Th>Last activity</Th>
                  <Th onClick={() => toggle('eod')}>EOD</Th>
                  {KEY_METRIC_KEYS.map((key) => (
                    <Th key={key}>{NUMBER_LABEL[key]}</Th>
                  ))}
                  <Th onClick={() => toggle('pace')}>Pace</Th>
                  <Th onClick={() => toggle('tasks')}>Tasks</Th>
                  <Th onClick={() => toggle('cert')}>Certification</Th>
                  {isAdmin ? <Th>Mismatch</Th> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.placement_id ?? row.operator_id} className="border-t border-white/[0.06]">
                    <td className="py-3 pr-3">
                      <Person row={row} />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="text-white">{row.client_name ?? '—'}</div>
                      <div className="text-xs text-neutral-500">
                        {row.placement_type ? PLACEMENT_TYPE_LABEL[row.placement_type] ?? row.placement_type : 'No placement'}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-neutral-300">{row.manager_name ?? '—'}</td>
                    <td className="py-3 pr-3">
                      <ShiftPill status={row.shift_status} />
                    </td>
                    <td className="py-3 pr-3 text-neutral-300">
                      <When iso={row.last_activity_at} operatorZone={row.time_zone} />
                      {row.last_activity_kind ? (
                        <span className="mt-0.5 block text-[11px] text-neutral-500">{ACTIVITY_LABEL[row.last_activity_kind] ?? row.last_activity_kind}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <EodPill status={row.eod_status} wasLate={row.was_late} />
                    </td>
                    {KEY_METRIC_KEYS.map((key) => (
                      <td key={key} className="py-3 pr-3 tabular-nums text-white">
                        {formatCount(metricNumber(row.metrics, key))}
                      </td>
                    ))}
                    <td className="py-3 pr-3">
                      <PacePill pace={row.pace} />
                    </td>
                    <td className="py-3 pr-3 text-neutral-300">
                      {row.tasks_open} open
                      {row.tasks_overdue > 0 ? <span className="block text-xs text-flag-critical">{row.tasks_overdue} overdue</span> : null}
                    </td>
                    <td className="py-3 pr-3">
                      <CertPill status={row.certification} />
                    </td>
                    {isAdmin ? (
                      <td className="py-3 pr-3">{row.open_mismatch ? <span className="text-xs font-semibold text-flag-critical">Open</span> : '—'}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">
            {shown.map((row) => (
              <li key={row.placement_id ?? row.operator_id} className="panel rounded-2xl p-4">
                <Person row={row} />
                <p className="mt-2 text-sm text-neutral-400">
                  {row.client_name ?? 'No client'} · {row.manager_name ?? 'No manager'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ShiftPill status={row.shift_status} />
                  <EodPill status={row.eod_status} wasLate={row.was_late} />
                  <PacePill pace={row.pace} />
                  <CertPill status={row.certification} />
                </div>
                <p className="mt-3 text-sm text-neutral-300">
                  {KEY_METRIC_KEYS.map((key) => `${NUMBER_LABEL[key]} ${formatCount(metricNumber(row.metrics, key))}`).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {row.tasks_open} open tasks
                  {row.tasks_overdue > 0 ? ` · ${row.tasks_overdue} overdue` : ''}
                  {isAdmin && row.open_mismatch ? ' · Open mismatch' : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Person({ row }: { row: TeamRow }) {
  return (
    <Link href={`/vistrial/team/workspace/operators/${row.operator_id}`} className="flex items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-semibold text-brand-100">
        {initials(row.name)}
      </span>
      <span>
        <span className="block font-medium text-white">{row.name}</span>
        <span className="block text-xs text-neutral-500">{row.email}</span>
      </span>
    </Link>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  if (!onClick) return <th className="pb-2 pr-3 font-medium">{children}</th>;
  return (
    <th className="pb-2 pr-3 font-medium">
      <button type="button" onClick={onClick} className="uppercase tracking-wide hover:text-white">
        {children}
      </button>
    </th>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm text-white">
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-ink-950 px-2 text-sm text-white">
      <option value="">{label}</option>
      {options.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function compare(a: TeamRow, b: TeamRow, sort: SortKey): number {
  if (sort === 'attention') return attentionRank(a) - attentionRank(b);
  if (sort === 'name') return a.name.localeCompare(b.name);
  if (sort === 'client') return (a.client_name ?? '').localeCompare(b.client_name ?? '');
  if (sort === 'manager') return (a.manager_name ?? '').localeCompare(b.manager_name ?? '');
  if (sort === 'shift') return (a.shift_status ?? '').localeCompare(b.shift_status ?? '');
  if (sort === 'eod') return (a.eod_status ?? '').localeCompare(b.eod_status ?? '');
  if (sort === 'pace') return (a.pace ?? 'z').localeCompare(b.pace ?? 'z');
  if (sort === 'tasks') return a.tasks_overdue - b.tasks_overdue || a.tasks_open - b.tasks_open;
  if (sort === 'cert') return a.certification.localeCompare(b.certification);
  return 0;
}
