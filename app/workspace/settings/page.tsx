import SettingsForm from '../components/SettingsForm';
import SyncDocuSealButton from '../components/SyncControls';
import { Badge, Card, EmptyState, PageHeader } from '../components/ui';
import { ws } from '../components/tokens';
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
        description="Booking links, company countersign, and the public URL. The signing key is read from the database or the server environment, not from this form."
        actions={<SyncDocuSealButton variant="secondary" />}
      />

      <Card as="section" className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className={`${ws.heading} text-base font-semibold`}>Signing</h2>
              {connection.state === 'connected' && <Badge tone="success">Connected</Badge>}
              {connection.state === 'error' && <Badge tone="error">Not connecting</Badge>}
              {connection.state === 'missing' && <Badge tone="pending">No API key</Badge>}
            </div>
            <p className="mt-1.5 text-sm text-[var(--ws-dim)]">
              {connection.state === 'connected' &&
                `${connection.templates} template${connection.templates === 1 ? '' : 's'} visible · key from ${
                  connection.source === 'database' ? 'the database' : 'the server environment'
                }.`}
              {connection.state === 'error' && connection.error}
              {connection.state === 'missing' &&
                'No signing key in the database or the server environment.'}
            </p>
            <p className="mt-1 text-sm text-[var(--ws-dim)]">
              {lastSync
                ? `Last pull ${formatDateTime(lastSync.started_at)} · ${lastSync.templates_synced} templates, ${lastSync.submissions_synced} agreements, ${lastSync.recipients_created} new recipients.`
                : 'No pull has run yet.'}
            </p>
            {lastSync?.error && <p className="mt-1 text-sm text-[var(--ws-error)]">{lastSync.error}</p>}
          </div>
        </div>
      </Card>

      {!settings ? (
        <EmptyState
          title="Settings unavailable"
          description="Could not load settings. Confirm the database migration has been applied."
        />
      ) : (
        <SettingsForm settings={{ ...settings, docuseal_api_key: '' }} />
      )}
    </div>
  );
}
