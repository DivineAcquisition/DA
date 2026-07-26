import Link from 'next/link';
import { btnSecondary, btnSizeSm } from '@/app/components/ui';
import { Badge, EmptyState, PageHeader, Panel, SectionHeader } from '@/app/vistrial/components/ui';
import { getMyAccount, getPublishedReports } from '@/lib/acct/queries';

export const dynamic = 'force-dynamic';

export default async function ClientReports() {
  const account = await getMyAccount();
  if (!account) return <EmptyState title="No engagement attached to this account" />;

  const reports = await getPublishedReports(account.case_file_id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reports"
        title="What DA has shared with you"
        description="Growth reports published to your account, each one a fixed record of the numbers as they stood on the day it was produced."
        actions={
          <Link href="/acct" className={`${btnSecondary} ${btnSizeSm}`}>
            Back to overview
          </Link>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          title="No reports published yet"
          detail="Your Divine Acquisition contact publishes these ahead of a review. Your live numbers are always on the overview."
        />
      ) : (
        <section>
          <SectionHeader title="Published" hint={`${reports.length} reports.`} />
          <ul className="space-y-2.5">
            {reports.map((report) => {
              const payload = report.payload as { metrics?: { improved: boolean | null }[] } | null;
              const metrics = payload?.metrics ?? [];
              const improved = metrics.filter((metric) => metric.improved === true).length;
              const comparable = metrics.filter((metric) => metric.improved !== null).length;

              return (
                <li key={report.id}>
                  <Panel className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {report.period_start} to {report.period_end}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Published {report.published_to_client_at?.slice(0, 10)}
                          {comparable > 0 && ` · ${improved} of ${comparable} measures improved`}
                        </p>
                      </div>
                      <Badge tone="brand">Growth report</Badge>
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
