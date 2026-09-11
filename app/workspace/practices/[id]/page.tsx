import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PracticeIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/workspace/practices/${id}/audit`);
}
