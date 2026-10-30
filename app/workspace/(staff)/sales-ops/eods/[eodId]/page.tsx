import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** One EOD opens on Team Workspace, which has the same review actions. */
export default async function EodDetailRedirect({ params }: { params: Promise<{ eodId: string }> }) {
  const { eodId } = await params;
  redirect(`/workspace/team/workspace/eods/${eodId}`);
}
