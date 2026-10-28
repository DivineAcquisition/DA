import Link from 'next/link';
import { redirect } from 'next/navigation';
import { academyAdminSession } from '@/lib/academy/access';
import { confirmDrillImport, previewDrillImport } from '@/lib/academy/practiceAdmin';
import CsvImport from '../../components/CsvImport';

export const metadata = { title: 'Import Signal Reading' };

export default async function DrillImportPage() {
  const session = await academyAdminSession();
  if (!session) redirect('/workspace/overview');
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Import Signal Reading</h1>
        <a href="/workspace/academy/drills/template" className="text-sm text-neutral-300">Blank template</a>
      </div>
      <p className="text-sm text-neutral-400">Preview first. Confirm adds items and does not delete the pool.</p>
      <CsvImport label="Drill file" preview={previewDrillImport} confirm={confirmDrillImport} />
      <Link href="/workspace/academy/simulations" className="text-sm text-neutral-400">Back to simulations</Link>
    </div>
  );
}
