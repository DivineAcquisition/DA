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

function ago(iso: string | null): string {
  if (!iso) return 'No activity yet';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

function Tile({ label, value, hint, tone = 'default' }: { label: string; value: number | string; hint?: string; tone?: 'default' | 'warn' | 'good' }) {
  const color = tone === 'warn' ? 'text-amber-300' : tone === 'good' ? 'text-flag-good' : 'text-white';
  return (
    <div className="panel rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function Pill({ tone, children }: { tone: 'good' | 'warn' | 'muted'; children: React.ReactNode }) {
  const styles = {
    good: 'border-flag-good/30 bg-flag-good/[0.08] text-flag-good',
    warn: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300',
    muted: 'border-white/10 bg-white/[0.03] text-neutral-400',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles}`}>{children}</span>;
}

/** The admin app's home. Every figure is a live count; nothing here is a default. */
export default async function OpsOverviewPage() {
  const { data, error } = await teamRead<Overview>('staff_ops_overview');
  if (error || !data) return <Refused error={error ?? 'Not available.'} />;
  const waiting = ATTENTION.filter((a) => data.attention[a.key] !== null && data.attention[a.key] !== undefined);
  const busy = waiting.filter((a) => (data.attention[a.key] ?? 0) > 0).sort((a, b) => (data.attention[b.key] ?? 0) - (data.attention[a.key] ?? 0));
  const needsWork = busy.reduce((sum, a) => sum + (data.attention[a.key] ?? 0), 0);
  const placements = data.clients.reduce((sum, c) => sum + c.placements, 0);
  const ready = data.clients.filter((c) => c.linked && c.ready).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Operations overview</h1>
        <p className="mt-1 text-sm text-neutral-400">Live from the database: clients, their GoHighLevel readiness, and what is waiting on someone.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Clients" value={data.clients.length} hint={`${ready} ready in GoHighLevel`} />
        <Tile label="Active placements" value={placements} />
        <Tile label="Needs attention" value={needsWork} tone={needsWork > 0 ? 'warn' : 'good'} hint={busy.length ? `${busy.length} ${busy.length === 1 ? 'queue' : 'queues'}` : 'Nothing waiting'} />
        <Tile label="Not ready" value={data.clients.length - ready} tone={data.clients.length - ready > 0 ? 'warn' : 'default'} hint="Not connected or failing checks" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="panel rounded-2xl p-4 xl:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-white">Needs attention</h2>
          {busy.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing is waiting on anyone right now.</p>
          ) : (
            <ul className="space-y-1.5">
              {busy.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm transition-colors hover:border-white/15 hover:bg-white/[0.05]">
                    <span className="text-neutral-200">{a.label}</span>
                    <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-sm font-semibold tabular-nums text-amber-300">{data.attention[a.key]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel overflow-hidden rounded-2xl xl:col-span-2">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <h2 className="text-sm font-semibold text-white">Clients</h2>
            <Link href="/vistrial/team/ghl" className="text-xs text-neutral-400 hover:text-white">All connections</Link>
          </div>
          {data.clients.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-neutral-500">No clients yet. A client appears here once its case file is created.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-y border-white/[0.06] text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                    <th className="px-4 py-2 font-semibold">Client</th>
                    <th className="px-4 py-2 font-semibold">GoHighLevel</th>
                    <th className="px-4 py-2 text-right font-semibold">Placements</th>
                    <th className="px-4 py-2 text-right font-semibold">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.clients.map((c) => (
                    <tr key={c.case_file_id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <Link href={`/vistrial/team/ghl/client/${c.case_file_id}`} className="font-medium text-neutral-100 hover:text-white">
                          {c.name}
                        </Link>
                        <span className="ml-2 text-xs capitalize text-neutral-500">{c.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {!c.linked ? <Pill tone="muted">Not connected</Pill> : c.ready ? <Pill tone="good">Ready</Pill> : <Pill tone="warn">Not ready</Pill>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-300">{c.placements}</td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-500">{ago(c.last_event_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <p className="text-sm text-neutral-500">
        How DA is keeping its own side: <Link href="/vistrial/team/scorecard" className="text-brand-200 underline-offset-2 hover:underline">open DA&apos;s scorecard</Link>.
      </p>
    </div>
  );
}
