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
import { AdminOnly } from '@/app/vistrial/components/AppShell';
import { listOperators, listPayPeriods, listPayoutBatches, listPayouts } from '@/lib/da/billing';
import BatchActions from '../components/BatchActions';
import PayoutRow from '../components/PayoutRow';
import TaxDocForm from '../components/TaxDocForm';

export const dynamic = 'force-dynamic';

const money = (value: number | string | null) =>
  value === null ? '—' : `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

const BATCH_TONE: Record<string, Tone> = {
  draft: 'neutral',
  approved: 'brand',
  executing: 'warning',
  completed: 'good',
};

export default async function PayoutsPage() {
  return (
    <AdminOnly>
      <Payouts />
    </AdminOnly>
  );
}

async function Payouts() {
  const [batches, periods, operators] = await Promise.all([
    listPayoutBatches(),
    listPayPeriods(),
    listOperators(),
  ]);

  const payoutsByBatch = await Promise.all(batches.map((batch) => listPayouts(batch.id)));

  const owed = batches
    .filter((batch) => batch.status !== 'completed')
    .reduce((sum, batch) => sum + Number(batch.total_amount), 0);
  const missingDocs = operators.filter((operator) => operator.tax_doc_status !== 'on_file');
  const openPeriods = periods.filter(
    (period) => period.status === 'closed' && !batches.some((batch) => batch.period_id === period.id),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Money out"
        title="Operator payouts"
        description="Vistrial produces the batch. You execute the transfers through your provider and record each confirmation here. Automating cross-border execution adds real risk for a handful of monthly transfers."
        actions={
          <>
            <Link href="/da/billing" className={`${btnSecondary} ${btnSizeSm}`}>
              Billing
            </Link>
            <Link href="/da/margin" className={`${btnSecondary} ${btnSizeSm}`}>
              Margin
            </Link>
          </>
        }
      />

      <StatGrid>
        <StatTile label="Owed and in flight" value={money(owed)} tone={owed > 0 ? 'warning' : 'good'} />
        <StatTile label="Batches" value={String(batches.length)} />
        <StatTile
          label="Missing tax docs"
          value={String(missingDocs.length)}
          hint="Blocks batch approval"
          tone={missingDocs.length > 0 ? 'critical' : 'good'}
        />
        <StatTile
          label="Periods awaiting a batch"
          value={String(openPeriods.length)}
          tone={openPeriods.length > 0 ? 'warning' : 'neutral'}
        />
      </StatGrid>

      {missingDocs.length > 0 && (
        <section>
          <SectionHeader
            title="Contractor documentation"
            hint="Only the status and a reference are stored, never the document itself."
          />
          <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-5">
            <Badge tone="critical">
              {missingDocs.length} operator{missingDocs.length === 1 ? '' : 's'} without documentation on file
            </Badge>
            <p className="mt-2.5 text-sm leading-relaxed text-white">
              A batch containing any of these will refuse to approve. Better to block now than to discover it
              at tax time.
            </p>
          </Panel>
          <ul className="mt-3 space-y-2.5">
            {missingDocs.map((operator) => (
              <li key={operator.id}>
                <Panel className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{operator.name}</p>
                    <Badge tone="warning">{operator.tax_doc_status}</Badge>
                  </div>
                  <div className="mt-3">
                    <TaxDocForm operatorId={operator.id} current={operator.tax_doc_status} />
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openPeriods.length > 0 && (
        <section>
          <SectionHeader title="Build a batch" hint="Closed periods with no batch yet." />
          <ul className="space-y-2.5">
            {openPeriods.map((period) => (
              <li key={period.id}>
                <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {period.start_date} to {period.end_date}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      {period.closes_month ? 'Closes the month' : 'Mid-month period'}
                    </p>
                  </div>
                  <BatchActions periodId={period.id} mode="build" />
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionHeader title="Batches" />
        {batches.length === 0 ? (
          <EmptyState title="No batches yet" detail="Close a pay period, then build its batch." />
        ) : (
          <ul className="space-y-4">
            {batches.map((batch, index) => {
              const payouts = payoutsByBatch[index];
              const period = batch.pay_period as { start_date: string; end_date: string } | null;
              const confirmed = payouts.filter((payout) => payout.status === 'confirmed').length;

              return (
                <li key={batch.id}>
                  <Panel className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {period ? `${period.start_date} to ${period.end_date}` : batch.period_id}
                          </p>
                          <Badge tone={BATCH_TONE[batch.status] ?? 'neutral'}>{batch.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          {batch.payout_count} payouts · {confirmed} confirmed
                          {batch.approved_at && ` · approved ${batch.approved_at.slice(0, 10)}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-base font-semibold tabular-nums text-white">
                          {money(batch.total_amount)}
                        </span>
                        <BatchActions
                          periodId={batch.period_id}
                          batchId={batch.id}
                          mode={batch.status === 'draft' ? 'approve' : 'rebuild'}
                        />
                      </div>
                    </div>

                    {payouts.length > 0 && (
                      <ul className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4">
                        {payouts.map((payout) => {
                          const operator = payout.operator as {
                            name: string;
                            payout_method: string | null;
                            payout_reference: string | null;
                            tax_doc_status: string;
                          } | null;

                          return (
                            <li key={payout.id}>
                              <PayoutRow
                                payout={{
                                  id: payout.id,
                                  amount: Number(payout.amount),
                                  base: Number(payout.base_amount),
                                  commission: Number(payout.commission_amount),
                                  bonus: Number(payout.bonus_amount),
                                  adjustments: Number(payout.adjustment_total),
                                  status: payout.status,
                                  method: payout.method,
                                  reference: payout.payout_reference,
                                  sentReference: payout.sent_reference,
                                  confirmedAt: payout.confirmed_at,
                                  failureReason: payout.failure_reason,
                                  rolledFrom: payout.rolled_from_payout_id !== null,
                                  locked: payout.locked,
                                  statementId: payout.statement_id,
                                }}
                                operatorName={operator?.name ?? 'Unknown operator'}
                                batchApproved={batch.status !== 'draft'}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Panel className="p-5">
        <h2 className="text-sm font-semibold text-white">How a payout closes</h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-400">
          <li>Build the batch from the closed period&apos;s locked statements.</li>
          <li>Approve it, which blocks if anyone is missing contractor documentation.</li>
          <li>Execute the transfers in your provider, then record each reference here.</li>
          <li>
            Confirming locks the record permanently. A failure or a return is flagged instead and the amount
            rolls into the next batch rather than disappearing.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
