import NewPlacement from '@/app/workspace/(staff)/sales-ops/components/NewPlacement';

export default async function TeamNewPlacementPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  return <NewPlacement draftId={draft} />;
}
