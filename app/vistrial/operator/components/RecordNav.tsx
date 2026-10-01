import Link from 'next/link';

const ITEMS = [
  { key: 'record', label: 'Shift reviews', href: '/vistrial/operator/record' },
  { key: 'bookings', label: 'Bookings', href: '/vistrial/operator/bookings' },
  { key: 'escalations', label: 'Escalations', href: '/vistrial/operator/escalations' },
  { key: 'reports', label: 'Attendance', href: '/vistrial/operator/reports' },
];

/** The four parts of My Record. */
export default function RecordNav({ current }: { current: string }) {
  return (
    <nav aria-label="My Record" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            item.key === current ? 'bg-white/[0.08] text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function GrowthNav({ current }: { current: 'growth' | 'pay' }) {
  const items = [
    { key: 'pay', label: 'Pay', href: '/vistrial/operator/pay' },
    { key: 'growth', label: 'Growth & feedback', href: '/vistrial/operator/growth' },
  ];
  return (
    <nav aria-label="Pay & Growth" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            item.key === current ? 'bg-white/[0.08] text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
