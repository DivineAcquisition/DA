import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import QuestionForm from '../QuestionForm';

export default async function NewQuestionPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const supabase = await createClient();
  const [{ data: catalog }, { data: bank }] = await Promise.all([
    controlRpc<{ modules: { id: string; order: number; title: string; program: string }[] }>(supabase, 'academy_admin_catalog'),
    controlRpc<{ concepts: { id: string; module_id: string; name: string }[] }>(supabase, 'academy_admin_questions', { p_module_id: null }),
  ]);
  const modules = (catalog?.modules ?? []).map((module) => ({
    id: module.id,
    label: `${module.program} · ${module.order}. ${module.title}`,
  }));
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-white">New question</h1>
      <QuestionForm modules={modules} concepts={bank?.concepts ?? []} />
    </div>
  );
}
