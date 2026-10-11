'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';
import {
  answerLessonQuiz,
  checkLessonAnswer,
  startLessonQuiz,
  submitLessonQuiz,
  type LessonQuizState,
} from '@/lib/academy/quizActions';
import { LessonSurface } from './LessonSurface';

type Question = {
  id: string;
  prompt: string;
  scenario?: string | null;
  options: { id: string; text: string }[];
};

export default function LessonQuiz({ lessonId, initial }: { lessonId: string; initial: LessonQuizState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<{ score: number; total: number; percent: number; passed: boolean } | null>(null);

  const liveQuestions = state.attempt?.questions ?? [];
  const previewQuestions = state.questions ?? [];
  const questions = (state.preview ? previewQuestions : liveQuestions) as Question[];
  const question = questions[index];
  const result = previewResult ?? state.result;

  async function openQuiz() {
    setError(null);
    setPreviewResult(null);
    if (state.preview) {
      setIndex(0);
      setSelected(null);
      setPreviewAnswers({});
      setOpen(true);
      return;
    }
    setPending(true);
    const started = await startLessonQuiz(lessonId);
    setPending(false);
    if (!started.ok) {
      setError(started.error);
      return;
    }
    setState(started.state);
    const first = started.state.attempt?.questions?.[0];
    const saved = first ? started.state.attempt?.answers?.[first.id] : null;
    setIndex(0);
    setSelected(saved ?? null);
    setOpen(true);
  }

  async function continueQuiz() {
    if (!question || !selected) return;
    setPending(true);
    setError(null);
    let nextAnswers = previewAnswers;
    if (!state.preview && state.attempt?.id) {
      const saved = await answerLessonQuiz(state.attempt.id, question.id, selected);
      setPending(false);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setState(saved.state);
      nextAnswers = saved.state.attempt?.answers ?? {};
    } else {
      nextAnswers = { ...previewAnswers, [question.id]: selected };
      setPreviewAnswers(nextAnswers);
      setPending(false);
    }
    if (index < questions.length - 1) {
      const next = questions[index + 1];
      setIndex(index + 1);
      setSelected(nextAnswers[next.id] ?? null);
      return;
    }
    await finish(nextAnswers);
  }

  async function finish(answers?: Record<string, string>) {
    setPending(true);
    if (state.preview) {
      let score = 0;
      const entries = Object.entries(answers ?? previewAnswers);
      for (const [questionId, optionId] of entries) {
        const checked = await checkLessonAnswer(questionId, optionId);
        if (checked.ok && checked.correct) score += 1;
      }
      const total = questions.length;
      const percent = total === 0 ? 0 : Math.round((score / total) * 1000) / 10;
      setPreviewResult({ score, total, percent, passed: total > 0 && (score / total) * 100 >= 85 });
      setPending(false);
      setIndex(questions.length);
      return;
    }
    if (!state.attempt?.id) {
      setPending(false);
      return;
    }
    const submitted = await submitLessonQuiz(state.attempt.id);
    setPending(false);
    if (!submitted.ok) {
      setError(submitted.error);
      return;
    }
    setState(submitted.state);
    setIndex(questions.length);
    if (submitted.state.result?.passed || submitted.state.passed) router.refresh();
  }

  if (!state.has_quiz) return null;

  const progress = questions.length === 0 ? 0 : Math.round(((Math.min(index, questions.length - 1) + (result ? 1 : 0)) / questions.length) * 100);

  return (
    <>
      <LessonSurface beam>
        <section className="space-y-3 p-5 sm:p-6">
          <AnimatedShinyText className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#C3B6FE]">
            Lesson quiz
          </AnimatedShinyText>
          <h2 className="text-2xl font-semibold tracking-tight">Pass this quiz to finish the lesson</h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            One question at a time. You need {state.pass_percent ?? 85} percent. {state.attempts_remaining ?? 3} of{' '}
            {state.attempts_allowed ?? 3} attempts left.
            {state.preview ? ' This preview does not record an attempt.' : ''}
          </p>
          {state.passed ? <p className="text-sm font-semibold text-[#C3B6FE]">Passed. You can mark the lesson complete.</p> : null}
          {!state.passed && (state.attempts_remaining ?? 1) === 0 ? (
            <p className="text-sm text-neutral-200">No attempts left on this lesson quiz.</p>
          ) : null}
          {error ? <p className="text-sm text-red-200">{error}</p> : null}
          {!state.passed && (state.preview || (state.attempts_remaining ?? 0) > 0) ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void openQuiz()}
              className="inline-flex min-h-11 items-center rounded-full bg-[#9A88FC] px-5 text-sm font-semibold text-[#07070b] disabled:opacity-40"
            >
              {state.attempt ? 'Continue the quiz' : 'Start the quiz'}
            </button>
          ) : null}
        </section>
      </LessonSurface>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6">
              <div className="w-full max-w-xl">
                <LessonSurface beam>
                  <div className="space-y-5 p-5 sm:p-7">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C3B6FE]">
                        {result ? 'Result' : `Question ${index + 1} of ${questions.length}`}
                      </p>
                      <button type="button" className="text-sm text-neutral-400" onClick={() => setOpen(false)}>
                        Close
                      </button>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-[#9A88FC]" style={{ width: `${result ? 100 : progress}%` }} />
                    </div>
                    {result ? (
                      <div className="space-y-3">
                        <h2 className="text-3xl font-semibold tracking-tight">{result.passed ? 'Passed' : 'Not yet'}</h2>
                        <p className="text-sm leading-relaxed text-neutral-200">
                          {result.score} of {result.total}. {result.percent} percent. You need {state.pass_percent ?? 85} percent.
                        </p>
                        {result.passed ? (
                          <p className="text-sm text-neutral-300">You can mark this lesson complete.</p>
                        ) : (
                          <p className="text-sm text-neutral-300">
                            {(state.attempts_remaining ?? 0) > 0
                              ? `${state.attempts_remaining} attempts left.`
                              : 'No attempts left.'}
                          </p>
                        )}
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center rounded-full bg-[#9A88FC] px-5 text-sm font-semibold text-[#07070b]"
                          onClick={() => setOpen(false)}
                        >
                          Back to the lesson
                        </button>
                      </div>
                    ) : question ? (
                      <div className="space-y-4">
                        {question.scenario ? <p className="text-sm leading-relaxed text-neutral-300">{question.scenario}</p> : null}
                        <h2 className="text-2xl font-semibold leading-snug tracking-tight">{question.prompt}</h2>
                        <div className="space-y-2">
                          {question.options.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelected(option.id)}
                              className={`min-h-14 w-full rounded-2xl border px-4 py-3 text-left text-base transition ${
                                selected === option.id ? 'border-[#C3B6FE] bg-[#6A00FF]/25' : 'border-white/10 hover:border-white/30'
                              }`}
                            >
                              {option.text}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            disabled={index === 0 || pending}
                            className="min-h-11 text-sm text-[#C3B6FE] disabled:opacity-40"
                            onClick={() => {
                              const previous = questions[index - 1];
                              setIndex(index - 1);
                              setSelected(
                                (state.preview ? previewAnswers[previous.id] : state.attempt?.answers?.[previous.id]) ?? null,
                              );
                            }}
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            disabled={!selected || pending}
                            onClick={() => void continueQuiz()}
                            className="inline-flex min-h-11 items-center rounded-full bg-[#9A88FC] px-5 text-sm font-semibold text-[#07070b] disabled:opacity-40"
                          >
                            {pending ? 'Saving…' : index === questions.length - 1 ? 'Submit' : 'Next'}
                          </button>
                        </div>
                        {error ? <p className="text-sm text-red-200">{error}</p> : null}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-300">This lesson has no quiz questions yet.</p>
                    )}
                  </div>
                </LessonSurface>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
