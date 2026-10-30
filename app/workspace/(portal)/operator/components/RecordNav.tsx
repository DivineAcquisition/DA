import Link from 'next/link';

const ITEMS = [
  { key: 'record', label: 'Shift reviews', href: '/workspace/operator/record' },
  { key: 'bookings', label: 'Bookings', href: '/workspace/operator/bookings' },
  { key: 'escalations', label: 'Escalations', href: '/workspace/operator/escalations' },
  { key: 'reports', label: 'Attendance', href: '/workspace/operator/reports' },
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

export function WorkNav({ current }: { current: 'bookings' | 'client' }) {
  const items = [
    { key: 'bookings', label: 'Bookings', href: '/workspace/operator/bookings' },
    { key: 'client', label: 'Client', href: '/workspace/operator/client' },
  ];
  return (
    <nav aria-label="Work" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            item.key === current ? 'bg-[#6A00FF]/20 text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function SalesEodNav({ current }: { current: 'today' | 'past' | 'alerts' }) {
  const items = [
    { key: 'today', label: 'Today', href: '/workspace/operator/workspace/eod' },
    { key: 'past', label: 'Past EODs', href: '/workspace/operator/workspace/history' },
    { key: 'alerts', label: 'Alerts', href: '/workspace/operator/workspace/alerts' },
  ];
  return (
    <nav aria-label="EODs" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF] ${
            item.key === current ? 'bg-[#6A00FF] text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function TrainingNav({ current, academyHref }: { current: 'playbook' | 'standards'; academyHref: string }) {
  const items = [
    { key: 'playbook', label: 'Playbook', href: '/workspace/operator/playbook' },
    { key: 'standards', label: 'Standards', href: '/workspace/operator/standards' },
  ];
  return (
    <nav aria-label="Training" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === current ? 'page' : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#937DFF] ${
            item.key === current ? 'bg-[#6A00FF] text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <a
        href={academyHref}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[#937DFF] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#937DFF]"
      >
        Academy
      </a>
    </nav>
  );
}

export function GrowthNav({ current }: { current: 'growth' | 'pay' }) {
  const items = [
    { key: 'pay', label: 'Pay', href: '/workspace/operator/pay' },
    { key: 'growth', label: 'Growth & feedback', href: '/workspace/operator/growth' },
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
