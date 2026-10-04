import Dashboard from './components/Dashboard';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';

export default async function AcademyHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  return <Dashboard shell={loaded.shell} error={params.error} />;
}
