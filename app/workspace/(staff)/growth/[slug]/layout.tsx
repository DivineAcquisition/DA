import Link from 'next/link';
import { headers } from 'next/headers';

const SECTIONS = [
  ['', 'Overview'],
  ['/scope', 'Scope'],
  ['/baseline', 'Baseline'],
  ['/decisions', 'Decisions'],
  ['/effort', 'Effort'],
  ['/evidence', 'Evidence'],
  ['/milestones', 'Milestones'],
  ['/progress', 'Progress'],
  ['/reports', 'Reports'],
] as const;

/** Sections of one growth case file. Addresses stay the same. */
export default async function GrowthFileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pathname = (await headers()).get('x-pathname') ?? '';
  const base = `/workspace/growth/${slug}`;
  return (
    <div className="space-y-4">
      <nav aria-label="Case file" className="flex gap-1 overflow-x-auto">
        {SECTIONS.map(([suffix, label]) => {
          const href = `${base}${suffix}`;
          const active = suffix === '' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${active ? 'bg-[#6A00FF]/20 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
