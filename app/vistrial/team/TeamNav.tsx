'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/vistrial/team/board', label: 'Team board' },
  { href: '/vistrial/team/queues', label: 'Queues' },
  { href: '/vistrial/team/scorecard', label: "DA's scorecard" },
  { href: '/vistrial/team/matching', label: 'Availability' },
  { href: '/vistrial/team', label: 'Operators & View As', exact: true },
  { href: '/vistrial/team/ghl', label: 'GHL' },
  { href: '/vistrial/team/settings', label: 'Settings' },
];

export default function TeamNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Team" className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1">
      {ITEMS.map((item) => {
        const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              current ? 'bg-brand-500/[0.14] text-brand-100' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
