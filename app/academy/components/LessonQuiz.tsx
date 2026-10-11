'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import { checkLessonAnswer } from '@/lib/academy/quizActions';
import { LessonSurface } from './LessonSurface';

export type LessonQuizQuestion = {
  id: string;
  prompt: string;
  scenario?: string | null;
  options: { id: string; text: string }[];
};

export type LessonQuizPack = {
  lesson_id?: string;
  module_id?: string;
  questions_per_attempt?: number | null;
  pass_mark_label?: string | null;
  questions?: LessonQuizQuestion[];
};

type Mark = { correct: boolean; explanation: string; correctText: string };

export default function LessonQuiz({
  moduleId,
  pack,
  scoredOpen,
}: {
  moduleId: string;
  pack: LessonQuizPack;
  scoredOpen: boolean;
}) {
  const questions = pack.questions ?? [];
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [pending, setPending] = useState<string | null>(null);

  async function choose(questionId: string, optionId: string) {
    if (marks[questionId] || pending) return;
    setPicks((current) => ({ ...current, [questionId]: optionId }));
    setPending(questionId);
    const result = await checkLessonAnswer(questionId, optionId);
    setPending(null);
    if (!result.ok) return;
    setMarks((current) => ({
      ...current,
      [questionId]: { correct: result.correct, explanation: result.explanation, correctText: result.correctText },
    }));
  }

  return (
    <LessonSurface beam>
      <section className="space-y-5 p-5 sm:p-6">
        <div>
          <AnimatedShinyText className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C3B6FE]">
            Lesson quiz
          </AnimatedShinyText>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Check this lesson</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            {questions.length} questions from this lesson.
            {pack.questions_per_attempt && pack.pass_mark_label
              ? ` The scored attempt draws ${pack.questions_per_attempt} and passes at ${pack.pass_mark_label}.`
              : ''}
          </p>
        </div>

        {questions.length === 0 ? (
          <p className="text-sm text-neutral-300">This lesson does not have quiz questions yet.</p>
        ) : (
          <ol className="space-y-4">
            {questions.map((question, index) => {
              const mark = marks[question.id];
              return (
                <li key={question.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Question {index + 1}</p>
                  {question.scenario ? <p className="mt-2 text-sm leading-relaxed text-neutral-300">{question.scenario}</p> : null}
                  <p className="mt-2 text-base font-semibold leading-snug">{question.prompt}</p>
                  <div className="mt-3 space-y-2">
                    {question.options.map((option) => {
                      const selected = picks[question.id] === option.id;
                      const revealed = Boolean(mark);
                      const tone = !revealed
                        ? selected
                          ? 'border-[#937DFF] bg-[#6A00FF]/20'
                          : 'border-white/10 hover:border-white/25'
                        : selected && mark?.correct
                          ? 'border-emerald-300/50 bg-emerald-400/10'
                          : selected
                            ? 'border-red-300/40 bg-red-400/10'
                            : 'border-white/10 opacity-70';
                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={revealed || pending === question.id}
                          onClick={() => void choose(question.id, option.id)}
                          className={`min-h-11 w-full rounded-xl border px-4 py-3 text-left text-sm transition ${tone}`}
                        >
                          {option.text}
                        </button>
                      );
                    })}
                  </div>
                  {mark ? (
                    <p className="mt-3 text-sm leading-relaxed text-neutral-200">
                      {mark.correct ? 'Correct. ' : `The answer is ${mark.correctText}. `}
                      {mark.explanation}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        <div className="border-t border-white/10 pt-4">
          {scoredOpen ? (
            <Link
              href={`/academy/modules/${moduleId}/quiz`}
              className="inline-flex min-h-11 items-center rounded-full bg-[#9A88FC] px-5 text-sm font-semibold text-[#07070b]"
            >
              Start the scored quiz
            </Link>
          ) : (
            <p className="text-sm leading-relaxed text-neutral-300">
              Mark this lesson complete to open the scored quiz. You can check the questions above before that.
            </p>
          )}
        </div>
      </section>
    </LessonSurface>
  );
}
