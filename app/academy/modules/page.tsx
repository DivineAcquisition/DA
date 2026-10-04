import ModuleList from '../components/ModuleList';
import { loadAcademyShell } from '@/lib/academy/load';
import { academyContentOpen } from '@/lib/academy/types';

export default async function AcademyModulesPage() {
  const loaded = await loadAcademyShell();
  if (!loaded.ok || !academyContentOpen(loaded.shell.state)) return null;
  return <ModuleList modules={loaded.shell.modules} />;
}
