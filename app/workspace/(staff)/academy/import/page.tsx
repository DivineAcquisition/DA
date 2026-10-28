import { redirect } from 'next/navigation';
import { academyAdminSession } from '@/lib/academy/access';
import { workspaceClient } from '@/lib/workspace/db';
import ImportForm from './ImportForm';

export const metadata = { title: 'Import Academy lessons' };

type ImportLog = {
  id: string;
  actor_id: string;
  file_name: string;
  created_at: string;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  detail: { lesson_id?: string; action?: string; message?: string }[] | null;
};

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

export default async function ImportPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const client = await workspaceClient();
  if (!client) return <ImportForm />;
  const { data } = await client
    .from('academy_import')
    .select('id, actor_id, file_name, created_at, created_count, updated_count, skipped_count, detail')
    .order('created_at', { ascending: false })
    .limit(25);
  const logs = (data ?? []) as ImportLog[];
  const actorIds = [...new Set(logs.map((log) => log.actor_id))];
  const { data: people } = actorIds.length
    ? await client.from('profile').select('id, email').in('id', actorIds)
    : { data: [] };
  const emails = new Map(((people ?? []) as { id: string; email: string | null }[]).map((person) => [person.id, person.email]));

  return (
    <div className="space-y-8">
      <ImportForm />
      <section className="mx-auto max-w-3xl space-y-3 px-4 pb-10">
        <h2 className="text-lg font-semibold text-white">Import log</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-neutral-400">No imports yet.</p>
        ) : (
          <ol className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="rounded-2xl border border-white/10 p-4 text-sm text-neutral-200">
                <p>
                  {emails.get(log.actor_id) ?? 'Academy admin'} · {when(log.created_at)} · {log.file_name}
                </p>
                <p className="mt-1 text-neutral-400">
                  {log.created_count} created, {log.updated_count} updated, {log.skipped_count} skipped.
                </p>
                <ul className="mt-2 space-y-1">
                  {(log.detail ?? []).map((row, index) => (
                    <li key={`${log.id}-${index}`}>
                      {row.action} {row.lesson_id}
                      {row.message ? `: ${row.message}` : ''}
                    </li>
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
