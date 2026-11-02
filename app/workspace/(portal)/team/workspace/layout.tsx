import { Plus_Jakarta_Sans } from 'next/font/google';
import { controlRpc } from '@/lib/ad/rpc';
import { createClient } from '@/lib/supabase/server';
import { loadNavCounts } from '@/lib/workspace/nav-counts';
import WorkspaceTabs from './components/Tabs';

const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-team-display' });

export default async function TeamWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const counts = await loadNavCounts();
  const supabase = await createClient();
  const launches = await controlRpc<number>(supabase, 'so_launch_attention_count');
  return (
    <div className={`${display.variable} team-workspace`}>
      <style>{`.team-workspace h1,.team-workspace h2{font-family:var(--font-team-display),var(--font-inter),sans-serif;letter-spacing:-0.02em}`}</style>
      <WorkspaceTabs eods={counts.eods} reports={counts.reports} launches={launches.data ?? 0} />
      {children}
    </div>
  );
}
