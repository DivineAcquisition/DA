import QuizRunner, { type QuizState } from '@/app/academy/components/QuizRunner';
import { controlRpc } from '@/lib/ad/rpc';
import { academyContentOpen } from '@/lib/academy/types';
import { loadAcademyShell } from '@/lib/academy/load';
import { createClient } from '@/lib/supabase/server';

export default async function AcademyQuizPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  const supabase = await createClient();
  const { data } = await controlRpc<QuizState>(supabase, 'academy_quiz_state', { p_module_id: moduleId });
  if (!data) return null;
  return <QuizRunner moduleId={moduleId} initial={data} />;
}
