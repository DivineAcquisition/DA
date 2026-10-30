'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/workspace/sales-ops/settings', label: 'Settings', exact: true },
  { href: '/workspace/sales-ops/metrics', label: 'Metrics' },
  { href: '/workspace/sales-ops/targets', label: 'Targets' },
  { href: '/workspace/sales-ops/tasks', label: 'Tasks' },
];

/** Tabs on Sales settings. Workspace setup and placements stay linked from those screens. */
export default function SettingsNav() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Sales settings" className="mb-6 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const current = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF] ${
              current ? 'bg-[#6A00FF] text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
