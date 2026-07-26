import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { GrowthTable } from '@/app/da/components/growth';
import { getGrowth, getMilestones, getMyAccount } from '@/lib/acct/queries';

export const dynamic = 'force-dynamic';

export default async function ClientGrowth() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const [growth, milestones] = await Promise.all([
    getGrowth(account.case_file_id),
    getMilestones(account.case_file_id),
  ]);

  const comparable = growth.filter((row) => row.improved !== null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Since we started"
        title="Growth against where you began"
        description="Measured against the starting position captured at your audit, before anything was installed. Both the measures that improved and the ones that did not."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {comparable.length === 0 ? (
        <EmptyState
          title="Not enough measured yet"
          detail="Your starting position is recorded. Comparisons appear once the first measurement period completes."
        />
      ) : (
        <GrowthTable rows={growth} />
      )}

      {milestones.length > 0 && (
        <section>
          <SectionHeader title="What happened along the way" hint="So the numbers have a story attached." />
          <ol className="space-y-2.5">
            {milestones.map((milestone) => (
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
          </ol>
        </section>
      )}
    </div>
  );
}
