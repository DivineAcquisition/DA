import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { btnPrimary, btnSecondary, btnSizeSm } from '@/app/components/ui';
import {
  Badge,
  DefinitionList,
  KeyValue,
  PageHeader,
  Panel,
  SectionHeader,
} from '@/app/vistrial/components/ui';
import { formatMoney } from '@/lib/vistrial/format';
import { engagementBase, engagementPath, engagementsHome } from '@/lib/da/paths';
import {
  getBaseline,
  getCaseFileBySlug,
  getGrowth,
  getHealth,
  listCaseInvoices,
  listCaseSubscriptions,
  listEffort,
  listEvidence,
  listMilestones,
  listIndustryTemplates,
  listPlacements,
  listReports,
  listSalesOperators,
  listSnapshots,
} from '@/lib/da/queries';
import BeginInstallButton from '../components/BeginInstallButton';
import {
  ClientDetailsForm,
  EndPlacementButton,
  PlaceOperatorForm,
  RefreshStripeButton,
} from '../components/EngagementSetup';
import OperatingConfigForm from '../components/OperatingConfigForm';
import { GrowthTable, HeadlineDelta } from '../components/growth';

export const dynamic = 'force-dynamic';

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return formatMoney(amount);
}

function operatorOf(
  operator: { name: string; email: string } | { name: string; email: string }[] | null,
) {
  if (!operator) return null;
  return Array.isArray(operator) ? (operator[0] ?? null) : operator;
}

