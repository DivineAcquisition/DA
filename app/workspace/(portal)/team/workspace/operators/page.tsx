import type { Metadata } from 'next';
import { loadOperators } from '@/lib/sales-workspace/team-data';
import OperatorTable from '../components/OperatorTable';

export const metadata: Metadata = { title: 'Operators' };
export const dynamic = 'force-dynamic';

export default async function OperatorsPage() {
  const { data, error } = await loadOperators();
  if (error || !data) {
    return <p className="panel rounded-2xl px-5 py-4 text-sm text-flag-critical">{error ?? 'The roster did not load.'}</p>;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-white">Operators</h1>
        <p className="mt-1 text-sm text-neutral-400">Every operator, VA, and SDR, including those without a placement.</p>
      </div>
      <OperatorTable rows={data.operators} isAdmin={data.is_admin} />
    </div>
  );
}
