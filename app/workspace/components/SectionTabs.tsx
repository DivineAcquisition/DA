import Link from 'next/link';
import type { ActiveMatch, NavLeaf } from '@/lib/workspace/adminNav';

function TabRow({
  label,
  tabs,
  currentHref,
}: {
  label: string;
  tabs: NavLeaf[];
  currentHref?: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const current = tab.href === currentHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm ${
              current
                ? 'da-primary font-medium text-white'
                : 'border border-white/10 text-neutral-300 hover:border-white/25 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.badge ? (
              <span className={`rounded-md px-1.5 text-[10px] font-bold ${current ? 'bg-white/20' : 'da-primary text-white'}`}>
                {tab.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** The pages that used to be extra sidebar rows, shown on the open screen. */
export function SectionTabs({ active }: { active: ActiveMatch | null }) {
  if (!active || active.section.rail !== 'tabs' || active.section.items.length < 2) return null;
  const nested = active.item.children ?? [];
  return (
    <div className="mb-6 space-y-2">
      <TabRow label={active.section.heading} tabs={active.section.items} currentHref={active.item.href} />
      {nested.length ? <TabRow label={active.item.label} tabs={nested} currentHref={active.child?.href} /> : null}
    </div>
  );
}
