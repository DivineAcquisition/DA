'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Health } from '@/lib/ghl/types';
import { inputClass, labelClass } from '../../components/ui';

const ITEMS = [
  { href: '/vistrial/team/ghl', label: 'Connections', exact: true },
  { href: '/vistrial/team/ghl/access', label: 'Access' },
  { href: '/vistrial/team/ghl/activity', label: 'Activity health' },
  { href: '/vistrial/team/ghl/routing', label: 'Routing log' },
  { href: '/vistrial/team/ghl/standard', label: 'Standard' },
];

export function GhlNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="GHL" className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1">
      {ITEMS.map((item) => {
        const current = item.exact ? pathname === item.href || pathname.startsWith('/vistrial/team/ghl/client') : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${current ? 'bg-white/[0.08] text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const TONE: Record<string, string> = {
  good: 'border-flag-good/30 bg-flag-good/[0.08] text-flag-good',
  warn: 'border-amber-400/30 bg-amber-400/[0.08] text-amber-300',
  bad: 'border-flag-critical/30 bg-flag-critical/[0.08] text-flag-critical',
  muted: 'border-white/10 bg-white/[0.03] text-neutral-400',
};

export function Pill({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}

export function HealthPill({ status }: { status: Health | null | undefined }) {
  if (!status) return <Pill tone="muted">Not connected</Pill>;
  const map: Record<Health, [keyof typeof TONE, string]> = {
    healthy: ['good', 'Healthy'],
    degraded: ['warn', 'Missing scopes'],
    failing: ['bad', 'Failing'],
    untested: ['muted', 'Untested'],
    retired: ['muted', 'Retired'],
  };
  const [tone, label] = map[status];
  return <Pill tone={tone}>{label}</Pill>;
}

export function Panel({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="panel rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function when(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 1) return 'just now';
  if (minutes >= 0 && minutes < 60) return `${minutes} min ago`;
  if (minutes >= 0 && minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The password field every connection change and access removal asks for. */
export function StepUpField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className={labelClass}>Confirm your password</span>
      <input type="password" autoComplete="current-password" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-500">{children}</p>;
}
