import { redirect } from 'next/navigation';
import { placementFormOptions, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { PageHeader } from '../../../components/ui';
import PlacementForm from '../../components/PlacementForm';

export default async function NewPlacementPage() {
  if ((await salesOpsRole()) !== 'admin') redirect('/workspace/sales-ops/placements');
  const options = await placementFormOptions();
  return (
    <>
      <PageHeader
        title="New placement"
        description="It starts as Pending. Add positive outcomes on the next screen, then activate it."
      />
      <PlacementForm options={options} />
    </>
  );
}
