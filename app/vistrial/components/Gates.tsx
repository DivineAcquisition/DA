'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Logo from '@/app/components/Logo';
import { btnSecondary } from '@/app/components/ui';
import { hubSignOutAction } from '@/lib/vistrial/authActions';

/**
 * A Sales Operator, or someone viewing as one, only ever sees the portal. Any
 * other hub address sends them there; the admin surfaces would be refused by the
 * database anyway.
 */
export function OperatorGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const inside = pathname.startsWith('/vistrial/operator');
  useEffect(() => {
    if (!inside) router.replace('/vistrial/operator');
  }, [inside, router]);
  return inside ? <>{children}</> : null;
}

const MANAGER_PATHS = ['/vistrial/team', '/vistrial/inbox', '/vistrial/ops'];

/** Managers work from their team page: the operators in their scope, and View As. */
export function ManagerShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = MANAGER_PATHS.some((path) => pathname.startsWith(path));
  const wide = pathname.startsWith('/vistrial/team/workspace');
  useEffect(() => {
    if (!allowed) router.replace('/vistrial/team/board');
  }, [allowed, router]);
  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-ink-950 text-white antialiased">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/vistrial/team/board" className="flex items-center gap-2">
            <Logo markOnly className="h-5 w-auto" />
            <span className="rounded-full border border-brand-400/40 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-100">Admin</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-[13px]">
            {[
              { href: '/vistrial/ops', label: 'Overview' },
              { href: '/vistrial/team', label: 'Team' },
              { href: '/vistrial/team/workspace', label: 'Team Workspace' },
              { href: '/vistrial/inbox', label: 'Inbox' },
            ].map((item) => {
              const current =
                item.href === '/vistrial/team'
                  ? pathname.startsWith(item.href) && !pathname.startsWith('/vistrial/team/workspace')
                  : pathname.startsWith(item.href);
              return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 ${current ? 'bg-brand-500/[0.14] text-brand-100' : 'text-neutral-400 hover:text-white'}`}
              >
                {item.label}
              </Link>
              );
            })}
            <form action={hubSignOutAction}>
              <button type="submit" className={`${btnSecondary} ml-1 px-3 py-1.5 text-xs`}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>{children}</main>
      <p className="pb-6 text-center text-xs text-neutral-600">Signed in as {name}</p>
    </div>
  );
}
