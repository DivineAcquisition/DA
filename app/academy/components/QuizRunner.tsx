'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { saveQuizAnswer, startQuiz, submitQuiz } from '@/lib/academy/quizActions';

type Option = { id: string; text: string };
type Question = {
  id: string;
  prompt: string;
  type?: string;
  scenario?: string | null;
  options: Option[];
  selected?: string | null;
  explanation?: string;
  correct_text?: string | null;
  your_text?: string | null;
  concept?: string;
};
type Concept = { tag?: string; lesson_id?: string | null; lesson_title?: string | null; module_id?: string | null };
type Reopen = { id?: string; title?: string; code?: string };
type Breakdown = { module_order?: number; module_title?: string; correct?: number; total?: number };

export type QuizState = {
  phase?: string;
  can_start?: boolean;
  blocked?: string | null;
  module_id?: string;
  module_title?: string;
  module_order?: number;
  kind?: string;
  rules?: string;
  pass_mark_label?: string;
  questions_per_attempt?: number;
  attempts_used?: number;
  attempts_allowed?: number;
  attempts_remaining?: number;
  lockout_until?: string | null;
  reopen?: Reopen[];
  warning?: string | null;
  attempt?: { id?: string; started_at?: string; time_limit_seconds?: number | null; questions?: Question[] } | null;
  result?: {
    score?: number;
    total?: number;
    pass_mark_label?: string;
    concepts?: Concept[];
    review?: Question[];
    breakdown?: Breakdown[];
    warning?: string | null;
    abandoned?: boolean;
  } | null;
};

function deviceType(): string {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia('(max-width: 767px)').matches) return 'phone';
  if (window.matchMedia('(pointer: coarse)').matches) return 'tablet';
  return 'desktop';
}

