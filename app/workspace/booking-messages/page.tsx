import { workspaceClient } from '@/lib/workspace/db';
import { EmptyState, PageHeader } from '../components/ui';

export const dynamic = 'force-dynamic';

type ProblemRow = {
  id: string;
  message_type: string;
  channel: string;
  status: string;
  reason: string;
  scheduled_for: string;
  attempts: number;
  touch_error: string;
  person: { email: string; first_name: string } | { email: string; first_name: string }[] | null;
};

function personOf(row: ProblemRow): { email: string; first_name: string } | null {
  if (!row.person) return null;
  return Array.isArray(row.person) ? row.person[0] ?? null : row.person;
}

export default async function BookingMessageProblemsPage() {
  const supabase = await workspaceClient();
  const loaded = supabase
    ? await supabase
        .from('booking_message_messages')
        .select(
          'id, message_type, channel, status, reason, scheduled_for, attempts, touch_error, person:booking_message_people(email, first_name)',
        )
        .or('status.eq.failed,status.eq.skipped,flagged.eq.true')
        .order('updated_at', { ascending: false })
        .limit(200)
    : { data: null, error: { message: 'Database is not configured.' } };

  const rows = ((loaded.data ?? []) as ProblemRow[]).filter((row) => row.status !== 'cancelled' && row.reason !== 'cancelled');

  return (
    <div className="animate-rise">
      <PageHeader
        title="Message problems"
        description="Audit messages that failed, or were skipped for a reason other than a normal cancellation. Reschedules, cancels, and STOP are not listed."
      />
      {loaded.error ? (
        <EmptyState title="The message log could not be read" description={loaded.error.message} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing needs attention" description="Failed and skipped audit messages show up here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const person = personOf(row);
                return (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-300">
                      {new Date(row.scheduled_for).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                    </td>
                    <td className="px-4 py-3">{person?.email || person?.first_name || 'Unknown lead'}</td>
                    <td className="px-4 py-3">
                      {row.message_type} · {row.channel}
                    </td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3 text-neutral-300">
                      {row.reason || row.touch_error}
                      {row.attempts > 0 ? ` · ${row.attempts} attempts` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
