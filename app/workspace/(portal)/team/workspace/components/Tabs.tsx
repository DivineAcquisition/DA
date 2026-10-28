'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/workspace/team/workspace', label: 'Today', exact: true },
  { href: '/workspace/team/workspace/operators', label: 'Operators' },
  { href: '/workspace/team/workspace/eods', label: 'EODs' },
  { href: '/workspace/team/workspace/activity', label: 'Activity Log' },
];

export default function WorkspaceTabs() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Team Workspace" className="mb-5 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${
              active ? 'bg-brand-500/15 text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
