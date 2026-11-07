import Link from 'next/link';
import NewPlacement from '@/app/workspace/(staff)/sales-ops/components/NewPlacement';
import { DeskHeader } from '../../components/desk';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The placement wizard. It opens from a Ready operator (?operator=) or a
 * client case file (?client=), or continues a saved draft (?draft=). The other
 * side is chosen in step 1 or 2.
 */
export default async function NewPlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; operator?: string; client?: string }>;
}) {
  const { draft, operator, client } = await searchParams;
  const prefill = {
    operator_id: operator && UUID.test(operator) ? operator : undefined,
    case_file_id: client && UUID.test(client) ? client : undefined,
  };
  if (!draft && !prefill.operator_id && !prefill.case_file_id) {
    return (
      <div className="mx-auto max-w-2xl">
        <DeskHeader title="New placement" description="A placement starts from one side of the seat. Pick where to start." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/workspace/operators/ready" className="panel panel-hover rounded-2xl px-5 py-4">
            <span className="block font-medium text-white">From a Ready operator</span>
            <span className="text-sm text-neutral-400">Then choose the client in step 2.</span>
          </Link>
          <Link href="/workspace/clients" className="panel panel-hover rounded-2xl px-5 py-4">
            <span className="block font-medium text-white">From a client case file</span>
            <span className="text-sm text-neutral-400">Open the Team tab, then choose the operator in step 1.</span>
          </Link>
        </div>
      </div>
    );
  }
  return <NewPlacement draftId={draft} prefill={prefill} />;
}
