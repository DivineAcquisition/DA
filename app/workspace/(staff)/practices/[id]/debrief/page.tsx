import { notFound } from 'next/navigation';
import { getPracticeBundle } from '@/lib/workspace/practice-queries';
import DebriefForm from '../../components/DebriefForm';

export const dynamic = 'force-dynamic';

export default async function DebriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPracticeBundle(id);
  if (!bundle) notFound();
  return <DebriefForm practiceId={bundle.practice.id} debrief={bundle.debrief} />;
}
