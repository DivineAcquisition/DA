import type { Metadata } from 'next';
import Link from 'next/link';
import { Refused, teamRead } from '../team/teamRead';

export const metadata: Metadata = { title: 'Operations overview' };
export const dynamic = 'force-dynamic';

type Overview = {
  is_admin: boolean;
  clients: { case_file_id: string; name: string; status: string; linked: boolean; ready: boolean; connection: string | null; placements: number; last_event_at: string | null }[];
  attention: Record<string, number | null>;
};

const ATTENTION: { key: string; label: string; href: string }[] = [
  { key: 'bookings_to_review', label: 'Bookings to review', href: '/vistrial/admin/bookings' },
  { key: 'escalations_open', label: 'Escalations to answer', href: '/vistrial/admin/escalations' },
  { key: 'shift_reviews_unconfirmed', label: 'Shift reviews left unconfirmed', href: '/vistrial/team/queues' },
  { key: 'disputes_open', label: 'Standard disputes', href: '/vistrial/team/queues' },
  { key: 'blockers_open', label: 'Open blockers', href: '/vistrial/team/queues' },
  { key: 'formal_notices_awaiting', label: 'Formal notices awaiting approval', href: '/vistrial/team/queues' },
  { key: 'pay_questions_open', label: 'Pay questions', href: '/vistrial/admin/payroll' },
  { key: 'leads_waiting', label: 'Leads waiting for a VA', href: '/vistrial/team/ghl/routing' },
  { key: 'ghl_actions_failed', label: 'Failed or blocked GHL actions', href: '/vistrial/team/ghl/access' },
  { key: 'ghl_access_mismatches', label: 'GHL access mismatches', href: '/vistrial/team/ghl/access' },
  { key: 'ghl_connections_failing', label: 'GHL connections failing', href: '/vistrial/team/ghl' },
  { key: 'unattributed_events', label: 'Unattributed GHL events', href: '/vistrial/team/ghl/activity' },
];

/** The admin app's home. Every figure is a live count; nothing here is a default. */
export default async function OpsOverviewPage() {
  const { data, error } = await teamRead<Overview>('staff_ops_overview');
  if (error || !data) return <Refused error={error ?? 'Not available.'} />;
  const waiting = ATTENTION.filter((a) => data.attention[a.key] !== null && data.attention[a.key] !== undefined);
  const busy = waiting.filter((a) => (data.attention[a.key] ?? 0) > 0);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-white">Operations overview</h1>

      <section className="panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Needs attention</h2>
        {busy.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing is waiting on anyone right now.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {busy.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm hover:bg-white/[0.06]">
                  <span className="text-neutral-200">{a.label}</span>
                  <span className="text-base font-semibold text-white">{data.attention[a.key]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel rounded-2xl p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Clients</h2>
        {data.clients.length === 0 ? (
          <p className="text-sm text-neutral-500">No clients yet. A client appears here once its case file is created.</p>
        ) : (
          <ul className="space-y-2">
            {data.clients.map((c) => (
              <li key={c.case_file_id}>
                <Link href={`/vistrial/team/ghl/client/${c.case_file_id}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm hover:bg-white/[0.06]">
                  <span className="min-w-0 flex-1 truncate text-neutral-100">{c.name}</span>
                  <span className="text-xs text-neutral-500">{c.status}</span>
                  <span className={`text-xs ${c.ready ? 'text-flag-good' : 'text-amber-300'}`}>
                    {!c.linked ? 'GHL not connected' : c.ready ? 'Ready' : 'Not ready'}
                  </span>
                  <span className="text-xs text-neutral-500">{c.placements} active placement{c.placements === 1 ? '' : 's'}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel rounded-2xl p-4">
        <h2 className="mb-1 text-sm font-semibold text-white">DA&apos;s own commitments</h2>
        <p className="text-sm text-neutral-400">
          How DA is keeping its side: <Link href="/vistrial/team/scorecard" className="text-brand-200 underline-offset-2 hover:underline">open DA&apos;s scorecard</Link>.
        </p>
      </section>
    </div>
  );
}