export default function QuizRunner({ moduleId, initial }: { moduleId: string; initial: QuizState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const submitted = useRef(false);
  const questions = state.attempt?.questions ?? [];
  const question = questions[index];
  const limit = state.phase === 'take' ? state.attempt?.time_limit_seconds : null;
  const startedAt = state.phase === 'take' ? state.attempt?.started_at : null;
  const remaining = limit && startedAt && now
    ? Math.max(0, Math.ceil((new Date(startedAt).getTime() + limit * 1000 - now) / 1000))
    : null;

  useEffect(() => {
    if (!limit || !startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [limit, startedAt]);

  useEffect(() => {
    if (remaining === 0 && state.phase === 'take' && state.attempt?.id && !submitted.current) {
      submitted.current = true;
      void submitQuiz(state.attempt.id).then((result) => {
        if (result.ok) {
          setState(result.state as QuizState);
          router.refresh();
        }
      });
    }
  }, [remaining, router, state.attempt?.id, state.phase]);

  async function begin() {
    setError(null);
    setPending(true);
    const result = await startQuiz(moduleId, deviceType());
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setState(result.state as QuizState);
      setIndex(0);
    }
  }

  async function choose(optionId: string) {
    if (!question || !state.attempt?.id) return;
    setError(null);
    const result = await saveQuizAnswer(state.attempt.id, question.id, optionId);
    if (!result.ok) setError(result.error);
    else setState(result.state as QuizState);
  }

  async function finish() {
    if (!state.attempt?.id) return;
    setPending(true);
    setError(null);
    const result = await submitQuiz(state.attempt.id);
    setPending(false);
    if (!result.ok) setError(result.error);
    else {
      setState(result.state as QuizState);
      router.refresh();
    }
  }

  const title = state.kind === 'final' ? 'Final Quiz' : `Module ${state.module_order} quiz`;

  return (
    <article className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">{state.module_title}</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      </div>

      {state.phase === 'unavailable' ? (
        <p className="text-sm leading-relaxed text-neutral-300">
          {state.blocked === 'lessons'
            ? 'Finish every lesson in this module before the quiz opens.'
            : 'This quiz is not available yet.'}
        </p>
      ) : null}

      {state.phase === 'held' ? (
        <p className="text-sm leading-relaxed text-neutral-300">This program is on hold. The quiz is closed.</p>
      ) : null}

      {state.phase === 'start' || state.phase === 'fail' ? (
        <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm leading-relaxed text-neutral-200">{state.rules}</p>
          <p className="text-sm text-neutral-300">
            Attempts used: {state.attempts_used ?? 0}. Remaining: {state.attempts_remaining ?? 0}. Pass mark: {state.pass_mark_label}.
          </p>
          {state.phase === 'fail' && state.result ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-base font-semibold">
                Score {state.result.score} of {state.result.total}. Pass mark {state.result.pass_mark_label}.
              </p>
              {state.result.abandoned ? <p className="text-sm text-neutral-300">This attempt was closed because it was left open.</p> : null}
              {state.warning ? <p className="text-sm font-semibold text-white">{state.warning}</p> : null}
              {state.lockout_until ? (
                <p className="text-sm text-neutral-300">Next attempt opens {new Date(state.lockout_until).toLocaleString()}.</p>
              ) : null}
              <ul className="space-y-1 text-sm">
                {(state.result.concepts ?? []).map((concept) => (
                  <li key={`${concept.tag}-${concept.lesson_id}`}>
                    {concept.lesson_id && concept.module_id ? (
                      <Link className="text-[#937DFF]" href={`/academy/modules/${concept.module_id}/lessons/${concept.lesson_id}`}>
                        {concept.tag}
                        {concept.lesson_title ? ` · ${concept.lesson_title}` : ''}
                      </Link>
                    ) : (
                      concept.tag
                    )}
                  </li>
                ))}
              </ul>
              {(state.reopen ?? []).length > 0 ? (
                <p className="text-sm text-neutral-300">Reopen every linked lesson before the next attempt.</p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={pending || !state.can_start}
            onClick={() => void begin()}
            className="min-h-11 w-full rounded-xl bg-[#6A00FF] text-sm font-semibold text-white disabled:opacity-40"
          >
            {state.phase === 'fail' ? 'Start next attempt' : 'Start quiz'}
          </button>
        </section>
      ) : null}

      {state.phase === 'take' && question ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between text-sm text-neutral-300">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            {remaining !== null ? (
              <span>
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
              </span>
            ) : null}
          </div>
          {question.scenario ? <p className="text-sm leading-relaxed text-neutral-300">{question.scenario}</p> : null}
          <h2 className="text-lg font-semibold leading-snug">{question.prompt}</h2>
          <div className="space-y-2">
            {question.options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => void choose(option.id)}
                className={`min-h-11 w-full rounded-xl border px-4 py-3 text-left text-base ${
                  question.selected === option.id ? 'border-[#937DFF] bg-[#6A00FF]/20' : 'border-white/10'
                }`}
              >
                {option.text}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className="min-h-11 text-sm text-[#937DFF] disabled:opacity-40">
              Back
            </button>
            {index < questions.length - 1 ? (
              <button type="button" onClick={() => setIndex((value) => value + 1)} className="min-h-11 text-sm text-[#937DFF]">
                Next
              </button>
            ) : (
              <button type="button" disabled={pending} onClick={() => void finish()} className="min-h-11 rounded-xl bg-[#6A00FF] px-4 text-sm font-semibold text-white disabled:opacity-40">
                Submit
              </button>
            )}
          </div>
        </section>
      ) : null}

      {state.phase === 'pass' && state.result ? (
        <section className="space-y-4">
          <p className="text-lg font-semibold">
            Passed. Score {state.result.score} of {state.result.total}.
          </p>
          {(state.result.breakdown ?? []).length > 0 ? (
            <ul className="space-y-1 text-sm text-neutral-200">
              {state.result.breakdown?.map((row) => (
                <li key={row.module_order}>
                  Module {row.module_order}. {row.module_title}: {row.correct} of {row.total}
                </li>
              ))}
            </ul>
          ) : null}
          <ol className="space-y-4">
            {(state.result.review ?? []).map((item, itemIndex) => (
              <li key={item.id} className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs text-neutral-400">Question {itemIndex + 1}</p>
                {item.scenario ? <p className="mt-2 text-sm text-neutral-300">{item.scenario}</p> : null}
                <p className="mt-1 font-semibold">{item.prompt}</p>
                <p className="mt-2 text-sm">Your answer: {item.your_text ?? 'Blank'}</p>
                <p className="text-sm">Correct answer: {item.correct_text}</p>
                {item.explanation ? <p className="mt-2 text-sm leading-relaxed text-neutral-300">{item.explanation}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-200">{error}</p> : null}
      <Link href={`/academy/modules/${moduleId}`} className="inline-flex min-h-11 items-center text-sm text-[#937DFF]">
        Back to the module
      </Link>
    </article>
  );
}
