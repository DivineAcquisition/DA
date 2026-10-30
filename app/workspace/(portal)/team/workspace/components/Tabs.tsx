'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navSlots } from '@/lib/workspace/nav-slots';

const TABS = [
  { href: '/workspace/team/workspace', label: 'Today', exact: true, badge: '' as 'eods' | 'reports' | '' },
  { href: '/workspace/team/workspace/operators', label: 'Operators', badge: '' as const },
  { href: '/workspace/team/workspace/eods', label: 'EODs', badge: 'eods' as const },
  { href: '/workspace/team/workspace/reports', label: 'Reports', badge: 'reports' as const },
  { href: '/workspace/team/workspace/activity', label: 'Activity Log', badge: '' as const },
  ...(navSlots.teamPerformance
    ? [{ href: '/workspace/team/workspace/performance', label: 'Performance', badge: '' as const }]
    : []),
];

export default function WorkspaceTabs({ eods = 0, reports = 0 }: { eods?: number; reports?: number }) {
  const pathname = usePathname() ?? '';
  const counts = { eods, reports };
  return (
    <nav aria-label="Team Workspace" className="mb-5 flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = 'exact' in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        const badge = tab.badge ? counts[tab.badge] : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF] ${
              active ? 'bg-[#6A00FF]/20 text-white' : 'text-neutral-400 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {tab.label}
            {badge > 0 ? <span className="rounded-full bg-[#6A00FF] px-1.5 text-[10px] font-bold text-white">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
