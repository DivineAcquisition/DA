import Link from 'next/link';
import { formatAcademyDate, moduleStatusLabel } from '@/lib/academy/paths';
import type { AcademyModule } from '@/lib/academy/types';

function quizLine(module: AcademyModule): string | null {
  const quiz = module.quiz;
  if (!quiz || quiz.status === 'not_available') return null;
  if (quiz.status === 'passed') {
    const when = formatAcademyDate(quiz.passedAt);
    const score =
      quiz.passMarkUnit === 'percent'
        ? `${Math.round(((quiz.highestScore ?? 0) / Math.max(quiz.questionCount, 1)) * 100)}%`
        : `${quiz.highestScore ?? 0} of ${quiz.questionCount}`;
    return `Passed ${score}${when ? ` on ${when}` : ''}`;
  }
  if (quiz.retryBlock === 'acknowledge') return 'Locked until you confirm the plan';
  if (quiz.retryBlock === 'retest') return quiz.retestOn ? `Locked until ${quiz.retestOn}` : 'Locked until the re-test date';
  if (quiz.retryBlock === 'lessons') return 'Locked until you reopen the lessons in the plan';
  if (quiz.status === 'locked' && quiz.lockoutUntil) {
    return `Locked until ${new Date(quiz.lockoutUntil).toLocaleString()}`;
  }
  if (quiz.status === 'locked') return 'Locked until the lesson is reopened';
  if (quiz.status === 'in_progress') return 'Attempt in progress';
  return `${quiz.attemptsRemaining} attempts remaining`;
}

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
              {quizLine(module) ? <p className="mt-1 text-xs text-neutral-300">{quizLine(module)}</p> : null}
              {module.gates
                .filter((gate) => gate.key !== 'quiz' && gate.key !== 'agreement')
                .map((gate) => (
                  <p key={gate.id} className="mt-1 text-xs text-neutral-400">
                    {gate.key === 'sign_off' && gate.status === 'pending'
                      ? 'Supervisor sign-off is pending'
                      : `${gate.label}: ${gate.status === 'satisfied' ? 'Complete' : 'Pending'}`}
                    {gate.bestScore !== null ? ` · best ${gate.bestScore}` : ''}
                  </p>
                ))}
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
