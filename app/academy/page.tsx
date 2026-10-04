import Dashboard from './components/Dashboard';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';

export default async function AcademyHome() {
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  return <Dashboard shell={loaded.shell} />;
}
