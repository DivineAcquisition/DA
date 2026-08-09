'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/app/components/Logo';
import Backdrop from '@/app/components/Backdrop';
import { signOutAction } from '@/lib/workspace/actions';
import { Button } from './ui';

type NavItem = { href: string; label: string; icon: NavIcon; match?: string };
type NavIcon =
  | 'grid'
  | 'people'
  | 'document'
  | 'stack'
  | 'link'
  | 'map'
  | 'gear'
  | 'growth'
  | 'billing'
  | 'control'
  | 'audit'
  | 'talent'
  | 'ops'
  | 'bookings';

/**
 * Agreements-focused admin nav. Growth / Control / Ops surfaces still exist
 * at their routes, but stay out of the sidebar until those products are the
 * daily admin workflow.
 */
const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Workspace',
    items: [
      { href: '/workspace/overview', label: 'Overview', icon: 'grid' },
      { href: '/workspace/recipients', label: 'Recipients', icon: 'people' },
      { href: '/workspace/agreements', label: 'Agreements', icon: 'document' },
      { href: '/workspace/templates', label: 'Pages & templates', icon: 'stack' },
      { href: '/workspace/mapping', label: 'Field mapping', icon: 'map' },
      { href: '/workspace/calendar-links', label: 'Calendar links', icon: 'link' },
      { href: '/workspace/settings', label: 'Settings', icon: 'gear' },
    ],
  },
];

const ICON_PATHS: Record<NavIcon, string> = {
  grid: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  people:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 2c-3 0-6 1.6-6 3.9V20h12v-3.1c0-2.3-3-3.9-6-3.9Zm8.5-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-.7 0-1.4.1-2 .3 1.2.9 2 2.1 2 3.6V20H23v-2.8c0-2-2.6-3.2-5.5-3.2Z',
  document: 'M7 3h7l5 5v13H7V3Zm6 1.5V9h4.5M10 13h7M10 17h7',
  stack: 'M12 3 3 7.5 12 12l9-4.5L12 3ZM3 12l9 4.5L21 12M3 16.5 12 21l9-4.5',
  link: 'M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.2 6M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7L12.8 18',
  map: 'M4 6h6M4 12h6M4 18h6M14 6h6M14 12h6M14 18h6M10 6l4 6M10 12l4-6M10 18l4-6',
  gear:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.4-2.1.1-1.4-.1-1.4 1.8-1.3-1.7-3-2.1.7a7.6 7.6 0 0 0-2.4-1.4L15.6 3H8.4l-.4 2.6a7.6 7.6 0 0 0-2.4 1.4l-2.1-.7-1.7 3 1.8 1.3-.1 1.4.1 1.4-1.8 1.3 1.7 3 2.1-.7c.7.6 1.5 1.1 2.4 1.4l.4 2.6h7.2l.4-2.6c.9-.3 1.7-.8 2.4-1.4l2.1.7 1.7-3-1.8-1.3Z',
  growth: 'M4 18 10 12l4 4 6-8M14 8h6v6',
  billing: 'M4 6h16v12H4V6Zm0 4h16M8 14h4',
  control: 'M12 3 4 7v5c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z',
  audit: 'M8 4h8v16H8V4Zm3 4h2M9 12h6M9 16h6',
  talent: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  ops: 'M4 8h16M4 12h16M4 16h10',
  bookings: 'M7 3v3M17 3v3M4 8h16v12H4V8Zm4 5h3v3H8v-3Z',
};

function NavIconGlyph({ icon }: { icon: NavIcon }) {
  const filled = icon === 'grid' || icon === 'people' || icon === 'talent';
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[icon]} />
    </svg>
  );
}

function isActive(pathname: string, item: NavItem) {
  const exact = pathname === item.href || pathname === `${item.href}/`;
  if (item.match && item.href === item.match) return exact;
  if (exact) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;
  // A child route owns the highlight — parents stay quiet.
  const allHrefs = NAV.flatMap((group) => group.items.map((entry) => entry.href));
  return !allHrefs.some(
    (href) =>
      href !== item.href &&
      href.startsWith(`${item.href}/`) &&
      (pathname === href || pathname.startsWith(`${href}/`)),
  );
}

function SidebarContent({
  pathname,
  email,
  onNavigate,
}: {
  pathname: string;
  email: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/workspace/overview"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-6 transition-opacity hover:opacity-80"
      >
        <Logo className="h-[26px] w-auto" />
        <span className="text-sm font-semibold tracking-tight text-white">Admin</span>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.heading}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              {group.heading}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-brand-500/[0.12] text-brand-100 ring-1 ring-inset ring-brand-500/25'
                          : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      <NavIconGlyph icon={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-5 py-4">
        <p className="truncate text-[13px] text-neutral-400" title={email}>
          {email}
        </p>
        <form action={signOutAction} className="mt-3">
          <Button type="submit" variant="secondary" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function Shell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentLabel =
    NAV.flatMap((group) => group.items).find((item) => isActive(pathname, item))?.label ?? 'Admin';

  return (
    <div className="relative flex min-h-screen bg-ink-950 text-white antialiased">
      <Backdrop />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/[0.06] bg-ink-900/60 backdrop-blur-xl lg:block">
        <SidebarContent pathname={pathname} email={email} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.06] bg-ink-900 shadow-2xl">
            <SidebarContent
              pathname={pathname}
              email={email}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/70 px-4 backdrop-blur-xl lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="rounded-xl border border-white/10 p-2 text-brand-300"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-white">{currentLabel}</span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
