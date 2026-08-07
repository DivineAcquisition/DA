import Link from 'next/link';
import SyncDocuSealButton from '../components/SyncControls';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { ws } from '../components/tokens';
import { formatDate, formatDateTime, recipientTypeLabel } from '@/lib/workspace/format';
import {
  getLatestSyncRun,
  getSettings,
  listAgreementTemplates,
  listAgreements,
  listRecipients,
} from '@/lib/workspace/queries';
import type { AgreementStatus } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${ws.card} p-5`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
        {label}
      </p>
      <p className={`${ws.heading} mt-2 text-3xl font-semibold tabular-nums`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--ws-dim)]">{hint}</p>}
    </div>
  );
}

export default async function OverviewPage() {
  const [agreements, recipients, templates, settings, lastSync] = await Promise.all([
    listAgreements(),
    listRecipients(),
    listAgreementTemplates(),
    getSettings(),
    getLatestSyncRun(),
  ]);

  const count = (status: AgreementStatus) => agreements.filter((a) => a.status === status).length;
  const awaiting = count('sent') + count('viewed');
  const recent = agreements.slice(0, 8);
  const prefilledCount = agreements.filter(
    (a) => Object.keys(a.prefilled_values ?? {}).length > 0,
  ).length;

  return (
    <div className="animate-rise space-y-8">
      <PageHeader
        title="Overview"
        description="Everything DocuSeal knows, pulled into one place. Fields are mapped from the recipient record and their earlier answers before an agreement reaches the signer."
        actions={<SyncDocuSealButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Agreements" value={agreements.length} hint={`${prefilledCount} pre-filled`} />
        <Stat label="Awaiting signature" value={awaiting} hint={`${count('viewed')} opened`} />
        <Stat label="Completed" value={count('completed')} />
        <Stat
          label="Recipients"
          value={recipients.length}
          hint={`${templates.length} template${templates.length === 1 ? '' : 's'}`}
        />
      </div>

      <section className={`${ws.card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={`${ws.heading} text-base font-semibold`}>DocuSeal pull</h2>
            <p className="mt-1 text-sm text-[var(--ws-dim)]">
              {lastSync
                ? `Last run ${formatDateTime(lastSync.started_at)} · ${lastSync.templates_synced} templates, ${lastSync.submissions_synced} agreements, ${lastSync.values_captured} values captured.`
                : 'No pull has run yet. Add the API key in Settings, then pull.'}
            </p>
            {lastSync?.error && (
              <p className="mt-1 text-sm text-[var(--ws-error)]">{lastSync.error}</p>
            )}
          </div>
          <Link href="/workspace/settings" className="text-sm text-[var(--ws-accent)] hover:underline">
            Settings →
          </Link>
        </div>
        {settings && !settings.auto_prefill && (
          <p className="mt-3 text-sm text-[var(--ws-pending)]">
            Auto pre-fill is off — agreements are sent with tokenized pages only.
          </p>
        )}
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
          <h2 className={`${ws.heading} text-lg font-semibold`}>Latest agreements</h2>
          <Link href="/workspace/agreements" className="text-sm text-[var(--ws-accent)] hover:underline">
            All agreements →
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No agreements yet"
            description="Pull from DocuSeal to bring existing agreements in, or send one from a recipient."
          />
        ) : (
          <DataTable headers={['Recipient', 'Template', 'Status', 'Pre-filled', 'Sent']}>
            {recent.map((agreement) => (
              <tr key={agreement.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{agreement.recipient_name}</div>
                  <div className="text-xs text-[var(--ws-dim)]">
                    {recipientTypeLabel(agreement.recipient_type)}
                  </div>
                </td>
                <td className="px-4 py-3">{agreement.template_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={agreement.status} />
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--ws-dim)]">
                  {Object.keys(agreement.prefilled_values ?? {}).length}
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(agreement.sent_at)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>
    </div>
  );
}
