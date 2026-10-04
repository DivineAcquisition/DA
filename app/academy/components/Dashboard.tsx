import Link from 'next/link';
import { formatAcademyDate } from '@/lib/academy/paths';
import type { AcademyShell } from '@/lib/academy/types';

export default function Dashboard({ shell }: { shell: AcademyShell }) {
  const started = formatAcademyDate(shell.enrollment?.startDate);
  const target = formatAcademyDate(shell.enrollment?.targetDate);
  const granted = formatAcademyDate(shell.certification?.grantedAt);
  const recert = formatAcademyDate(shell.certification?.recertifyOn);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">DA Operator Academy</p>
        <h1 className="mt-2 text-2xl font-semibold">{shell.program?.name ?? 'Your program'}</h1>
        {shell.enrollment?.track ? <p className="mt-1 text-sm text-neutral-400">Track: {shell.enrollment.track}</p> : null}
      </div>

      {shell.banner ? (
        <p className="rounded-2xl border border-[#937DFF]/40 bg-[#6A00FF]/15 px-4 py-3 text-sm leading-relaxed text-white">
          {shell.banner}
        </p>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-neutral-300">Progress</h2>
        <p className="mt-2 text-lg font-semibold">
          {shell.progress.completed} of {shell.progress.total}{' '}
          {shell.progress.unit === 'lessons' ? 'lessons' : 'modules'} complete
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="presentation">
          <div className="h-full rounded-full bg-[#6A00FF]" style={{ width: `${Math.min(100, Math.max(0, shell.progress.percent))}%` }} />
        </div>
        <p className="mt-2 text-sm text-neutral-400">{shell.progress.percent}%</p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-neutral-300">Current module</h2>
        <p className="mt-2 text-lg font-semibold">{shell.currentModule?.title ?? 'None open'}</p>
        {shell.currentModule ? (
          <p className="mt-1 text-sm text-neutral-400">
            Module {shell.currentModule.order}
            {(() => {
              const quiz = shell.modules.find((item) => item.id === shell.currentModule?.id)?.quiz;
              if (!quiz || quiz.highestScore === null || quiz.status !== 'passed') return null;
              const score =
                quiz.passMarkUnit === 'percent'
                  ? `${Math.round((quiz.highestScore / Math.max(quiz.questionCount, 1)) * 100)}%`
                  : `${quiz.highestScore} of ${quiz.questionCount}`;
              return ` · Highest quiz score ${score}`;
            })()}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-neutral-300">Certification</h2>
        <p className="mt-2 text-lg font-semibold">{shell.certification?.label ?? 'No certification yet'}</p>
        {shell.certification?.vertical ? <p className="mt-1 text-sm text-neutral-400">{shell.certification.vertical}</p> : null}
        {granted ? <p className="mt-1 text-sm text-neutral-400">Granted {granted}</p> : null}
        {recert ? <p className="mt-1 text-sm text-neutral-400">Recertify by {recert}</p> : null}
      </section>

      {shell.nextAction ? (
        <section className="rounded-3xl border border-[#937DFF]/30 bg-[#6A00FF]/10 p-5">
          <h2 className="text-sm font-semibold text-[#937DFF]">Next</h2>
          <p className="mt-2 text-lg font-semibold">{shell.nextAction.title}</p>
          {shell.nextAction.detail ? <p className="mt-1 text-sm leading-relaxed text-neutral-300">{shell.nextAction.detail}</p> : null}
          {shell.nextAction.href ? (
            <Link
              href={shell.nextAction.href}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white"
            >
              Open
            </Link>
          ) : null}
        </section>
      ) : null}

      {started || target ? (
        <p className="text-sm text-neutral-400">
          {started ? `Started ${started}` : null}
          {started && target ? ' · ' : null}
          {target ? `Target ${target}` : null}
        </p>
      ) : null}
    </div>
  );
}
