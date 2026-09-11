import { notFound } from 'next/navigation';
import { getPracticeBundle } from '@/lib/workspace/practice-queries';
import PracticeShell from '../components/PracticeShell';

export const dynamic = 'force-dynamic';

export default async function PracticeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getPracticeBundle(id);
  if (!bundle) notFound();

  return (
    <PracticeShell
      practice={bundle.practice}
      audit={bundle.audit}
      debrief={bundle.debrief}
      requirements={bundle.requirements}
    >
      {children}
    </PracticeShell>
  );
}
