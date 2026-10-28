import { placementFormOptions } from '@/lib/workspace/sales-ops-queries';
import { PageHeader } from '../../../components/ui';
import PlacementForm from '../../components/PlacementForm';

export default async function NewPlacementPage() {
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
