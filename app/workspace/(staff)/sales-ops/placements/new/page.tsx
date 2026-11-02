import NewPlacement from '../../components/NewPlacement';

export default async function NewPlacementPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { draft } = await searchParams;
  return <NewPlacement draftId={draft} />;
}
