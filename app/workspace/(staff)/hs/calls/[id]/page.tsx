import { notFound } from 'next/navigation';
import { getSettings } from '@/lib/workspace/queries';
import { getHsCallWorkspace, ensureHsCallInProgress } from '@/lib/workspace/hs-call-queries';
import { publicCalendarUrl } from '@/lib/workspace/paths';
import { signingPublicBaseUrl } from '@/lib/workspace/resolve-signing';
import HsCallWorkspace from '../components/HsCallWorkspace';

export const dynamic = 'force-dynamic';

export default async function HsCallWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packed = await getHsCallWorkspace(id);
  if (!packed) notFound();

  if (packed.call.status === 'scheduled') {
    const next = await ensureHsCallInProgress(id);
    if (next) packed.call.status = next;
  }

  const settings = await getSettings();
  const baseUrl = signingPublicBaseUrl(settings?.public_base_url);
  const calendarUrl = packed.call.calendar_token ? publicCalendarUrl(baseUrl, packed.call.calendar_token) : null;

  return (
    <HsCallWorkspace
      call={packed.call}
      answers={packed.answers}
      progress={packed.progress}
      calendarUrl={calendarUrl}
    />
  );
}
