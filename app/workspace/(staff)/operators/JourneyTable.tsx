import Link from 'next/link';
import { STAGE_LABEL, type HireStage } from '@/lib/hire/rules';
import type { JourneyRow } from '@/lib/operators/desk';
import { Pill, when, type Tone } from '../components/desk';

export const STAGE_TONE: Record<HireStage, Tone> = {
  invited: 'neutral',
  onboarding: 'warn',
  ready: 'good',
  placed: 'brand',
  paused: 'warn',
  offboarded: 'bad',
};

export function StagePill({ stage }: { stage: HireStage }) {
  return <Pill tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage] ?? stage}</Pill>;
}

/** One row per operator journey. Each opens the operator file. */
export default function JourneyTable({ rows, empty, ready = false }: { rows: JourneyRow[]; empty: string; ready?: boolean }) {
  if (rows.length === 0) return <p className="panel rounded-2xl px-5 py-8 text-center text-sm text-neutral-400">{empty}</p>;
  return (
    <div className="panel overflow-x-auto rounded-2xl">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-5 py-3 font-medium">Operator</th>
            <th className="px-3 py-3 font-medium">Stage</th>
            <th className="px-3 py-3 font-medium">Readiness</th>
            <th className="px-3 py-3 font-medium">Manager</th>
            <th className="px-3 py-3 font-medium">Invited</th>
            <th className="px-3 py-3 font-medium">Signed in</th>
            {ready ? <th className="px-5 py-3 font-medium" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.operator_id} className="border-t border-white/[0.06]">
              <td className="px-5 py-3">
                <Link href={`/workspace/operators/${row.operator_id}`} className="font-medium text-white hover:text-brand-200">
                  {row.first_name} {row.last_name}
                </Link>
                <span className="block text-xs text-neutral-500">{row.work_email}</span>
              </td>
              <td className="px-3 py-3">
                <StagePill stage={row.stage} />
              </td>
              <td className="px-3 py-3 tabular-nums text-neutral-300">
                {row.met + row.waived} of 7{row.waived ? <span className="text-neutral-500"> · {row.waived} waived</span> : null}
              </td>
              <td className="px-3 py-3 text-neutral-300">{row.manager_name ?? <span className="text-amber-200">None</span>}</td>
              <td className="px-3 py-3 text-neutral-400">{when(row.invited_at)}</td>
              <td className="px-3 py-3 text-neutral-400">{when(row.signed_in_at)}</td>
              {ready ? (
                <td className="px-5 py-3 text-right">
                  <Link href={`/workspace/placements/new?operator=${row.operator_id}`} className="text-sm font-medium text-brand-200 hover:text-white">
                    Place
                  </Link>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
