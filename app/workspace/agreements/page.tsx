import { AgreementActions, SendAgreementButton } from '../components/AgreementForms';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { formatDate, recipientTypeLabel } from '@/lib/workspace/format';
import {
  listAgreementTemplates,
  listAgreements,
  listRecipients,
} from '@/lib/workspace/queries';
import type { AgreementStatus, RecipientType } from '@/lib/workspace/types';

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status as AgreementStatus | 'all' | undefined) ?? 'all';
  const type = (params.type as RecipientType | 'all' | undefined) ?? 'all';

  const [agreements, recipients, templates] = await Promise.all([
    listAgreements({ status, recipientType: type }),
    listRecipients(),
    listAgreementTemplates(),
  ]);

  return (
    <div className="animate-rise">
      <PageHeader
        title="Agreements"
        description="Sent agreements and their DocuSeal status."
        actions={
          <SendAgreementButton
            recipients={recipients.filter((r) => r.status === 'active')}
            templates={templates}
          />
        }
      />

      <form className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block sm:w-44">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Status
          </span>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[var(--ws-accent)]"
          >
            <option value="all">All</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </label>
        <label className="block sm:w-44">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Recipient type
          </span>
          <select
            name="type"
            defaultValue={type}
            className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[var(--ws-accent)]"
          >
            <option value="all">All</option>
            <option value="client">Client</option>
            <option value="operator">Operator</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-[var(--ws-btn)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </form>

      {agreements.length === 0 ? (
        <EmptyState
          title="No agreements yet"
          description="Send an agreement from here or from a recipient’s page."
        />
      ) : (
        <DataTable headers={['Recipient', 'Template', 'Status', 'Sent', 'Completed', 'Actions']}>
          {agreements.map((a) => (
            <tr key={a.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <div className="font-medium text-white">{a.recipient_name}</div>
                <div className="text-xs text-[var(--ws-dim)]">
                  {recipientTypeLabel(a.recipient_type)}
                </div>
              </td>
              <td className="px-4 py-3">{a.template_name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(a.sent_at)}</td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(a.completed_at)}</td>
              <td className="px-4 py-3">
                <AgreementActions
                  agreementId={a.id}
                  status={a.status}
                  signingUrl={a.signing_url}
                />
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
