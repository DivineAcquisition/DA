import type { Metadata } from 'next';
import Link from 'next/link';
import { listApplicants } from '@/lib/operators/desk';
import { markReviewingAction } from '@/lib/operators/actions';
import DeskForm from '../../components/DeskForm';
import { DeskHeader, Empty, Pill, Problem, secondary, when } from '../../components/desk';

export const metadata: Metadata = { title: 'Applicants' };
export const dynamic = 'force-dynamic';

export default async function ApplicantsPage() {
  const { data, error } = await listApplicants();
  if (!data) return <Problem>{error}</Problem>;
  return (
    <div>
      <DeskHeader
        title="Applicants"
        description="Sales Operator applications from the careers site, new and in review. Open one to read it, then decline it with a note or advance it. Advancing opens the operator file at Invited and sends the invite."
      />
      {data.length === 0 ? (
        <Empty>No open applications. New ones from the careers form land here.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.id} className="panel flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
              <Link href={`/workspace/operators/applicants/${row.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{row.full_name}</span>
                  <Pill tone={row.status === 'new' ? 'brand' : 'warn'}>{row.status === 'new' ? 'New' : 'In review'}</Pill>
                </span>
                <span className="mt-1 block truncate text-sm text-neutral-400">
                  {row.role_title} · {row.email} · received {when(row.received_at)}
                  {row.availability ? ` · available ${row.availability}` : ''}
                </span>
              </Link>
              {row.status === 'new' ? (
                <DeskForm action={markReviewingAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="application_id" value={row.id} />
                  <button type="submit" className={secondary}>
                    Mark in review
                  </button>
                </DeskForm>
              ) : null}
              <Link href={`/workspace/operators/applicants/${row.id}`} className="text-sm text-brand-200 hover:text-white">
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
