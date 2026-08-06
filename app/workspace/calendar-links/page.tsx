import { CreateCalendarLinkButton, CalendarLinkActions } from '../components/CalendarForms';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { formatDateTime, linkStatus } from '@/lib/workspace/format';
import { publicCalendarUrl } from '@/lib/workspace/paths';
import { getSettings, listCalendarLinks, listRecipients } from '@/lib/workspace/queries';

export default async function CalendarLinksPage() {
  const [links, recipients, settings] = await Promise.all([
    listCalendarLinks(),
    listRecipients(),
    getSettings(),
  ]);
  const baseUrl = settings?.public_base_url ?? '';

  return (
    <div className="animate-rise">
      <PageHeader
        title="Calendar links"
        description="Tokenized booking links unique to each recipient."
        actions={
          <CreateCalendarLinkButton
            recipients={recipients.filter((r) => r.status === 'active')}
            defaultBookingUrl={settings?.default_booking_url ?? ''}
            baseUrl={baseUrl}
          />
        }
      />

      {links.length === 0 ? (
        <EmptyState
          title="No calendar links yet"
          description="Create a tokenized link that redirects to a booking page and records clicks."
        />
      ) : (
        <DataTable headers={['Name', 'Recipient', 'Clicks', 'Last clicked', 'Status', 'Actions']}>
          {links.map((link) => {
            const status = linkStatus(link);
            const url = baseUrl ? publicCalendarUrl(baseUrl, link.token) : '';
            return (
              <tr key={link.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{link.name}</td>
                <td className="px-4 py-3">{link.recipient_name}</td>
                <td className="px-4 py-3 tabular-nums">{link.click_count}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(link.last_clicked_at)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3">
                  {url && (
                    <CalendarLinkActions id={link.id} url={url} expiresAt={link.expires_at} />
                  )}
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
