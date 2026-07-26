import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { defaultPeriod, getFunnel, getGrowth, getMilestones, getMyAccount } from '@/lib/acct/queries';
import {
  EfficiencyTiles,
  FunnelStages,
  HeadlineTiles,
  SourceTable,
  WeeklyBars,
  money,
} from './components/dashboard';

export const dynamic = 'force-dynamic';

export default async function ClientOverview() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const caseFile = account.client_case_file as {
    name: string;
    vertical: string | null;
    status: string;
    install_started_at: string | null;
  } | null;

  const period = defaultPeriod();
  const [funnel, growth, milestones] = await Promise.all([
    getFunnel(account.case_file_id, period.start, period.end),
    getGrowth(account.case_file_id),
    getMilestones(account.case_file_id),
  ]);

  const installing = caseFile?.status === 'installing' || caseFile?.install_started_at === null;
  const improved = growth.filter((row) => row.improved === true).length;
  const comparable = growth.filter((row) => row.improved !== null).length;
  const recentMilestones = milestones.slice(0, 4);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={caseFile?.vertical ?? 'Your operation'}
        title="Your last 30 days"
        description={`${period.start} to ${period.end}. Every inquiry, how fast it was answered, and what it turned into.`}
        actions={
          <Link href="/acct/growth" className={`${btnSecondary} ${btnSizeSm}`}>
            Growth since we started
          </Link>
        }
      />

      {installing && (
        <Panel className="border-brand-500/25 bg-brand-500/[0.07] p-5">
          <Badge tone="brand">Install in progress</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            Your system is being built. Numbers here will start filling in as soon as the first inquiries come
            through the new setup.
          </p>
        </Panel>
      )}

      <HeadlineTiles funnel={funnel} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Your funnel" hint="Where inquiries go, step by step." />
          <FunnelStages funnel={funnel} />
        </section>

        <section>
          <SectionHeader title="Booked per week" />
          <WeeklyBars funnel={funnel} />
        </section>
      </div>

      <section>
        <SectionHeader title="Efficiency" hint="What each inquiry and each appointment costs." />
        <EfficiencyTiles funnel={funnel} />
      </section>

      <section>
        <SectionHeader
          title="By source"
          hint="Where the inquiries came from, and what each source returned."
        />
        <SourceTable funnel={funnel} />
      </section>

      {funnel.totals.reactivation_revenue > 0 && (
        <Panel className="border-flag-good/25 bg-flag-good/[0.06] p-5">
          <Badge tone="good">Recovered revenue</Badge>
          <p className="mt-2.5 text-sm leading-relaxed text-white">
            {money(funnel.totals.reactivation_revenue)} came from customers already in your database who had
            gone quiet. That figure carried no ad spend at all.
          </p>
        </Panel>
      )}

      {comparable > 0 && (
        <Panel className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {improved} of {comparable} measures have improved since your audit
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                Measured against the starting position we captured before anything was installed. The ones that
                have not improved are shown too.
              </p>
            </div>
            <Link href="/acct/growth" className={`${btnSecondary} ${btnSizeSm}`}>
              See all of them
            </Link>
          </div>
        </Panel>
      )}

      {recentMilestones.length > 0 && (
        <section>
          <SectionHeader title="Recent milestones" />
          <ul className="space-y-2.5">
            {recentMilestones.map((milestone) => (
              <li key={milestone.id}>
                <Panel className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{milestone.title}</p>
                    <span className="text-[11px] tabular-nums text-neutral-600">{milestone.occurred_on}</span>
                  </div>
                  {milestone.description && (
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{milestone.description}</p>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
