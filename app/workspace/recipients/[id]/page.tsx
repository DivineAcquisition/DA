import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgreementActions, SendAgreementButton } from '../../components/AgreementForms';
import { CreateCalendarLinkButton, CalendarLinkActions } from '../../components/CalendarForms';
import { EditRecipientButton } from '../../components/RecipientForms';
import { GeneratePageTokenButton, PageTokenActions } from '../../components/TokenControls';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { ws } from '../../components/tokens';
import { formatDate, formatDateTime, linkStatus, recipientTypeLabel } from '@/lib/workspace/format';
import { publicCalendarUrl, publicPageUrl } from '@/lib/workspace/paths';
import {
  getRecipient,
  getSettings,
  listAgreementTemplates,
  listAgreementsForRecipient,
  listCalendarLinksForRecipient,
  listPageTemplates,
  listPageTokensForRecipient,
  listRecipients,
} from '@/lib/workspace/queries';

export default async function RecipientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipient = await getRecipient(id);
  if (!recipient) notFound();

  const [agreements, pageTokens, calendarLinks, templates, pageTemplates, settings, allRecipients] =
    await Promise.all([
      listAgreementsForRecipient(id),
      listPageTokensForRecipient(id),
      listCalendarLinksForRecipient(id),
      listAgreementTemplates(),
      listPageTemplates(),
      getSettings(),
      listRecipients(),
    ]);

  const baseUrl = settings?.public_base_url ?? '';
  const matchingTemplates = templates.filter((t) => t.recipient_type === recipient.recipient_type);

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        title={recipient.full_name}
        description={`${recipientTypeLabel(recipient.recipient_type)} · ${recipient.email}`}
        actions={
          <>
            <EditRecipientButton recipient={recipient} />
            <SendAgreementButton
              recipients={[recipient]}
              templates={matchingTemplates}
              presetRecipientId={recipient.id}
            />
          </>
        }
      />

      <section className={`${ws.card} grid gap-4 p-5 sm:grid-cols-2 sm:p-6`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Type</p>
          <p className="mt-1 text-white">{recipientTypeLabel(recipient.recipient_type)}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Status</p>
          <p className="mt-1">
            <StatusBadge status={recipient.status} />
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Business</p>
          <p className="mt-1 text-white">{recipient.business_name ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Phone</p>
          <p className="mt-1 text-white">{recipient.phone ?? '—'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-white">{recipient.notes ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">Created</p>
          <p className="mt-1 text-white">{formatDate(recipient.created_at)}</p>
        </div>
        <div>
          <Link href="/workspace/recipients" className="text-sm text-[var(--ws-accent)] hover:underline">
            ← All recipients
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
          <h2 className={`${ws.heading} text-lg font-semibold`}>Agreements</h2>
        </div>
        {agreements.length === 0 ? (
          <EmptyState title="No agreements sent" description="Send an agreement from this recipient using a matching template." />
        ) : (
          <DataTable headers={['Template', 'Status', 'Sent', 'Completed', 'Actions']}>
            {agreements.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-white">{a.template_name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                  {a.superseded_by_id && (
                    <span className="ml-2 text-xs text-[var(--ws-dim)]">superseded</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(a.sent_at)}</td>
                <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(a.completed_at)}</td>
                <td className="px-4 py-3">
                  <AgreementActions
                    agreementId={a.id}
                    status={a.status}
                    signingUrl={a.signing_url}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
          <h2 className={`${ws.heading} text-lg font-semibold`}>Tokenized pages</h2>
          <GeneratePageTokenButton
            recipients={allRecipients}
            pageTemplates={pageTemplates}
            presetRecipientId={recipient.id}
            baseUrl={baseUrl}
          />
        </div>
        {pageTokens.length === 0 ? (
          <EmptyState title="No page tokens" description="Generate a tokenized page for this recipient." />
        ) : (
          <DataTable headers={['Page', 'Status', 'Views', 'Last viewed', 'Actions']}>
            {pageTokens.map((t) => {
              const status = linkStatus(t);
              const url = baseUrl ? publicPageUrl(baseUrl, t.token) : '';
              return (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-white">{t.page_name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{t.view_count}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(t.last_viewed_at)}</td>
                  <td className="px-4 py-3">
                    {url && (
                      <PageTokenActions id={t.id} url={url} expiresAt={t.expires_at} />
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </section>

      <section>
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
          <h2 className={`${ws.heading} text-lg font-semibold`}>Calendar links</h2>
          <CreateCalendarLinkButton
            recipients={[recipient]}
            defaultBookingUrl={settings?.default_booking_url ?? ''}
            baseUrl={baseUrl}
            presetRecipientId={recipient.id}
          />
        </div>
        {calendarLinks.length === 0 ? (
          <EmptyState title="No calendar links" description="Create a tokenized booking link for this recipient." />
        ) : (
          <DataTable headers={['Name', 'Status', 'Clicks', 'Last clicked', 'Actions']}>
            {calendarLinks.map((link) => {
              const status = linkStatus(link);
              const url = baseUrl ? publicCalendarUrl(baseUrl, link.token) : '';
              return (
                <tr key={link.id}>
                  <td className="px-4 py-3 text-white">{link.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{link.click_count}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDateTime(link.last_clicked_at)}</td>
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
      </section>
    </div>
  );
}
