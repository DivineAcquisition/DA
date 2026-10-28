import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { controlRpc, readable } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';

type Preview = {
  title?: string;
  questions?: { id: string; prompt: string; scenario?: string | null; options: { id: string; text: string }[] }[];
};

export default async function QuizPreviewPage({ params }: { params: Promise<{ quizId: string }> }) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { quizId } = await params;
  const supabase = await createClient();
  const { data, error } = await controlRpc<Preview>(supabase, 'academy_preview_quiz', { p_quiz_id: quizId });
  if (error) {
    return <p className="px-4 py-8 text-sm text-amber-200">{readable(error)}</p>;
  }
  if (!data?.questions) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-8 text-white">
      <p className="rounded-2xl border border-[#937DFF]/40 bg-[#6A00FF]/15 px-4 py-3 text-sm">Preview. This does not record an attempt.</p>
      <h1 className="text-2xl font-semibold">{data.title}</h1>
      <ol className="space-y-4">
        {data.questions.map((question, index) => (
          <li key={question.id} className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-neutral-400">Question {index + 1} of {data.questions?.length}</p>
            {question.scenario ? <p className="mt-2 text-sm text-neutral-300">{question.scenario}</p> : null}
            <p className="mt-1 font-semibold">{question.prompt}</p>
            <ul className="mt-3 space-y-2">
              {question.options.map((option) => (
                <li key={option.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  {option.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <Link href={`/workspace/academy/quizzes/${quizId}`} className="inline-flex text-sm text-brand-200">
        Back to settings
      </Link>
    </div>
  );
}
