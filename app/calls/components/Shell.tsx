import Link from 'next/link';
import Logo from '@/app/components/Logo';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Avatar, Badge } from '@/app/vistrial/components/ui';
import { signOutAction } from '@/lib/calls/actions';
import type { SessionContext } from '@/lib/supabase/server';

const NAV = [
  { href: '/calls', label: 'Leads' },
  { href: '/calls/phone', label: 'Log phone' },
  { href: '/calls/audit', label: 'Log audit' },
];

export default function Shell({
  session,
  children,
}: {
  session: SessionContext;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-6">
          <Link href="/calls" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            <Logo markOnly className="h-6 w-auto" />
            <span className="text-sm font-semibold tracking-tight text-white">
              Call Intelligence
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
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
            <Badge tone="brand">Internal</Badge>
            <span className="hidden items-center gap-2 md:flex">
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
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2.5 sm:hidden">
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
      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-white/[0.06] px-5 py-5 sm:px-6">
        <p className="mx-auto max-w-5xl text-xs text-neutral-600">
          Divine Acquisition internal. Reads and writes live to DA Pipeline — ClientAcquisition.
          Airtable stays the source of truth.
        </p>
      </footer>
    </div>
  );
}
