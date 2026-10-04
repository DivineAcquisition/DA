import Link from 'next/link';
import { redirect } from 'next/navigation';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { createClient } from '@/lib/supabase/server';
import SimChat from '@/app/academy/modules/[moduleId]/simulations/[simId]/SimChat';

type Preview = {
  phase?: string;
  simulation_id?: string;
  title?: string;
  brief?: string;
  status?: string;
  max_turns?: number;
  time_limit_seconds?: number | null;
  lead_first_at?: string | null;
  messages?: { role?: string; body?: string; at?: string }[];
};

export const metadata = { title: 'Simulation preview' };

export default async function SimulationPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ simId: string }>;
  searchParams: Promise<{ session?: string; error?: string }>;
}) {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  const { simId } = await params;
  const query = await searchParams;
  if (!query.session) redirect('/workspace/academy/simulations');
  const supabase = await createClient();
  const { data } = await controlRpc<Preview>(supabase, 'academy_sim_preview_state', { p_session: query.session });
  if (!data?.title || data.simulation_id !== simId) {
    return <p className="px-4 py-8 text-sm text-neutral-300">This preview is closed.</p>;
  }
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <Link href="/workspace/academy/simulations" className="text-sm text-neutral-400">Back</Link>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#937DFF]">Preview</p>
      <h1 className="text-2xl font-semibold text-white">{data.title}</h1>
      <p className="text-sm text-neutral-300">{data.brief}</p>
      <p className="text-sm text-neutral-400">This preview does not record an attempt or a score.</p>
      {query.error ? <p className="text-sm text-white">{query.error}</p> : null}
      <SimChat
        moduleId=""
        simId={simId}
        sessionId={query.session}
        status={data.status ?? 'open'}
        messages={data.messages ?? []}
        preview
        leadFirstAt={data.lead_first_at}
        timeLimitSeconds={data.time_limit_seconds}
        maxTurns={data.max_turns}
      />
    </div>
  );
}