export default async function CaseFileOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const caseFile = await getCaseFileBySlug(slug);
  if (!caseFile) notFound();
  const base = engagementBase((await headers()).get('x-pathname') ?? '');
  const href = (section = '') => engagementPath(base, slug, section);

  const [health, baseline, growth, snapshots, milestones, evidence, effort, reports, templates, operators, placements, invoices, subscriptions] =
    await Promise.all([
    getHealth(caseFile.id),
    getBaseline(caseFile.id),
    getGrowth(caseFile.id),
    listSnapshots(caseFile.id),
    listMilestones(caseFile.id),
    listEvidence(caseFile.id),
    listEffort(caseFile.id),
    listReports(caseFile.id),
    listIndustryTemplates(),
    listSalesOperators(),
    listPlacements(caseFile.id),
    listCaseInvoices(caseFile.id),
    listCaseSubscriptions(caseFile.id),
  ]);

  // Detail and operating columns are ahead of the checked-in types.
  const config = caseFile as typeof caseFile & {
    industry_key: string;
    qualified_booking_definition: string | null;
    contact_role: string | null;
    contact_channel: string | null;
    phone: string | null;
    billing_email: string | null;
    offer: string | null;
    monthly_ad_spend: number | string | null;
    crm_stack: string | null;
    time_zone: string | null;
    stripe_customer_id: string | null;
  };

  const hasBaseline = Boolean(baseline);
  const baselineLocked = Boolean(baseline?.snapshot.locked_at);
  const comparable = growth.filter((row) => row.improved !== null);
  const untagged = evidence.filter((item) => item.needs_metadata);

  const livePlacement = placements.find((placement) => placement.status === 'active') ?? null;
  const paidInvoices = invoices.filter((invoice) => invoice.status === 'paid');
  const collected = paidInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const subscription = subscriptions[0] ?? null;
  const stripeProduct = paidInvoices.find((invoice) => invoice.notes)?.notes ?? null;
  const detailsBlank = !config.phone && !config.billing_email && !config.offer && !config.crm_stack && !config.time_zone && !caseFile.notes && (config.monthly_ad_spend === null || config.monthly_ad_spend === undefined);

  const sections = [
    { href: href('baseline'), label: 'Baseline', hint: hasBaseline ? (baselineLocked ? 'Locked' : 'Open for editing') : 'Not captured' },
    { href: href('progress'), label: 'Progress', hint: `${snapshots.length} snapshots` },
    { href: href('milestones'), label: 'Milestones', hint: `${milestones.length} events` },
    { href: href('evidence'), label: 'Evidence', hint: `${evidence.length} items${untagged.length ? `, ${untagged.length} untagged` : ''}` },
    { href: href('effort'), label: 'Effort', hint: `${effort.filter((e) => !e.superseded_by_id).length} entries` },
    { href: href('scope'), label: 'Scope', hint: `${health?.out_of_scope_count ?? 0} out of scope` },
    { href: href('decisions'), label: 'Decisions', hint: 'Material choices' },
    { href: href('reports'), label: 'Reports', hint: `${reports.length} generated` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile.vertical ?? 'Engagement'}
        title={caseFile.name}
        description={
          caseFile.contact_name
            ? `${caseFile.contact_name}${caseFile.contact_email ? ` · ${caseFile.contact_email}` : ''}`
            : undefined
        }
        actions={
          <>
            <Link href={engagementsHome(base)} className={`${btnSecondary} ${btnSizeSm}`}>
              All engagements
            </Link>
            {hasBaseline && !baselineLocked && (
              <BeginInstallButton caseFileId={caseFile.id} slug={slug} />
            )}
            {baselineLocked && (
              <Link href={href('reports')} className={`${btnPrimary} ${btnSizeSm}`}>
                Generate report
              </Link>
            )}
          </>
        }
      />

      {/* Rule: no baseline means the case file warns and growth reporting is off. */}
      {!hasBaseline && (
        <Panel className="border-flag-critical/25 bg-flag-critical/[0.06] p-6">
          <Badge tone="critical">No baseline captured</Badge>
          <h2 className="mt-3 text-lg font-semibold text-white">
            Growth reporting is switched off for this engagement
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-neutral-300">
            Nothing in this system works without a baseline. It has to be captured during the audit, before
            anything is installed, because every figure reported afterwards is a measured delta from it.
            Showing numbers without one would be showing numbers that mean nothing.
          </p>
          <Link href={href('baseline')} className={`${btnPrimary} ${btnSizeSm} mt-5`}>
            Capture the baseline
          </Link>
        </Panel>
      )}

      {hasBaseline && !baselineLocked && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">Baseline still open</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            The baseline is captured but not yet locked, so progress snapshots cannot be taken. Locking happens
            when you begin the install, and it is permanent — after that the baseline can only be annotated.
          </p>
        </Panel>
      )}

      {baselineLocked && comparable.length > 0 && (
        <>
          <section>
            <SectionHeader
              title="Is this client better off than when we started"
              hint={
                health?.last_period_end
                  ? `Measured to ${health.last_period_end}, against a baseline locked ${baseline!.snapshot.locked_at?.slice(0, 10)}.`
                  : undefined
              }
            />
            <HeadlineDelta rows={growth} />
          </section>

          <section>
            <SectionHeader title="Every metric" hint="Improvements and regressions together." />
            <GrowthTable rows={growth} />
          </section>
        </>
      )}

      {baselineLocked && comparable.length === 0 && (
        <Panel className="p-5">
          <Badge tone="warning">No progress snapshot yet</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
            The baseline is locked, so measurement can begin. Snapshots are taken automatically each week, or
            you can take one now.
          </p>
          <Link href={href('progress')} className={`${btnPrimary} ${btnSizeSm} mt-4`}>
            Take a snapshot
          </Link>
        </Panel>
      )}

      {caseFile.record_kind !== 'operator' && (
      <>
      <section>
        <SectionHeader
          title="Client details"
          hint="Phone, billing, the offer, ad spend, and the stack."
        />
        <Panel className="px-5 py-2">
          <DefinitionList>
            <KeyValue label="Phone">{config.phone ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
            <KeyValue label="Billing email">{config.billing_email ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
            <KeyValue label="Offer">{config.offer ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
            <KeyValue label="Monthly ad spend">{money(config.monthly_ad_spend) ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
            <KeyValue label="CRM / stack">{config.crm_stack ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
            <KeyValue label="Time zone">{config.time_zone ?? <span className="text-neutral-500">Not recorded</span>}</KeyValue>
          </DefinitionList>
        </Panel>
        <div className="mt-3">
          <ClientDetailsForm
            caseFileId={caseFile.id}
            slug={slug}
            startOpen={detailsBlank}
            phone={config.phone}
            billingEmail={config.billing_email}
            offer={config.offer}
            monthlyAdSpend={
              config.monthly_ad_spend === null || config.monthly_ad_spend === undefined
                ? null
                : String(config.monthly_ad_spend)
            }
            crmStack={config.crm_stack}
            timeZone={config.time_zone}
            notes={caseFile.notes}
          />
        </div>
      </section>

      <section>
        <SectionHeader
          title="Sales operator"
          hint="A placement is the connection between one sales operator and this client. Bookings and the shift attach to it."
        />
        {placements.length === 0 ? (
          <Panel className="p-5">
            <p className="text-sm leading-relaxed text-neutral-300">
              No sales operator is placed on {caseFile.name} yet. Choose an operator, a start date, and the term
              to open the placement.
            </p>
          </Panel>
        ) : (
          <ul className="space-y-2.5">
            {placements.map((placement) => {
              const operator = operatorOf(placement.operator);
              return (
                <li key={placement.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{operator?.name ?? 'Operator'}</p>
                      <Badge tone={placement.status === 'active' ? 'good' : 'neutral'}>{placement.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">{operator?.email}</p>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                      {placement.start_date} – {placement.closed_on ?? placement.end_date} · {placement.term_months}-month
                      term · quota {placement.monthly_booking_quota}/mo · commission {money(placement.commission_per_booking)}
                      {placement.client_rate_per_booking != null
                        ? ` · client rate ${money(placement.client_rate_per_booking)}`
                        : ''}
                      {' · '}
                      {String(placement.shift_start).slice(0, 5)}–{String(placement.shift_end).slice(0, 5)}{' '}
                      {placement.time_zone}
                    </p>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3">
          {livePlacement ? (
            <EndPlacementButton placementId={livePlacement.id} slug={slug} />
          ) : (
            <PlaceOperatorForm
              caseFileId={caseFile.id}
              slug={slug}
              operators={operators}
              timeZone={config.time_zone}
              startOpen
            />
          )}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Revenue from Stripe"
          hint={
            config.stripe_customer_id
              ? `Customer ${config.stripe_customer_id}${stripeProduct ? ` · ${stripeProduct}` : ''}`
              : 'Match a Stripe customer by the contact email, then save paid invoices on this engagement.'
          }
        />
        <Panel className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Collected</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{formatMoney(collected)}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {paidInvoices.length} paid invoice{paidInvoices.length === 1 ? '' : 's'}
                {subscription
                  ? ` · ${money(subscription.amount)}/mo · ${subscription.status}${
                      subscription.cancelled_on ? ` ${subscription.cancelled_on}` : ''
                    }`
                  : ''}
              </p>
            </div>
            {subscription && (
              <Badge tone={subscription.status === 'active' ? 'good' : subscription.status === 'cancelled' ? 'warning' : 'neutral'}>
                {subscription.status}
              </Badge>
            )}
          </div>
          {caseFile.retainer_amount != null && (
            <p className="mt-3 text-xs leading-relaxed text-neutral-500">
              Retainer entered on this engagement: {money(caseFile.retainer_amount)}/mo.
              {stripeProduct
                ? ` Collected payments are ${stripeProduct} on the connected Stripe account.`
                : ' Collected payments are the Stripe invoices matched to this contact.'}
            </p>
          )}
          {paidInvoices.length > 0 && (
            <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
              {paidInvoices.map((invoice) => (
                <li key={invoice.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <span className="text-neutral-300">
                    {invoice.number ?? 'Invoice'}
                    {invoice.notes ? <span className="text-neutral-500"> · {invoice.notes}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-white">
                    {money(invoice.total)}
                    <span className="ml-2 text-xs text-neutral-500">{invoice.paid_at?.slice(0, 10)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="mt-3">
          <RefreshStripeButton caseFileId={caseFile.id} slug={slug} />
        </div>
      </section>
      </>
      )}

      <section>
        <SectionHeader
          title="Operating configuration"
          hint="What every operator on this client is asked at the end of a shift, and what counts as a booking worth paying for. Both were decided in code until now."
          actions={
            <OperatingConfigForm
              caseFileId={caseFile.id}
              slug={slug}
              templates={templates}
              currentIndustryKey={config.industry_key}
              currentDefinition={config.qualified_booking_definition}
              currentContactRole={config.contact_role}
              currentContactChannel={config.contact_channel}
            />
          }
        />
        <Panel className="px-5 py-2">
          <DefinitionList>
            <KeyValue label="Industry template">
              {templates.find((template) => template.key === config.industry_key)?.name ??
                config.industry_key}
            </KeyValue>
            <KeyValue label="Qualified booking">
              {config.qualified_booking_definition ?? (
                <span className="text-neutral-500">Not defined for this client yet</span>
              )}
            </KeyValue>
            <KeyValue label="Escalation contact">
              {caseFile.contact_name
                ? [
                    caseFile.contact_name,
                    config.contact_role && `(${config.contact_role})`,
                    config.contact_channel && `via ${config.contact_channel}`,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : <span className="text-neutral-500">None recorded</span>}
            </KeyValue>
          </DefinitionList>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Engagement" />
        <Panel className="px-5 py-2">
          <DefinitionList>
            <KeyValue label="Status">
              <Badge tone={caseFile.status === 'active' ? 'good' : 'warning'}>{caseFile.status}</Badge>
            </KeyValue>
            <KeyValue label="Engagement start">{caseFile.engagement_start ?? '—'}</KeyValue>
            <KeyValue label="Install began">
              {caseFile.install_started_at ? caseFile.install_started_at.slice(0, 10) : 'Not yet'}
            </KeyValue>
            <KeyValue label="Retainer">
              {caseFile.retainer_amount ? `$${Number(caseFile.retainer_amount).toLocaleString()}/mo` : '—'}
            </KeyValue>
            <KeyValue label="Revenue goal">
              {caseFile.revenue_goal_monthly
                ? `$${Number(caseFile.revenue_goal_monthly).toLocaleString()}/mo`
                : '—'}
            </KeyValue>
            <KeyValue label="Drive folder">
              {caseFile.drive_folder_url ? (
                <a
                  href={caseFile.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-300 underline decoration-brand-500/40 underline-offset-2 hover:text-brand-200"
                >
                  Open in Drive
                </a>
              ) : (
                <span className="text-neutral-500">Not connected</span>
              )}
            </KeyValue>
          </DefinitionList>
        </Panel>
      </section>

      <section>
        <SectionHeader title="Sections" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="panel panel-hover rounded-2xl px-4 py-3.5">
              <p className="text-sm font-medium text-white">{section.label}</p>
              <p className="mt-1 text-xs text-neutral-500">{section.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {untagged.length > 0 && (
        <Panel className="border-flag-warning/25 bg-flag-warning/[0.06] p-5">
          <Badge tone="warning">{untagged.length} evidence items awaiting metadata</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            These were added straight to Drive rather than through Vistrial, so the sync brought them in
            untagged. Every item needs what it proves and the date it happened before it can be used in a
            report.
          </p>
          <Link href={href('evidence')} className={`${btnSecondary} ${btnSizeSm} mt-4`}>
            Tag them
          </Link>
        </Panel>
      )}
    </div>
  );
}
