'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/workspace/sales-ops', label: 'Overview', exact: true },
  { href: '/workspace/sales-ops/placements', label: 'Placements' },
  { href: '/workspace/sales-ops/metrics', label: 'Metrics' },
  { href: '/workspace/sales-ops/targets', label: 'Default targets' },
  { href: '/workspace/sales-ops/tasks', label: 'Tasks' },
  { href: '/workspace/sales-ops/settings', label: 'Settings' },
];

export default function SalesOpsTabs() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Workspace setup" className="-mx-1 mb-8 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => {
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
