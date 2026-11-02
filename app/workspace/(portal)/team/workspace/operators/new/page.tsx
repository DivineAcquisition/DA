import type { Metadata } from 'next';
import Link from 'next/link';
import { getSessionContext } from '@/lib/supabase/server';
import AddOperatorForm from './AddOperatorForm';

export const metadata: Metadata = { title: 'Add operator' };
export const dynamic = 'force-dynamic';

export default async function AddOperatorPage() {
  const session = await getSessionContext();
  if (!session?.isAdmin || session.impersonation) {
    return <p className="text-sm text-neutral-400">Add operator is for DA Admin.</p>;
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/workspace/team/workspace/operators" className="text-sm text-neutral-400">Operators</Link>
      <h1 className="text-2xl font-semibold text-white">Add operator</h1>
      <AddOperatorForm />
    </div>
  );
}
