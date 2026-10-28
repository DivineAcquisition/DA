'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/workspace/sales-ops', label: 'Overview', exact: true, admin: false },
  { href: '/workspace/sales-ops/placements', label: 'Placements', admin: false },
  { href: '/workspace/sales-ops/metrics', label: 'Metrics', admin: false },
  { href: '/workspace/sales-ops/targets', label: 'Default targets', admin: false },
  { href: '/workspace/sales-ops/settings', label: 'Settings', admin: true },
];

export default function SalesOpsTabs({ role = 'admin' }: { role?: 'admin' | 'manager' }) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Workspace setup" className="-mx-1 mb-8 flex gap-1 overflow-x-auto pb-1">
      {TABS.filter((t) => role === 'admin' || !t.admin).map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active ? 'bg-brand-500/15 text-white' : 'text-[var(--ws-dim)] hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
