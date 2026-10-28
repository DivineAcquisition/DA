import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/workspace/queries';
import { getCallWorkspace, ensureCallInProgress } from '@/lib/workspace/call-queries';
import { publicCalendarUrl } from '@/lib/workspace/paths';
import { signingPublicBaseUrl } from '@/lib/workspace/resolve-signing';
import CallWorkspace from '../components/CallWorkspace';

export const dynamic = 'force-dynamic';

export default async function CallWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packed = await getCallWorkspace(id);
  if (!packed) notFound();

  if (packed.call.status === 'scheduled') {
    const next = await ensureCallInProgress(id);
    if (next) packed.call.status = next;
  }

  const settings = await getSettings();
  const baseUrl = signingPublicBaseUrl(settings?.public_base_url);
  const calendarUrl = packed.call.calendar_token ? publicCalendarUrl(baseUrl, packed.call.calendar_token) : null;

  return (
    <CallWorkspace
      call={packed.call}
      answers={packed.answers}
      progress={packed.progress}
      calendarUrl={calendarUrl}
    />
  );
}
