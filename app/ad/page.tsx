import Link from 'next/link';
import { Badge } from '@/app/vistrial/components/ui';
import { listAccounts, listOwnerAlerts } from '@/lib/ad/queries';
import { roleLabel, stateLabel } from '@/lib/ad/types';

function stateTone(state: string): 'good' | 'warning' | 'critical' | 'neutral' | 'brand' {
  if (state === 'active') return 'good';
  if (state === 'suspended' || state === 'locked') return 'critical';
  if (state === 'pending' || state === 'expired') return 'warning';
  return 'neutral';
}

export default async function AccountsPage() {
  const [accounts, alerts] = await Promise.all([listAccounts(), listOwnerAlerts()]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">Control plane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Lifecycle, identity, scope and overrides. Permissions are decided in Postgres; this page
            only asks.
          </p>
        </div>
        <Link
          href="/ad/invites"
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-brand-400"
        >
          Invite someone
        </Link>
      </div>

      {alerts.length > 0 && (
        <Link
          href="/ad/alerts"
          className="block rounded-2xl border border-flag-warning/25 bg-flag-warning/[0.08] px-4 py-3 text-sm text-flag-warning"
        >
          {alerts.length} owner alert{alerts.length === 1 ? '' : 's'} need attention →
        </Link>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/ad/accounts/${account.id}`} className="block">
                    <span className="font-medium text-white">{account.full_name ?? account.email}</span>
                    {account.full_name && (
                      <span className="mt-0.5 block text-xs text-neutral-500">{account.email}</span>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="brand">{roleLabel(account.role)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stateTone(account.state)}>{stateLabel(account.state)}</Badge>
                </td>
                <td className="hidden px-4 py-3 text-neutral-400 sm:table-cell">
                  {account.last_sign_in_at
                    ? new Date(account.last_sign_in_at).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-neutral-500">
                  No accounts visible for this session.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
