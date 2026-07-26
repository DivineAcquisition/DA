import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, Panel } from '@/app/vistrial/components/ui';
import { clientSignOutAction } from '@/lib/acct/actions';
import type { Database } from '@/lib/supabase/database.types';

type Account = Database['public']['Tables']['client_account']['Row'];

const NAV = [
  { href: '/acct', label: 'Overview' },
  { href: '/acct/growth', label: 'Growth' },
  { href: '/acct/reports', label: 'Reports' },
  { href: '/acct/billing', label: 'Billing' },
  { href: '/acct/files', label: 'Files' },
  { href: '/acct/messages', label: 'Messages' },
  { href: '/acct/settings', label: 'Settings' },
];

export default function ClientShell({
  account,
  businessName,
  email,
  children,
}: {
  account: Account;
  businessName: string;
  email: string;
  children: React.ReactNode;
}) {
  const suspended = account.state === 'suspended';
  const archived = account.state === 'archived';

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/acct" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <Logo markOnly className="h-6 w-auto" />
            <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-white">
              {businessName}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-40 truncate text-[13px] text-neutral-400 sm:block">{email}</span>
            <form action={clientSignOutAction}>
              <button type="submit" className={`${btnSecondary} ${btnSizeSm}`}>
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5 sm:px-5">
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
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        {suspended && (
          <Panel className="mb-7 border-flag-critical/25 bg-flag-critical/[0.06] p-5">
            <Badge tone="critical">Account suspended</Badge>
            <p className="mt-2.5 text-sm leading-relaxed text-white">
              {account.suspended_reason ??
                'An invoice is unpaid. Access resumes as soon as payment clears.'}
            </p>
            <Link href="/acct/billing" className={`${btnSecondary} ${btnSizeSm} mt-4`}>
              Go to billing
            </Link>
          </Panel>
        )}

        {archived && (
          <Panel className="mb-7 border-flag-warning/25 bg-flag-warning/[0.06] p-5">
            <Badge tone="warning">Read-only</Badge>
            <p className="mt-2.5 text-sm leading-relaxed text-white">
              This engagement has ended. Your reports and your own uploads stay available
              {account.access_until ? ` until ${account.access_until}` : ' for a further period'}, so you have
              time to take copies of anything you need.
            </p>
          </Panel>
        )}

        {children}
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
        <p className="mx-auto max-w-6xl text-xs leading-relaxed text-neutral-600">
          Divine Acquisition. This dashboard shows your own operation only. Card details are handled by our
          payment processor and are never stored here.
        </p>
      </footer>
    </div>
  );
}
