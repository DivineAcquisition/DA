import { formatDateTime } from '@/lib/workspace/format';
import { getWorkspaceSettings } from '@/lib/workspace/sales-ops-queries';
import { EmptyState, PageHeader } from '../../components/ui';
import WorkspaceSettingsForm from '../components/WorkspaceSettingsForm';

export default async function WorkspaceSettingsPage() {
  const settings = await getWorkspaceSettings();
  return (
    <>
      <PageHeader
        title="Workspace settings"
        description={
          settings
            ? `DA Admin only. Every change is audited. Last changed ${formatDateTime(settings.updated_at)}.`
            : 'DA Admin only. Every change is audited.'
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
