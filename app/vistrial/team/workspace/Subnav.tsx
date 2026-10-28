import Link from 'next/link';

const LINKS = [
  { href: '/vistrial/team/workspace', label: 'Operators' },
  { href: '/vistrial/team/workspace/tasks', label: 'Tasks' },
];

export default function WorkspaceSubnav({ current }: { current: 'operators' | 'tasks' }) {
  return (
    <div className="mb-4 flex gap-2 text-sm">
      {LINKS.map((link) => {
        const active = (current === 'operators' && link.href === '/vistrial/team/workspace') || (current === 'tasks' && link.href.endsWith('/tasks'));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-3 py-1 ${active ? 'bg-brand-500/15 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
