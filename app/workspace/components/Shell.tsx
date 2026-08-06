'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { signOutAction } from '@/lib/workspace/actions';
import { Button } from './ui';

const NAV = [
  { href: '/workspace/recipients', label: 'Recipients' },
  { href: '/workspace/agreements', label: 'Agreements' },
  { href: '/workspace/templates', label: 'Templates' },
  { href: '/workspace/calendar-links', label: 'Calendar links' },
  { href: '/workspace/settings', label: 'Settings' },
];

export default function Shell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen bg-[var(--ws-page)] text-[var(--ws-body)] antialiased">
      <Backdrop />
      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-[var(--ws-border)] bg-[var(--ws-page)]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-6">
            <Link href="/workspace/recipients" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
              <Logo className="h-[22px] w-auto sm:h-[26px]" />
              <span className="hidden font-[family-name:var(--font-plus-jakarta)] text-sm font-semibold tracking-tight text-white sm:inline">
                Admin
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                      active
                        ? 'bg-[var(--ws-accent)]/15 text-[var(--ws-accent)]'
                        : 'text-[var(--ws-dim)] hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="hidden max-w-48 truncate text-[13px] text-[var(--ws-dim)] sm:inline">{email}</span>
              <form action={signOutAction}>
                <Button type="submit" variant="secondary" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </header>

        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? 'bg-[var(--ws-accent)]/15 text-[var(--ws-accent)]'
                    : 'text-[var(--ws-dim)] hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
