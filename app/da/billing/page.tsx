import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  type Tone,
} from '@/app/vistrial/components/ui';
import AdminGate from '../components/AdminGate';
import { listCaseFilesForBilling, listInvoices, listSubscriptions } from '@/lib/da/billing';
import InvoiceActions from '../components/InvoiceActions';
import NewInvoiceForms from '../components/NewInvoiceForms';

export const dynamic = 'force-dynamic';

const money = (value: number | string | null) =>
  value === null ? '—' : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  issued: 'brand',
  paid: 'good',
  overdue: 'warning',
  failed: 'critical',
  refunded: 'neutral',
  written_off: 'neutral',
};

export default async function BillingPage() {
  return (
    <AdminGate>
      <Billing />
    </AdminGate>
  );
}

async function Billing() {
  const [invoices, subscriptions, caseFiles] = await Promise.all([
    listInvoices(),
    listSubscriptions(),
    listCaseFilesForBilling(),
  ]);

  const failing = invoices.filter((invoice) => ['failed', 'overdue'].includes(invoice.status));
  const outstanding = invoices.filter((invoice) => ['issued', 'overdue', 'failed'].includes(invoice.status));
  const collected = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const drafts = invoices.filter((invoice) => invoice.status === 'draft');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Money in"
        title="Client billing"
        description="One-time fees, recurring retainers, and per-appointment charges computed from confirmed bookings. An invoice may only ever include a booking DA can evidence."
        actions={
          <>
            <Link href="/da/payouts" className={`${btnSecondary} ${btnSizeSm}`}>
              Payouts
            </Link>
            <Link href="/da/margin" className={`${btnSecondary} ${btnSizeSm}`}>
              Margin
            </Link>
          </>
        }
      />

      <StatGrid>
        <StatTile label="Collected" value={money(collected)} tone="good" />
        <StatTile
          label="Outstanding"
          value={money(outstanding.reduce((sum, invoice) => sum + Number(invoice.total), 0))}
          hint={`${outstanding.length} invoices`}
        />
        <StatTile
          label="Failing or overdue"
          value={String(failing.length)}
          hint="A failed payment nobody notices is a client who quietly left"
          tone={failing.length > 0 ? 'critical' : 'good'}
        />
        <StatTile label="Drafts" value={String(drafts.length)} hint="Editable until issued" />
      </StatGrid>

      {failing.length > 0 && (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
          <Badge tone="critical">Payment problems</Badge>
          <ul className="mt-3 space-y-2">
            {failing.map((invoice) => {
              const dunning = (invoice.dunning_event ?? []) as {
                id: string;
                step: number;
                action: string;
                next_attempt_at: string | null;
                detail: string | null;
              }[];
              const latest = dunning.sort((a, b) => b.step - a.step)[0];
              const client = invoice.client_case_file as { name: string } | null;

              return (
                <li key={invoice.id} className="text-[13px] leading-relaxed text-white">
                  <span className="font-medium">{client?.name}</span> · {invoice.number} ·{' '}
                  {money(invoice.total)} · {invoice.status}
                  {latest && (
                    <span className="text-neutral-400">
                      {' '}
                      — step {latest.step}, {latest.action.replace(/_/g, ' ')}
                      {latest.next_attempt_at && `, next attempt ${latest.next_attempt_at.slice(0, 10)}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <NewInvoiceForms caseFiles={caseFiles} />

      {subscriptions.length > 0 && (
        <section>
          <SectionHeader title="Recurring" hint="Retainers and bundled terms." />
          <Panel className="px-5 py-2">
            {subscriptions.map((subscription) => {
              const client = subscription.client_case_file as { name: string } | null;
              return (
                <div
                  key={subscription.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 border-t border-white/[0.05] py-3.5 first:border-t-0"
                >
                  <div>
                    <p className="text-[13px] font-medium text-white">{client?.name}</p>
                    <p className="text-[11px] text-neutral-600">
                      {subscription.charge_type.replace('_', ' ')} ·{' '}
                      {subscription.interval_months === 1 ? 'monthly' : `every ${subscription.interval_months} months`}
                      {subscription.current_period_end && ` · renews ${subscription.current_period_end}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={subscription.status === 'active' ? 'good' : 'warning'}>
                      {subscription.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[13px] font-semibold tabular-nums text-white">
                      {money(subscription.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </Panel>
        </section>
      )}

      <section>
        <SectionHeader title="Invoices" hint={`${invoices.length} in total.`} />
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <ul className="space-y-2.5">
            {invoices.map((invoice) => {
              const client = invoice.client_case_file as { name: string; slug: string } | null;
              const lines = (invoice.invoice_line ?? []) as {
                id: string;
                description: string;
                amount: number;
                booking_id: string | null;
              }[];
              const credits = (invoice.credit_note ?? []) as {
                id: string;
                amount: number;
                reason: string;
              }[];
              const attempts = (invoice.payment_attempt ?? []) as {
                id: string;
                status: string;
                attempted_at: string;
                failure_message: string | null;
              }[];

              return (
                <li key={invoice.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{invoice.number ?? 'Draft'}</p>
                          <Badge tone={STATUS_TONE[invoice.status] ?? 'neutral'}>
                            {invoice.status.replace('_', ' ')}
                          </Badge>
                          <Badge tone="neutral">{invoice.charge_type.replace(/_/g, ' ')}</Badge>
                          {lines.some((line) => line.booking_id) && (
                            <Badge tone="good">{lines.filter((l) => l.booking_id).length} confirmed bookings</Badge>
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-neutral-500">
                          {client && (
                            <Link href={`/da/${client.slug}`} className="hover:text-brand-200">
                              {client.name}
                            </Link>
                          )}
                          {invoice.period_start && ` · ${invoice.period_start} to ${invoice.period_end}`}
                          {invoice.due_at && ` · due ${invoice.due_at}`}
                        </p>
                        {credits.length > 0 && (
                          <p className="mt-1.5 text-xs text-neutral-500">
                            {credits.length} credit note{credits.length === 1 ? '' : 's'}:{' '}
                            {credits.map((credit) => credit.reason).join('; ')}
                          </p>
                        )}
                        {attempts.length > 0 && (
                          <p className="mt-1 text-[11px] text-neutral-600">
                            {attempts.length} payment attempt{attempts.length === 1 ? '' : 's'}
                            {attempts[0]?.failure_message && ` — ${attempts[0].failure_message}`}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-base font-semibold tabular-nums text-white">{money(invoice.total)}</p>
                        {Number(invoice.credited_total) > 0 && (
                          <p className="text-[11px] text-neutral-500">
                            {money(invoice.credited_total)} credited from {money(invoice.subtotal)}
                          </p>
                        )}
                      </div>
                    </div>

                    <InvoiceActions
                      invoiceId={invoice.id}
                      status={invoice.status}
                      lines={lines.map((line) => ({
                        id: line.id,
                        description: line.description,
                        amount: Number(line.amount),
                      }))}
                    />
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
