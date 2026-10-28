import type { Metadata } from 'next';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { STATUS_LABEL } from '@/lib/sales-workspace/view';
import type { WorkspaceStatus } from '@/lib/sales-workspace/types';
import { createClient } from '@/lib/supabase/server';
import TeamNav from '../TeamNav';
import WorkspaceSubnav from './Subnav';

export const metadata: Metadata = { title: 'Sales workspace' };
export const dynamic = 'force-dynamic';

type Row = {
  placement_id: string;
  operator_name: string;
  client_name: string;
  status: WorkspaceStatus;
  shift: string;
  time_zone: string;
  eod_deadline: string;
  manager_name: string | null;
};

/**
 * The operators on placements assigned to this manager. DA Admin sees every
 * workspace placement. The database decides who appears; this page lists it.
 */
export default async function TeamWorkspacePage() {
  const supabase = await createClient();
  const { data, error } = await controlRpc<Row[]>(supabase, 'so_manager_operators');
  const rows = data ?? [];

  return (
    <>
      <TeamNav />
      <WorkspaceSubnav current="operators" />
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Sales workspace</h1>
        <p className="mt-1 text-sm text-neutral-400">Operators on the placements assigned to you.</p>
      </div>
      {error ? (
        <p className="panel rounded-2xl px-5 py-4 text-sm text-red-300">{readable(error)}</p>
      ) : rows.length === 0 ? (
        <section className="panel rounded-2xl px-6 py-12 text-center">
          <p className="text-sm font-medium text-neutral-200">No operators assigned to you yet.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
            They appear here once DA Admin names you as the manager on a placement.
          </p>
        </section>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.placement_id} className="panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4">
              <div>
                <p className="font-medium text-white">{row.operator_name}</p>
                <p className="text-sm text-neutral-400">{row.client_name}</p>
              </div>
              <div className="text-right text-sm text-neutral-400">
                <p>
                  {row.shift} · EOD {row.eod_deadline} <span className="text-neutral-500">{row.time_zone}</span>
                </p>
                <p className="text-xs text-neutral-500">{STATUS_LABEL[row.status] ?? row.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
