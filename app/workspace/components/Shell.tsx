'use client';

import { useState, useSyncExternalStore, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Settings,
  Stethoscope,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import Logo from '@/app/components/Logo';
import { signOutAction } from '@/lib/workspace/actions';

type Icon = ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
type NavItem = { href: string; label: string; icon: Icon; aliases?: string[] };
type NavGroup = { heading: string; items: NavItem[] };

/**
 * The admin portal's navigation. Three groups: how the business is running
 * today, who and what is being sold, and the settings behind it. Academy and
 * Holds are conditional: they appear only when the viewer has the role for them.
 */
const BASE_NAV: NavGroup[] = [
  {
    heading: 'Operations',
    items: [
      { href: '/vistrial/ops', label: 'Overview', icon: LayoutDashboard },
      { href: '/vistrial/team/board', label: 'Team', icon: Users, aliases: ['/vistrial/team'] },
      { href: '/vistrial/admin/clients', label: 'Clients', icon: Building2, aliases: ['/vistrial/admin'] },
      { href: '/vistrial/team/ghl', label: 'GoHighLevel', icon: Network },
    ],
  },
  {
    heading: 'Sales and talent',
    items: [
      { href: '/workspace/overview', label: 'VA performance', icon: Activity },
      { href: '/workspace/calls', label: 'Calls', icon: Phone, aliases: ['/workspace/hs/calls'] },
      { href: '/workspace/accounts', label: 'Accounts', icon: Stethoscope, aliases: ['/workspace/practices', '/workspace/hs/companies'] },
      { href: '/workspace/recipients', label: 'Recipients', icon: UserRoundCheck },
      { href: '/workspace/calendar-links', label: 'Calendar links', icon: CalendarDays },
    ],
  },
  {
    heading: 'Workspace',
    items: [{ href: '/workspace/settings', label: 'Settings', icon: Settings }],
  },
];

function buildNav({ showAcademy, showHolds, holdsOnly }: { showAcademy: boolean; showHolds: boolean; holdsOnly: boolean }): NavGroup[] {
  if (holdsOnly) {
    return [{ heading: 'Academy', items: [{ href: '/workspace/academy/holds', label: 'Holds', icon: CheckSquare }] }];
  }
  if (!showAcademy && !showHolds) return BASE_NAV;
  return BASE_NAV.map((group) => {
    if (group.heading !== 'Workspace') return group;
    const extras: NavItem[] = [];
    if (showAcademy) extras.push({ href: '/workspace/academy', label: 'Academy', icon: GraduationCap });
    if (showHolds) extras.push({ href: '/workspace/academy/holds', label: 'Holds', icon: CheckSquare });
    return { ...group, items: [...group.items, ...extras] };
  });
}

const COLLAPSE_KEY = 'da-admin-sidebar-collapsed';
const COLLAPSE_EVENT = 'da-admin-sidebar-toggle';

// A per-person convenience only: the page renders correctly without it.
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

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname === `${href}/` || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.aliases ?? [])].some((href) => pathMatches(pathname, href));
}

