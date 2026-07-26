import Link from 'next/link';
import { notFound } from 'next/navigation';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  SectionHeader,
  StatGrid,
  StatTile,
  inputClass,
  labelClass,
  selectClass,
} from '@/app/vistrial/components/ui';
import { logScopeRequestAction, quoteScopeAction } from '@/lib/da/actions';
import { getCaseFileBySlug, listScope } from '@/lib/da/queries';
import { ActionForm, Disclosure } from '../../components/ActionForm';
import DecideQuoteButtons from '../../components/DecideQuoteButtons';

export const dynamic = 'force-dynamic';

export default async function ScopePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();

  const requests = await listScope(caseFile.id);
  const outOfScope = requests.filter((request) => request.verdict === 'out_of_scope');
  const quotes = requests.flatMap((request) => (request.scope_quote ?? []) as { status: string }[]);
  const accepted = quotes.filter((quote) => quote.status === 'accepted');

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.name}
        title="Scope log"
        description="Every request the client made, marked in or out of scope with a reason. This is the paper trail that keeps a productized engagement from quietly becoming custom consulting."
        actions={
          <Link href={`/da/${slug}`} className={`${btnSecondary} ${btnSizeSm}`}>
            Back to case file
          </Link>
        }
      />

      <StatGrid columns={3}>
        <StatTile label="Requests logged" value={String(requests.length)} />
        <StatTile
          label="Out of scope"
          value={String(outOfScope.length)}
          tone={outOfScope.length > 0 ? 'warning' : 'good'}
        />
        <StatTile label="Quotes accepted" value={String(accepted.length)} tone="brand" />
      </StatGrid>

      <Disclosure label="Log a request">
        <Panel className="p-5">
          <ActionForm action={logScopeRequestAction.bind(null, caseFile.id, slug)} submitLabel="Log request">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass} htmlFor="requested_on">
                  Date asked *
                </label>
                <input id="requested_on" name="requested_on" type="date" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="requested_by_name">
                  Who asked
                </label>
                <input id="requested_by_name" name="requested_by_name" className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="verdict">
                  Verdict *
                </label>
                <select id="verdict" name="verdict" defaultValue="in_scope" className={selectClass}>
                  <option value="in_scope">In scope</option>
                  <option value="out_of_scope">Out of scope</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="summary">
                What they asked for *
              </label>
              <input id="summary" name="summary" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="detail">
                Detail
              </label>
              <textarea id="detail" name="detail" rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className={labelClass} htmlFor="reason">
                Reason for the verdict *
              </label>
              <input
                id="reason"
                name="reason"
                required
                className={inputClass}
                placeholder="Short. This is the sentence that answers the dispute."
              />
            </div>
          </ActionForm>
        </Panel>
      </Disclosure>

      <section>
        <SectionHeader title="Requests" />
        {requests.length === 0 ? (
          <EmptyState title="Nothing logged yet" />
        ) : (
          <ul className="space-y-2.5">
            {requests.map((request) => {
              const requestQuotes = (request.scope_quote ?? []) as {
                id: string;
                proposed_on: string;
                summary: string;
                amount: number | null;
                status: string;
                decided_on: string | null;
                decision_note: string | null;
              }[];

              return (
                <li key={request.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={request.verdict === 'in_scope' ? 'good' : 'warning'}>
                          {request.verdict === 'in_scope' ? 'In scope' : 'Out of scope'}
                        </Badge>
                        {request.requested_by_name && (
                          <span className="text-[11px] text-neutral-600">asked by {request.requested_by_name}</span>
                        )}
                      </div>
                      <span className="text-[11px] tabular-nums text-neutral-600">{request.requested_on}</span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-white">{request.summary}</p>
                    {request.detail && (
                      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{request.detail}</p>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed text-neutral-300">
                      <span className="text-neutral-500">Reason: </span>
                      {request.reason}
                    </p>

                    {requestQuotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="mt-3 rounded-xl border border-brand-500/20 bg-brand-500/[0.07] px-3.5 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-300">
                            Quote · {quote.status}
                          </p>
                          <span className="text-[13px] font-semibold tabular-nums text-white">
                            {quote.amount === null ? '—' : `$${Number(quote.amount).toLocaleString()}`}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-brand-50">{quote.summary}</p>
                        {quote.decision_note && (
                          <p className="mt-1.5 text-xs text-neutral-400">
                            {quote.decided_on}: {quote.decision_note}
                          </p>
                        )}
                        {quote.status !== 'accepted' && quote.status !== 'declined' && (
                          <div className="mt-3">
                            <DecideQuoteButtons quoteId={quote.id} slug={slug} />
                          </div>
                        )}
                      </div>
                    ))}

                    {request.verdict === 'out_of_scope' && requestQuotes.length === 0 && (
                      <div className="mt-3.5">
                        <Disclosure label="Turn it into a quote" tone="neutral">
                          <ActionForm
                            variant="secondary"
                            submitLabel="Record quote"
                            action={quoteScopeAction.bind(null, request.id, slug)}
                          >
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className={labelClass} htmlFor={`pd-${request.id}`}>
                                  Proposed on *
                                </label>
                                <input
                                  id={`pd-${request.id}`}
                                  name="proposed_on"
                                  type="date"
                                  required
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className={labelClass} htmlFor={`am-${request.id}`}>
                                  Amount
                                </label>
                                <input
                                  id={`am-${request.id}`}
                                  name="amount"
                                  type="number"
                                  step="0.01"
                                  className={inputClass}
                                />
                              </div>
                            </div>
                            <div>
                              <label className={labelClass} htmlFor={`qs-${request.id}`}>
                                What was proposed *
                              </label>
                              <textarea
                                id={`qs-${request.id}`}
                                name="summary"
                                rows={2}
                                required
                                className={`${inputClass} resize-none`}
                              />
                            </div>
                          </ActionForm>
                        </Disclosure>
                      </div>
                    )}
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
