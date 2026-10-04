import Link from 'next/link';
import { redirect } from 'next/navigation';
import { academyAdminSession } from '@/lib/academy/access';
import { workspaceClient } from '@/lib/workspace/db';
import QuestionImportForm from './ImportForm';

type Log = {
  id: string;
  actor_id: string;
  file_name: string;
  created_at: string;
  created_count: number;
  skipped_count: number;
  detail: { prompt?: string; action?: string; message?: string }[] | null;
};

export default async function QuestionImportPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const client = await workspaceClient();
  const { data } = client
    ? await client.from('academy_question_import').select('id, actor_id, file_name, created_at, created_count, skipped_count, detail').order('created_at', { ascending: false }).limit(25)
    : { data: [] };
  const logs = (data ?? []) as Log[];
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <Link href="/workspace/academy/questions" className="text-sm text-neutral-400">Question bank</Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">Import questions</h1>
        <p className="mt-1 text-sm text-neutral-400">The preview saves nothing. Confirm writes only the valid rows.</p>
      </div>
      <QuestionImportForm />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Import log</h2>
        {logs.length === 0 ? <p className="text-sm text-neutral-400">No imports yet.</p> : (
          <ol className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="rounded-2xl border border-white/10 p-4 text-sm text-neutral-200">
                <p>{new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 16)} UTC · {log.file_name}</p>
                <p className="mt-1 text-neutral-400">{log.created_count} created, {log.skipped_count} skipped.</p>
                <ul className="mt-2 space-y-1">
                  {(log.detail ?? []).map((row, index) => (
                    <li key={`${log.id}-${index}`}>{row.action} {row.prompt}{row.message ? `: ${row.message}` : ''}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
