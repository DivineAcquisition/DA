import { notFound } from 'next/navigation';
import { getPracticeBundle } from '@/lib/workspace/practice-queries';
import RequirementsForm from '../../components/RequirementsForm';

export const dynamic = 'force-dynamic';

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPracticeBundle(id);
  if (!bundle) notFound();
  return (
    <RequirementsForm
      practiceId={bundle.practice.id}
      requirements={bundle.requirements}
    />
  );
}
