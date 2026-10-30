import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const FILTERS = new Set(['needs_review', 'needs_help', 'late', 'missed', 'escalated']);

/** The EOD queue lives on Team Workspace. This address stays as a bookmark. */
export default async function EodQueuePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const status = filter && FILTERS.has(filter) ? filter : 'needs_review';
  redirect(`/workspace/team/workspace/eods?status=${status}`);
}
