import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadPortal, type Rpc } from '@/lib/portal/load';
import type { PortalGhl } from '@/lib/ghl/types';
import type { AvailabilityData, LiveData, TasksData, TodayData } from '@/lib/portal/types';
import DayExtras from './components/DayExtras';
import { renderPortal } from './components/frame';
import GhlDay from './components/GhlDay';
import { ApplicantHome, TrainingHome, WaitingHome } from './components/StageHome';
import TodayView from './components/TodayView';

export const metadata: Metadata = { title: 'My Day' };
export const dynamic = 'force-dynamic';

type Home = {
  today: TodayData | null;
  live: LiveData | null;
  tasks: TasksData | null;
  availability: AvailabilityData | null;
  ghl: PortalGhl | null;
};

async function quiet<T>(promise: Promise<{ data: T | null; error: string | null }>): Promise<T | null> {
  return (await promise).data;
}

/** My Day for a placed VA; the home screen for every other stage. */
export default async function MyDayPage() {
  const load = await loadPortal<Home>('today', async (rpc: Rpc, placementId) => {
    const [today, live, tasks, availability, ghl] = await Promise.all([
      placementId ? quiet(rpc<TodayData>('portal_today', { p_placement_id: placementId })) : null,
      placementId ? quiet(rpc<LiveData>('portal_live', { p_placement_id: placementId })) : null,
      quiet(rpc<TasksData>('portal_tasks')),
      quiet(rpc<AvailabilityData>('portal_availability')),
      placementId ? quiet(rpc<PortalGhl>('portal_ghl')) : null,
    ]);
    return { data: { today, live, tasks, availability, ghl }, error: null };
  });

  if (load.kind === 'ready' && load.context.stage === 'inactive') redirect('/vistrial/operator/pay');

  return renderPortal(load, 'today', (data, _placementId, context) => {
    switch (context.stage) {
      case 'applicant':
        return <ApplicantHome />;
      case 'training':
        return <TrainingHome tasks={data.tasks} />;
      case 'waiting':
        return <WaitingHome availability={data.availability} />;
      default:
        return (
          <TodayView
            data={data.today}
            extras={
              <>
                <GhlDay data={data.ghl} />
                <DayExtras live={data.live} focus={context.focus} />
              </>
            }
          />
        );
    }
  });
}
