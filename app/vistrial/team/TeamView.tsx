'use client';

import { useState } from 'react';
import PlaybookEditor from '../operator/components/PlaybookEditor';
import { OperatorSessions, ViewAsButton } from '../components/ViewAs';
import { OPERATOR_STATUS } from '@/lib/portal/labels';

export type RosterRow = {
  id: string;
  name: string;
  status: string;
  tier: number | null;
  has_account: boolean;
  placements: { id: string; client_name: string; live: boolean }[];
  open_escalations: number;
  overdue_escalations: number;
  pending_bookings: number;
  flagged_shifts: number;
};

export default function TeamView({ rows, error }: { rows: RosterRow[]; error: string | null }) {
  const [playbook, setPlaybook] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">Operators</h1>
        <p className="mt-1 text-sm text-neutral-400">
          The Sales Operators in your scope. View As opens their portal read-only; anything you do there is done in your
          own name from the admin panel.
        </p>
      </div>
      {error ? <p className="text-sm text-flag-critical">{error}</p> : null}
      {rows.length === 0 && !error ? <p className="text-sm text-neutral-500">No operators in your scope.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="panel rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{row.name}</p>
                <p className="text-xs text-neutral-500">
                  {OPERATOR_STATUS[row.status] ?? 'Sales Operator'}
                  {row.tier ? ` · Tier ${row.tier}` : ''}
                </p>
              </div>
              <ViewAsButton operatorId={row.id} name={row.name.split(' ')[0]} hasAccount={row.has_account} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Stat label="Waiting on DA" value={row.open_escalations} alert={row.overdue_escalations > 0} extra={row.overdue_escalations ? `${row.overdue_escalations} late` : undefined} />
              <Stat label="Bookings to review" value={row.pending_bookings} />
              <Stat label="Shifts to review" value={row.flagged_shifts} alert={row.flagged_shifts > 0} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.placements.map((placement) => (
                <button
                  key={placement.id}
                  type="button"
                  onClick={() => setPlaybook(placement.id)}
                  className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-neutral-300 hover:text-white"
                >
                  {placement.client_name}
                  {placement.live ? '' : ' (ended)'} · playbook
                </button>
              ))}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-neutral-500">View As history</summary>
              <div className="mt-2">
                <OperatorSessions operatorId={row.id} />
              </div>
            </details>
          </li>
        ))}
      </ul>
      {playbook ? <PlaybookEditor placementId={playbook} onClose={() => setPlaybook(null)} /> : null}
    </div>
  );
}

function Stat({ label, value, alert, extra }: { label: string; value: number; alert?: boolean; extra?: string }) {
  return (
    <span className={`rounded-full px-3 py-1 ${alert ? 'bg-flag-critical/[0.12] text-flag-critical' : 'bg-white/[0.04] text-neutral-300'}`}>
      {label}: {value}
      {extra ? ` (${extra})` : ''}
    </span>
  );
}
