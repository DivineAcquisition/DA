import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyHoldSession } from '@/lib/academy/access';
import { reviewPracticalItem } from '@/lib/academy/practiceAdmin';
import { createClient } from '@/lib/supabase/server';
import { Button, Textarea } from '../../../components/ui';

type Evidence = { id: string; label: string; kind: string; body?: string | null; has_file?: boolean; status: string; comment?: string | null };
type Submission = { id: string; created_at: string; submission_number: number; title: string; trainee_name: string; evidence: Evidence[] };
type Queue = { waiting?: number; submissions?: Submission[] };

export const metadata = { title: 'Practical review' };

export default async function PracticalQueuePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await academyHoldSession();
  if (!session) redirect('/workspace/login');
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await controlRpc<Queue>(supabase, 'academy_practical_queue');
  const submissions = data?.submissions ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Practical submissions</h1>
        <Link href="/workspace/academy/holds" className="text-sm text-neutral-400">Holds</Link>
      </div>
      <p className="text-sm text-neutral-400">{data?.waiting ?? 0} waiting. Oldest first.</p>
      {params.error ? <p className="text-sm text-flag-critical">{params.error}</p> : null}
      {submissions.length === 0 ? <p className="text-sm text-neutral-500">Nothing is waiting.</p> : null}
      {submissions.map((submission) => (
        <section key={submission.id} className="space-y-3 rounded-2xl border border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">{submission.trainee_name} · {submission.title}</h2>
          <p className="text-xs text-neutral-500">Submission {submission.submission_number} · {new Date(submission.created_at).toLocaleString()}</p>
          {(submission.evidence ?? []).map((item) => (
            <form key={item.id} action={reviewPracticalItem} className="space-y-2 rounded-xl border border-white/10 p-3 text-sm text-neutral-200">
              <input type="hidden" name="evidence" value={item.id} />
              <p className="text-white">{item.label}</p>
              {item.body ? <p>{item.body}</p> : null}
              {item.has_file ? <a href={`/workspace/academy/holds/practical-files/${item.id}`} className="text-[#937DFF]">Open screenshot</a> : null}
              <Textarea name="comment" rows={2} placeholder="Comment" />
              <div className="flex gap-2">
                <Button type="submit" name="status" value="pass">Pass</Button>
                <Button type="submit" name="status" value="needs_work" variant="secondary">Needs work</Button>
              </div>
            </form>
          ))}
        </section>
      ))}
    </div>
  );
}
