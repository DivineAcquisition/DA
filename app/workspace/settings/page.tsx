import SettingsForm from '../components/SettingsForm';
import { EmptyState, PageHeader } from '../components/ui';
import { getSettings } from '@/lib/workspace/queries';

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="animate-rise">
      <PageHeader
        title="Settings"
        description="DocuSeal credentials, webhook secret, and public URL configuration. Values are stored in the database."
      />
      {!settings ? (
        <EmptyState
          title="Settings unavailable"
          description="Could not load settings. Confirm the database migration has been applied."
        />
      ) : (
        <SettingsForm settings={settings} />
      )}
    </div>
  );
}
