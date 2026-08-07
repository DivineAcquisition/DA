import { FieldMappingRow } from '../components/FieldMappingForm';
import SyncDocuSealButton from '../components/SyncControls';
import { Badge, DataTable, EmptyState, PageHeader } from '../components/ui';
import { ws } from '../components/tokens';
import { recipientTypeLabel } from '@/lib/workspace/format';
import { getSettings, listTemplateFieldMappings } from '@/lib/workspace/queries';

export const dynamic = 'force-dynamic';

export default async function FieldMappingPage() {
  const [mappings, settings] = await Promise.all([listTemplateFieldMappings(), getSettings()]);
  const withFields = mappings.filter((entry) => entry.template.docuseal_fields.length > 0);

  return (
    <div className="animate-rise space-y-10">
      <PageHeader
        title="Field mapping"
        description="Every field on every DocuSeal template, and the value the workspace fills it with before signing. Automatic matches use the recipient record and anything that recipient has submitted before; override any field that guesses wrong."
        actions={<SyncDocuSealButton label="Refresh from DocuSeal" variant="secondary" />}
      />

      {settings && !settings.auto_prefill && (
        <p className="rounded-xl border border-[var(--ws-pending)]/30 bg-[var(--ws-pending)]/10 px-4 py-3 text-sm text-[var(--ws-pending)]">
          Auto pre-fill is switched off in Settings. Mappings below are previewed but not sent.
        </p>
      )}

      {withFields.length === 0 ? (
        <EmptyState
          title="No template fields yet"
          description="Pull from DocuSeal to load each template's field catalogue, then mapping runs against it."
        />
      ) : (
        withFields.map(({ template, fields, summary, sampleRecipient }) => (
          <section key={template.id}>
            <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className={`${ws.heading} text-lg font-semibold`}>{template.name}</h2>
                <p className="mt-1 text-sm text-[var(--ws-dim)]">
                  {recipientTypeLabel(template.recipient_type)}
                  {template.docuseal_folder ? ` · ${template.docuseal_folder}` : ''} · DocuSeal template{' '}
                  {template.docuseal_template_id}
                  {sampleRecipient ? ` · previewed against ${sampleRecipient.full_name}` : ''}
                </p>
              </div>
              <Badge tone={summary.filled === summary.total ? 'success' : 'pending'}>
                {summary.filled} of {summary.total} mapped
              </Badge>
            </div>

            <DataTable headers={['Field', 'Source', 'Preview value', 'Mapping']}>
              {fields.map((field) => (
                <FieldMappingRow key={field.name} templateId={template.id} field={field} />
              ))}
            </DataTable>
          </section>
        ))
      )}
    </div>
  );
}
