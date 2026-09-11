import { notFound } from 'next/navigation';
import { getPracticeBundle } from '@/lib/workspace/practice-queries';
import AuditForm from '../../components/AuditForm';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = await getPracticeBundle(id);
  if (!bundle) notFound();
  return <AuditForm practiceId={bundle.practice.id} audit={bundle.audit} />;
}
