import SettingsForm from '../components/SettingsForm';
import SyncDocuSealButton from '../components/SyncControls';
import { Badge, EmptyState, PageHeader, ws } from '../components/ui';
import { formatDateTime } from '@/lib/workspace/format';
import { getDocuSealConnection, getLatestSyncRun, getSettings } from '@/lib/workspace/queries';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const settings = await getSettings();
  const [connection, lastSync] = await Promise.all([
    getDocuSealConnection(settings),
    getLatestSyncRun(),
  ]);

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        title="Settings"
        description="DocuSeal credentials, automatic field mapping, and public URL configuration. Values are stored in the database."
        actions={<SyncDocuSealButton variant="secondary" />}
      />

      <section className={`${ws.card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className={`${ws.heading} text-base font-semibold`}>DocuSeal</h2>
              {connection.state === 'connected' && <Badge tone="success">Connected</Badge>}
              {connection.state === 'error' && <Badge tone="error">Not connecting</Badge>}
              {connection.state === 'missing' && <Badge tone="pending">No API key</Badge>}
            </div>
            <p className="mt-1.5 text-sm text-[var(--ws-dim)]">
              {connection.state === 'connected' &&
                `${connection.templates} template${connection.templates === 1 ? '' : 's'} visible · key from ${
                  connection.source === 'settings' ? 'Settings' : 'the DOCUSEAL_API_KEY environment variable'
                }.`}
              {connection.state === 'error' && connection.error}
              {connection.state === 'missing' &&
                'Add a key below, or set DOCUSEAL_API_KEY on the deploy, then pull.'}
            </p>
            <p className="mt-1 text-sm text-[var(--ws-dim)]">
              {lastSync
                ? `Last pull ${formatDateTime(lastSync.started_at)} · ${lastSync.templates_synced} templates, ${lastSync.submissions_synced} agreements, ${lastSync.recipients_created} new recipients.`
                : 'No pull has run yet.'}
            </p>
            {lastSync?.error && <p className="mt-1 text-sm text-[var(--ws-error)]">{lastSync.error}</p>}
          </div>
        </div>
      </section>

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
