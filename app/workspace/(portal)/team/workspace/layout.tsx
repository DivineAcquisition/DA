import { Plus_Jakarta_Sans } from 'next/font/google';
import WorkspaceTabs from './components/Tabs';

const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-team-display' });

export default function TeamWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} team-workspace`}>
      <style>{`.team-workspace h1,.team-workspace h2{font-family:var(--font-team-display),var(--font-inter),sans-serif;letter-spacing:-0.02em}`}</style>
      <WorkspaceTabs />
      {children}
    </div>
  );
}
