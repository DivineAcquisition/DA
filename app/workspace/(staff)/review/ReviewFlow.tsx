import { loadNavCounts } from '@/lib/workspace/nav-counts';
import { workspaceClient } from '@/lib/workspace/db';
import { LifecycleFlow } from '../components/agentic';

/** The start of the trailing week, for "sent this week". */
function weekAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

/** EOD to client report, with what waits on a manager. Shown on both Review queues. */
export default async function ReviewFlow() {
  const since = weekAgo();
  const db = await workspaceClient();
  const [counts, sent] = await Promise.all([
    loadNavCounts(),
    db
      ? db.from('sales_report').select('id', { count: 'exact', head: true }).eq('status', 'sent').eq('test', false).gte('sent_at', since)
      : Promise.resolve({ count: 0 }),
  ]);
  const eods = counts.eods ?? 0;
  const reports = counts.reports ?? 0;
  const delivered = sent.count ?? 0;
  return (
    <div className="mb-5">
      <LifecycleFlow
        label="EOD to client report"
        stages={[
          { key: 'eods', label: 'EODs to review', count: eods, hint: 'Filed, not yet marked', href: '/workspace/review/eods', kind: 'person' },
          { key: 'reports', label: 'Reports to approve', count: reports, hint: 'Ready for Review', href: '/workspace/review/reports', kind: 'person' },
          { key: 'sent', label: 'Sent this week', count: delivered, hint: 'Delivered to clients', href: '/workspace/review/reports?status=sent', kind: 'auto' },
        ]}
        statuses={[
          eods ? `${eods} EOD${eods === 1 ? '' : 's'} waiting on a manager` : null,
          reports ? `${reports} report${reports === 1 ? '' : 's'} ready to approve` : null,
          delivered ? `${delivered} report${delivered === 1 ? '' : 's'} sent in the last 7 days` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .concat(eods || reports || delivered ? [] : ['Nothing is waiting on review.'])}
      />
    </div>
  );
}
