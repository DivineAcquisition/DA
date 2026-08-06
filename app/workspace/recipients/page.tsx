import Link from 'next/link';
import { CreateRecipientButton } from '../components/RecipientForms';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { formatDate, recipientTypeLabel } from '@/lib/workspace/format';
import { listRecipients } from '@/lib/workspace/queries';
import type { RecipientStatus, RecipientType } from '@/lib/workspace/types';

export default async function RecipientsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const type = (params.type as RecipientType | 'all' | undefined) ?? 'all';
  const status = (params.status as RecipientStatus | 'all' | undefined) ?? 'all';
  const q = params.q ?? '';

  const recipients = await listRecipients({ type, status, q });

  return (
    <div className="animate-rise">
      <PageHeader
        title="Recipients"
        description="Clients and operators who receive agreements and tokenized links."
        actions={<CreateRecipientButton />}
      />

      <form className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Search
          </span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, email, or business"
            className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[var(--ws-accent)]"
          />
        </label>
        <label className="block sm:w-40">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Type
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
        <label className="block sm:w-40">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
            Status
          </span>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] px-3.5 py-2.5 text-sm text-white outline-none focus:border-[var(--ws-accent)]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-full bg-[var(--ws-btn)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Filter
        </button>
      </form>

      {recipients.length === 0 ? (
        <EmptyState
          title="No recipients yet"
          description="Create a client or operator to start sending agreements and links."
        />
      ) : (
        <DataTable headers={['Name', 'Type', 'Email', 'Business', 'Status', 'Agreements', 'Created']}>
          {recipients.map((r) => (
            <tr key={r.id} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Link
                  href={`/workspace/recipients/${r.id}`}
                  className="font-medium text-white hover:text-[var(--ws-accent)]"
                >
                  {r.full_name}
                </Link>
              </td>
              <td className="px-4 py-3">{recipientTypeLabel(r.recipient_type)}</td>
              <td className="px-4 py-3">{r.email}</td>
              <td className="px-4 py-3">{r.business_name ?? '—'}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-4 py-3 tabular-nums">{r.agreements_count}</td>
              <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(r.created_at)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}
