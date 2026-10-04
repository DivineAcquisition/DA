import Link from 'next/link';
import { moduleStatusLabel } from '@/lib/academy/paths';
import type { AcademyModule } from '@/lib/academy/types';

function gateLabel(module: AcademyModule): string {
  const base =
    module.gateType === 'agreement'
      ? 'Agreement'
      : module.gateType === 'quiz'
        ? 'Quiz'
        : module.gateType === 'quiz_practical'
          ? 'Quiz and practical'
          : module.gateType === 'quiz_simulation'
            ? 'Quiz and simulation'
            : module.gateType === 'sign_off'
              ? 'Sign-off'
              : 'No quiz';
  return module.gateDetail ? `${base} · ${module.gateDetail}` : base;
}

export default function ModuleList({ modules }: { modules: AcademyModule[] }) {
  if (modules.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-2xl font-semibold">No modules yet.</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">This program has no modules on the record.</p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Modules</h1>
      <ol className="space-y-3">
        {modules.map((module) => {
          const label = moduleStatusLabel(module.display);
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-base font-semibold">
                  {module.order}. {module.title}
                </p>
                <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#937DFF]">
                  {label}
                </span>
              </div>
              {module.description ? <p className="mt-2 text-sm leading-relaxed text-neutral-300">{module.description}</p> : null}
              <p className="mt-2 text-xs text-neutral-500">{gateLabel(module)}</p>
            </>
          );
          const className = `block rounded-3xl border border-white/10 bg-white/[0.03] p-4 ${module.display === 'locked' ? 'opacity-70' : ''}`;
          return (
            <li key={module.id}>
              {module.openable ? (
                <Link href={`/academy/modules/${module.id}`} className={className}>
                  {inner}
                </Link>
              ) : (
                <article className={className}>{inner}</article>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
