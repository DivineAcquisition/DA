'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import Logo from '@/app/components/Logo';
import { btnSecondary } from '@/app/components/ui';
import SignOutButton from '@/app/components/auth/SignOutButton';
import { ThemeToggle } from '@/app/workspace/components/ThemeControls';
import { StatusPill } from '@/app/workspace/components/VistrialChrome';
import { buildNav, findActive, railRows, type NavCounts } from '@/lib/workspace/adminNav';
import { SectionTabs } from '@/app/workspace/components/SectionTabs';
import { managerPathAllowed } from '@/lib/workspace/manager-paths';
import '@/app/workspace/(staff)/workspace.css';

/**
 * A Sales Operator, or someone viewing as one, only ever sees the portal. Any
 * other hub address sends them there; the admin surfaces would be refused by the
 * database anyway.
 */
export function OperatorGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const inside = pathname.startsWith('/workspace/operator');
  useEffect(() => {
    if (!inside) router.replace('/workspace/operator');
  }, [inside, router]);
  return inside ? <>{children}</> : null;
}

const COLLAPSE_KEY = 'da-manager-sidebar-collapsed';
const COLLAPSE_EVENT = 'da-manager-sidebar-toggle';

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? '1' : '0');
  } catch {
    /* The sidebar still collapses for this visit. */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

/** Managers: Home, Team, and Inbox from the same list as DA Admin. Hidden screens redirect. */
export function ManagerShell({
  name,
  counts,
  children,
}: {
  name: string;
  counts?: NavCounts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const allowed = managerPathAllowed(pathname);
  const nav = buildNav({ showAcademy: false, showHolds: false, holdsOnly: false, role: 'manager', counts });
  const active = findActive(nav, pathname);
  useEffect(() => {
    if (!allowed) router.replace('/workspace/team/board');
  }, [allowed, router]);
  if (!allowed) return null;

  const links = nav.flatMap((group) => railRows(group));

  return (
    <div className="relative min-h-screen bg-ink-950 text-white antialiased lg:flex">
      <aside className={`da-admin-rail relative z-10 hidden shrink-0 flex-col lg:flex ${collapsed ? 'w-[76px]' : 'w-64'}`}>
        <div className={`flex h-14 items-center gap-2 border-b border-white/[0.06] ${collapsed ? 'justify-center px-2' : 'px-4'}`}>
          <Logo markOnly tone="current" className="h-5 w-auto text-[color:var(--strong)]" />
          {collapsed ? null : (
            <>
              <span className="text-sm font-semibold">Manager</span>
              <StatusPill>Team</StatusPill>
            </>
          )}
        </div>
        <nav aria-label="Manager" className="flex-1 space-y-4 overflow-y-auto p-3">
          {nav.map((group) => (
            <div key={group.id}>
              {collapsed || group.rail === 'tabs' ? null : (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{group.heading}</p>
              )}
              <ul className="space-y-0.5">
                {railRows(group).map((item) => {
                  const current = group.rail === 'tabs' ? active?.section.id === group.id : active?.item.href === item.href;
                  const Glyph = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF] ${
                          collapsed ? 'justify-center px-2 py-2' : 'justify-between px-2.5 py-2'
                        } ${current ? 'bg-[#6A00FF] text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'}`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Glyph className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
                          {collapsed ? null : <span className="truncate">{item.label}</span>}
                        </span>
                        {!collapsed && item.badge ? (
                          <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-bold">{item.badge}</span>
                        ) : null}
                        {collapsed && item.badge ? <span className="sr-only">{item.badge}</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <ThemeToggle className={collapsed ? 'mx-auto mb-2' : 'mb-2'} />
          <button
            type="button"
            onClick={() => writeCollapsed(!collapsed)}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`${btnSecondary} w-full px-3 py-2 text-xs`}
          >
            {collapsed ? '»' : 'Collapse'}
          </button>
          <SignOutButton label={collapsed ? 'Out' : 'Sign out'} className="mt-2" />
          {collapsed ? null : <p className="mt-2 truncate px-1 text-[11px] text-neutral-500">{name}</p>}
        </div>
      </aside>
      <div className="relative z-10 min-w-0 flex-1">
        <nav aria-label="Manager" className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 lg:hidden">
          <ThemeToggle className="mr-1 shrink-0" />
          {links.map((item) => {
            const current = item.label === active?.section.heading || active?.item.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${current ? 'bg-[#6A00FF] text-white' : 'text-neutral-300'}`}
              >
                {item.label}
                {item.badge ? <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px] font-bold">{item.badge}</span> : null}
              </Link>
            );
          })}
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <SectionTabs active={active} />
          {children}
        </main>
      </div>
    </div>
  );
}
