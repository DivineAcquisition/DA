import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  type Tone,
} from '@/app/vistrial/components/ui';
import { getInvoices, getMyAccount } from '@/lib/acct/queries';
import { money } from '../components/dashboard';
import InvoiceBreakdown from '../components/InvoiceBreakdown';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, Tone> = {
  paid: 'good',
  issued: 'brand',
  overdue: 'warning',
  failed: 'critical',
  refunded: 'neutral',
  written_off: 'neutral',
};

const CHARGE_LABEL: Record<string, string> = {
  audit_fee: 'Audit',
  install_fee: 'Install',
  retainer: 'Monthly retainer',
  bundled_term: 'Three-month term',
  performance: 'Per appointment',
};

export default async function ClientBilling() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const invoices = await getInvoices(account.case_file_id);
  const outstanding = invoices.filter((invoice) =>
    ['issued', 'overdue', 'failed'].includes(invoice.status),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Your invoices"
        description="Every invoice, and for per-appointment billing, the individual appointments behind the amount."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {outstanding.length > 0 && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">
            {outstanding.length} invoice{outstanding.length === 1 ? '' : 's'} outstanding
          </Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            {money(outstanding.reduce((sum, invoice) => sum + Number(invoice.total), 0))} awaiting payment.
            {outstanding.some((invoice) => invoice.status === 'failed') &&
              ' A payment attempt was declined; your card issuer will usually explain why.'}
          </p>
        </Panel>
      )}

      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" />
      ) : (
        <section>
          <SectionHeader title="History" hint={`${invoices.length} invoices.`} />
          <ul className="space-y-2.5">
            {invoices.map((invoice) => {
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
                issued_at: string;
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
                          <Badge tone="neutral">{CHARGE_LABEL[invoice.charge_type] ?? invoice.charge_type}</Badge>
                        </div>
                        <p className="mt-1.5 text-xs text-neutral-500">
                          {invoice.period_start
                            ? `${invoice.period_start} to ${invoice.period_end}`
                            : `Issued ${invoice.issued_at?.slice(0, 10) ?? '—'}`}
                          {invoice.due_at && ` · due ${invoice.due_at}`}
                          {invoice.paid_at && ` · paid ${invoice.paid_at.slice(0, 10)}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-base font-semibold tabular-nums text-white">
                          {money(Number(invoice.total))}
                        </p>
                        {Number(invoice.credited_total) > 0 && (
                          <p className="text-[11px] text-neutral-500">
                            {money(Number(invoice.credited_total))} credited
                          </p>
                        )}
                      </div>
                    </div>

                    {credits.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {credits.map((credit) => (
                          <li
                            key={credit.id}
                            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                              Credit note · {money(Number(credit.amount))}
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">{credit.reason}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {lines.length > 0 && (
                      <div className="mt-3.5">
                        <InvoiceBreakdown
                          lines={lines.map((line) => ({
                            id: line.id,
                            description: line.description,
                            amount: Number(line.amount),
                            isBooking: line.booking_id !== null,
                          }))}
                          isPerformance={invoice.charge_type === 'performance'}
                        />
                      </div>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-white">How per-appointment billing works</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
          You are only ever billed for appointments that were confirmed. If our operator logged a booking that
          the tracking could not verify, it sits unbilled until it is confirmed — it never reaches your invoice
          on trust alone. Every line above names the appointment and its date, so the total can always be
          checked against your own calendar.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-600">
          Payments are processed by our payment provider. Your card details are never stored here and cannot be
          displayed on this page.
        </p>
      </Panel>
    </div>
  );
}