function initials(email: string) {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SidebarContent({
  pathname,
  nav,
  home,
  label,
  collapsed,
  pendingHref,
  onNavigate,
}: {
  pathname: string;
  nav: NavGroup[];
  home: string;
  label: string;
  collapsed: boolean;
  pendingHref?: string | null;
  onNavigate?: (href: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        href={home}
        prefetch
        onClick={() => onNavigate?.(home)}
        className={`flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.06] transition-opacity hover:opacity-80 ${collapsed ? 'justify-center px-0' : 'px-5'}`}
      >
        {collapsed ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-sm font-bold text-brand-200">D</span>
        ) : (
          <>
            <Logo className="h-[22px] w-auto" />
            <span className="rounded-md border border-brand-400/30 bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-200">{label}</span>
          </>
        )}
      </Link>

      <nav aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {nav.map((group) => (
          <div key={group.heading}>
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-white/[0.06]" aria-hidden="true" />
            ) : (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">{group.heading}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pendingHref
                  ? pathMatches(pendingHref, item.href) || (item.aliases ?? []).some((href) => pathMatches(pendingHref, href))
                  : isActive(pathname, item);
                const Glyph = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      title={collapsed ? item.label : undefined}
                      onClick={() => onNavigate?.(item.href)}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center rounded-lg text-[13.5px] font-medium transition-colors ${
                        collapsed ? 'h-10 justify-center' : 'gap-3 px-3 py-2'
                      } ${active ? 'bg-brand-500/[0.12] text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'}`}
                    >
                      {active ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-400" aria-hidden="true" /> : null}
                      <Glyph className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-300' : ''}`} strokeWidth={1.7} aria-hidden />
                      {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function UserMenu({ email }: { email: string }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-1 pr-3 text-sm text-neutral-300 transition-colors hover:border-white/20 hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/20 text-[11px] font-semibold text-brand-100">{initials(email)}</span>
        <span className="hidden max-w-[180px] truncate sm:block">{email}</span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-white/10 bg-ink-900 p-2 shadow-2xl">
        <p className="truncate px-3 py-2 text-xs text-neutral-500" title={email}>
          Signed in as <span className="text-neutral-300">{email}</span>
        </p>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/[0.05] hover:text-white">
            <LogOut className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export default function Shell({
  email,
  children,
  showAcademy = false,
  showHolds = false,
  holdsOnly = false,
}: {
  email: string;
  children: React.ReactNode;
  showAcademy?: boolean;
  showHolds?: boolean;
  holdsOnly?: boolean;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function toggleCollapsed() {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '0' : '1');
    } catch {
      /* storage can be blocked: the sidebar then simply does not remember */
    }
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  const nav = buildNav({ showAcademy, showHolds, holdsOnly });
  const home = holdsOnly ? '/workspace/academy/holds' : '/vistrial/ops';
  const label = holdsOnly ? 'Review' : 'Admin';
  const allItems = nav.flatMap((group) => group.items.map((item) => ({ ...item, group: group.heading })));

  const pendingItem = allItems.find((item) => item.href === pendingHref);
  const navigating = Boolean(pendingHref && pendingItem && !isActive(pathname, pendingItem));
  const current = allItems.find((item) => (navigating && pendingHref ? pathMatches(pendingHref, item.href) : isActive(pathname, item)));

  return (
    <div className="relative flex min-h-screen bg-ink-950 text-white antialiased">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-white/[0.06] bg-ink-900 transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-64'}`}
      >
        <SidebarContent
          pathname={pathname}
          nav={nav}
          home={home}
          label={label}
          collapsed={collapsed}
          pendingHref={navigating ? pendingHref : null}
          onNavigate={setPendingHref}
        />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/80" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.06] bg-ink-900 shadow-2xl">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" strokeWidth={1.7} aria-hidden />
            </button>
            <SidebarContent
              pathname={pathname}
              nav={nav}
              home={home}
              label={label}
              collapsed={false}
              pendingHref={navigating ? pendingHref : null}
              onNavigate={(href) => {
                setPendingHref(href);
                setDrawerOpen(false);
              }}
            />
          </div>
        </div>
      )}

      <div className={`relative z-10 flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-950/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/[0.05] hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.7} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden rounded-lg p-2 text-neutral-400 hover:bg-white/[0.05] hover:text-white lg:block"
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />}
          </button>

          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-neutral-500 sm:inline">{current?.group ?? label}</span>
            {current ? <ChevronRight className="hidden h-3.5 w-3.5 text-neutral-600 sm:block" aria-hidden /> : null}
            <span className="truncate font-medium text-white">{current?.label ?? label}</span>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {!holdsOnly ? (
              <Link
                href="/vistrial/team/ghl/activity"
                className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-white/20 hover:text-white md:flex"
              >
                <Link2 className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden />
                Live activity
              </Link>
            ) : null}
            <UserMenu email={email} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
