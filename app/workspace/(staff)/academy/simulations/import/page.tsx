import Link from 'next/link';
import { redirect } from 'next/navigation';
import { academyAdminSession } from '@/lib/academy/access';
import { confirmSimulationImport, previewSimulationImport } from '@/lib/academy/practiceAdmin';
import CsvImport from '../../components/CsvImport';

export const metadata = { title: 'Import simulations' };

export default async function SimulationImportPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Import simulations</h1>
        <a href="/workspace/academy/simulations/template" className="text-sm text-neutral-300">Blank template</a>
      </div>
      <p className="text-sm text-neutral-400">Preview first. A problem is skipped in plain language. Confirm adds rows and does not delete anything.</p>
      <CsvImport label="Simulation file" preview={previewSimulationImport} confirm={confirmSimulationImport} />
      <Link href="/workspace/academy/simulations" className="text-sm text-neutral-400">Back to simulations</Link>
    </div>
  );
}
