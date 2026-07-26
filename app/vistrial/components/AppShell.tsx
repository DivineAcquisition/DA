'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { hubSignOutAction } from '@/lib/vistrial/authActions';
import { formatDayLong } from '@/lib/vistrial/format';
import { useOps } from '@/lib/vistrial/store';
import { Avatar, Badge, Panel } from './ui';

type NavItem = { href: string; label: string; badge?: number };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { gateway, actor } = useOps();
  const pathname = usePathname();

  const nav: NavItem[] = gateway.isAdmin
    ? [
        { href: '/vistrial/admin', label: 'Today', badge: gateway.exceptions().length },
        { href: '/vistrial/admin/clients', label: 'Case files' },
        { href: '/vistrial/admin/operators', label: 'Operators' },
        { href: '/vistrial/admin/bookings', label: 'Booking review', badge: gateway.reviewQueue().length },
        {
          href: '/vistrial/admin/escalations',
          label: 'Escalations',
          badge: gateway.allEscalations().filter((item) => item.status === 'open').length,
        },
        { href: '/vistrial/admin/payroll', label: 'Payroll' },
        { href: '/vistrial/admin/notifications', label: 'Notifications' },
      ]
    : [
        { href: '/vistrial/operator', label: 'My shift' },
        { href: '/vistrial/operator/eod', label: 'End of day' },
        { href: '/vistrial/operator/bookings', label: 'Bookings' },
        { href: '/vistrial/operator/escalations', label: 'Escalations' },
        { href: '/vistrial/operator/pay', label: 'Pay' },
      ];

  const isActive = (href: string) =>
    href === '/vistrial/admin' || href === '/vistrial/operator'
      ? pathname === href
      : pathname.startsWith(href);


  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-white/[0.06] bg-ink-900/40 lg:flex lg:flex-col">
          <div className="flex h-16 items-center border-b border-white/[0.06] px-5">
            <Link href="/vistrial" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <Logo markOnly className="h-6 w-auto" />
              <span className="text-sm font-semibold tracking-tight text-white">
                Vistrial<span className="ml-1.5 font-normal text-neutral-500">Ops</span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-0.5 p-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                    : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {item.badge ? (
                  <span
                    className={`tabular-nums text-xs ${isActive(item.href) ? 'text-brand-300' : 'text-neutral-600'}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/[0.06] p-3">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
              Internal only
            </p>
            <p className="px-2 pb-3 text-xs leading-relaxed text-neutral-500">
              Clients have no access to any part of the hub.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/vistrial" className="flex items-center gap-2 lg:hidden">
                  <Logo markOnly className="h-5 w-auto" />
                  <span className="text-sm font-semibold text-white">Vistrial</span>
                </Link>
                <p className="hidden text-sm text-neutral-500 lg:block">
                  {formatDayLong(gateway.today)}
                </p>
              </div>

              <div className="relative flex items-center gap-2">
                <Badge tone={gateway.isAdmin ? 'brand' : 'neutral'}>
                  {gateway.isAdmin ? 'Admin' : 'Operator'}
                </Badge>
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3">
                  <Avatar name={actor.name} size="sm" />
                  <span className="max-w-32 truncate text-[13px] font-medium text-white">{actor.name}</span>
                </span>
                <form action={hubSignOutAction}>
                  <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                    Sign out
                  </button>
                </form>
              </div>
            </div>

            {/* Mobile nav */}
            <nav className="-mx-px flex gap-1 overflow-x-auto px-3 pb-2.5 lg:hidden">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-brand-500/[0.14] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                      : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {item.label}
                  {item.badge ? <span className="tabular-nums text-[11px] opacity-70">{item.badge}</span> : null}
                </Link>
              ))}
            </nav>
          </header>

          <main className="min-w-0 flex-1 px-4 py-7 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>

          <footer className="border-t border-white/[0.06] px-4 py-5 sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-600">
                Vistrial VA Ops Hub · internal to Divine Acquisition
              </p>
              <p className="text-xs text-neutral-600">Signed in as {actor.name}</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a refusal instead of an admin surface when an operator lands on one.
 * The gateway would throw regardless; this turns that into a readable screen.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { gateway, actor } = useOps();
  if (gateway.isAdmin) return <>{children}</>;

  return (
    <Panel className="px-6 py-14 text-center">
      <Badge tone="critical">Refused at the data layer</Badge>
      <h1 className="mt-4 text-xl font-semibold text-white">This surface is admin-only</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
        {actor.name} is signed in as an operator. Operators can read their own placements, logs, numbers
        and pay statements, and nothing else. The read gateway rejects the request rather than the UI
        hiding it.
      </p>
      <Link href="/vistrial/operator" className={`${btnSecondary} ${btnSizeSm} mt-6`}>
        Back to my shift
      </Link>
    </Panel>
  );
}
