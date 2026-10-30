import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDateTime } from '@/lib/workspace/format';
import { getWorkspaceSettings, salesOpsRole } from '@/lib/workspace/sales-ops-queries';
import { EmptyState, PageHeader } from '../../components/ui';
import SettingsNav from '../components/SettingsNav';
import WorkspaceSettingsForm from '../components/WorkspaceSettingsForm';

export default async function WorkspaceSettingsPage() {
  if ((await salesOpsRole()) !== 'admin') redirect('/workspace/sales-ops');
  const settings = await getWorkspaceSettings();
  return (
    <>
      <SettingsNav />
      <PageHeader
        title="Sales settings"
        description={
          settings
            ? `DA Admin only. Every change is audited. Last changed ${formatDateTime(settings.updated_at)}.`
            : 'DA Admin only. Every change is audited.'
        }
        actions={
          <Link href="/workspace/sales-ops" className="text-sm text-[var(--ws-dim)] hover:text-white">
            Workspace setup
          </Link>
        }
      />
      {settings ? (
        <WorkspaceSettingsForm settings={settings} />
      ) : (
        <EmptyState title="Settings not found." description="Run the workspace migration to create the settings row." />
      )}
    </>
  );
}
