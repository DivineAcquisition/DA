import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Avatar, Badge } from '@/app/vistrial/components/ui';
import { endImpersonationFormAction, signOutAction } from '@/lib/ad/actions';
import { roleLabel } from '@/lib/ad/types';
import type { SessionContext } from '@/lib/supabase/server';

const NAV = [
  { href: '/ad', label: 'Accounts' },
  { href: '/ad/invites', label: 'Invites' },
  { href: '/ad/audit', label: 'Audit' },
  { href: '/ad/credentials', label: 'Credentials' },
  { href: '/ad/alerts', label: 'Alerts' },
  { href: '/ad/lockdown', label: 'Lockdown' },
];

export default function ControlShell({
  session,
  children,
}: {
  session: SessionContext;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      {session.impersonation && (
        <div className="border-b border-flag-warning/30 bg-flag-warning/[0.12] px-5 py-2.5 text-sm text-flag-warning">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p>
              Viewing as{' '}
              <span className="font-semibold text-white">
                {session.impersonation.target_full_name ??
                  session.impersonation.target_email ??
                  'another account'}
              </span>
              . Actions are logged as you ({session.userId.slice(0, 8)}…). Financial, password,
              permission and delete actions stay blocked.
            </p>
            <form action={endImpersonationFormAction}>
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Exit impersonation
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/ad" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <Logo markOnly className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Vistrial<span className="ml-1.5 font-normal text-neutral-500">Control</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Badge tone="brand">{roleLabel(session.role)}</Badge>
            <span className="hidden items-center gap-2 sm:flex">
              <Avatar name={session.fullName ?? session.email} size="sm" />
              <span className="max-w-40 truncate text-[13px] text-neutral-300">
                {session.fullName ?? session.email}
              </span>
            </span>
            <form action={signOutAction}>
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs text-neutral-600">
          ad.divineacquisition.io — roles, auth and account oversight. Permissions are decided in
          Postgres; every refusal names the layer that said no.
        </p>
      </footer>
    </div>
  );
}
