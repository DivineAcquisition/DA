import { AgreementTemplateDialog, PageTemplateDialog } from '../components/TemplateForms';
import { GeneratePageTokenButton, PageTokenActions } from '../components/TokenControls';
import { DataTable, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { ws } from '../components/tokens';
import { formatDate, formatDateTime, linkStatus, recipientTypeLabel } from '@/lib/workspace/format';
import { publicPageUrl } from '@/lib/workspace/paths';
import {
  getAgreementTemplate,
  getSettings,
  listAgreementTemplates,
  listPageTemplates,
  listPageTokensForTemplate,
  listRecipients,
} from '@/lib/workspace/queries';

export default async function TemplatesPage() {
  const [agreementTemplates, pageTemplates, recipients, settings] = await Promise.all([
    listAgreementTemplates(),
    listPageTemplates(),
    listRecipients(),
    getSettings(),
  ]);
  const baseUrl = settings?.public_base_url ?? '';

  const templateDetails = await Promise.all(
    agreementTemplates.map(async (t) => {
      const detail = await getAgreementTemplate(t.id);
      return { summary: t, detail };
    }),
  );

  const pageTokenGroups = await Promise.all(
    pageTemplates.map(async (page) => ({
      page,
      tokens: await listPageTokensForTemplate(page.id),
    })),
  );

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        title="Pages & templates"
        description="Agreement templates and the tokenized custom pages attached to them."
        actions={
          <>
            <PageTemplateDialog />
            <AgreementTemplateDialog pageTemplates={pageTemplates} />
          </>
        }
      />

      <section>
        <h2 className={`${ws.heading} mb-3.5 text-lg font-semibold`}>Agreement templates</h2>
        {templateDetails.length === 0 ? (
          <EmptyState
            title="No agreement templates"
            description="Create a template with a DocuSeal template identifier and optional attached pages."
          />
        ) : (
          <DataTable headers={['Name', 'Type', 'Pages', 'Created', '']}>
            {templateDetails.map(({ summary, detail }) => {
              if (!detail) return null;
              return (
                <tr key={summary.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{detail.template.name}</td>
                  <td className="px-4 py-3">{recipientTypeLabel(detail.template.recipient_type)}</td>
                  <td className="px-4 py-3 tabular-nums">{detail.pages.length}</td>
                  <td className="px-4 py-3 text-[var(--ws-dim)]">{formatDate(detail.template.created_at)}</td>
                  <td className="px-4 py-3">
                    <AgreementTemplateDialog
                      template={detail.template}
                      pageTemplates={pageTemplates}
                      attachedPages={detail.pages.map((p) => ({
                        page_template_id: p.page_template_id,
                        docuseal_field_name: p.docuseal_field_name,
                      }))}
                      triggerLabel="Edit"
                    />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </section>

      <section>
        <h2 className={`${ws.heading} mb-3.5 text-lg font-semibold`}>Tokenized pages</h2>
        {pageTokenGroups.length === 0 ? (
          <EmptyState
            title="No page templates"
            description="Author a markdown page template with variables before attaching it to agreements."
          />
        ) : (
          <div className="space-y-4">
            {pageTokenGroups.map(({ page, tokens }) => (
              <div key={page.id} className={`${ws.card} p-5`}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className={`${ws.heading} text-base font-semibold`}>{page.name}</h3>
                    <p className="mt-1 text-sm text-[var(--ws-dim)]">{page.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PageTemplateDialog template={page} triggerLabel="Edit" />
                    <GeneratePageTokenButton
                      recipients={recipients}
                      pageTemplates={[page]}
                      presetPageTemplateId={page.id}
                      baseUrl={baseUrl}
                    />
                  </div>
                </div>
                {tokens.length === 0 ? (
                  <p className="text-sm text-[var(--ws-dim)]">No tokens generated for this page yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-[0.14em] text-[var(--ws-dim)]">
                          <th className="pb-2 pr-4 font-semibold">Recipient</th>
                          <th className="pb-2 pr-4 font-semibold">Status</th>
                          <th className="pb-2 pr-4 font-semibold">Views</th>
                          <th className="pb-2 pr-4 font-semibold">Last viewed</th>
                          <th className="pb-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--ws-border)]">
                        {tokens.map((t) => {
                          const status = linkStatus(t);
                          const url = baseUrl ? publicPageUrl(baseUrl, t.token) : '';
                          return (
                            <tr key={t.id}>
                              <td className="py-3 pr-4 text-white">{t.recipient_name}</td>
                              <td className="py-3 pr-4">
                                <StatusBadge status={status} />
                              </td>
                              <td className="py-3 pr-4 tabular-nums">{t.view_count}</td>
                              <td className="py-3 pr-4 text-[var(--ws-dim)]">
                                {formatDateTime(t.last_viewed_at)}
                              </td>
                              <td className="py-3">
                                {url && (
                                  <PageTokenActions id={t.id} url={url} expiresAt={t.expires_at} />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
