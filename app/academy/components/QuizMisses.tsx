export type QuizMiss = {
  id: string;
  prompt: string;
  scenario?: string | null;
  your_text?: string | null;
  correct_text?: string | null;
  explanation?: string | null;
};

export function QuizMisses({ misses }: { misses: QuizMiss[] }) {
  if (misses.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C3B6FE]">Attempt 1 record</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-300">These are the answers you chose that were wrong.</p>
      </div>
      <ol className="space-y-3">
        {misses.map((miss, index) => (
          <li key={miss.id} className="rounded-2xl border border-red-400/30 bg-[#1c1218] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-200">Wrong · Question {index + 1}</p>
            {miss.scenario ? <p className="mt-2 text-sm leading-relaxed text-neutral-400">{miss.scenario}</p> : null}
            <p className="mt-1 text-sm font-semibold leading-snug text-white">{miss.prompt}</p>
            <p className="mt-3 text-sm text-red-100">You chose: {miss.your_text || 'No answer selected'}</p>
            {miss.correct_text ? <p className="mt-1 text-sm text-neutral-200">Correct answer: {miss.correct_text}</p> : null}
            {miss.explanation ? <p className="mt-2 text-sm leading-relaxed text-neutral-400">{miss.explanation}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
