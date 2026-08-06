'use client';

import { useMemo, useState, useTransition } from 'react';
import { upsertAgreementTemplateAction, upsertPageTemplateAction } from '@/lib/workspace/actions';
import type { DaAgreementTemplate, DaPageTemplate, RecipientType } from '@/lib/workspace/types';
import { Button, Dialog, Field, Input, Select, Textarea } from './ui';

export function PageTemplateDialog({
  template,
  triggerLabel = 'New page template',
}: {
  template?: DaPageTemplate;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant={template ? 'secondary' : 'primary'} size={template ? 'sm' : 'md'} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={template ? 'Edit page template' : 'New page template'}>
        <form
          className="space-y-4"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const result = await upsertPageTemplateAction(fd);
              if (!result.ok) setError(result.error);
              else setOpen(false);
            });
          }}
        >
          {template && <input type="hidden" name="id" value={template.id} />}
          <Field label="Name">
            <Input name="name" required defaultValue={template?.name} />
          </Field>
          <Field label="Title">
            <Input name="title" required defaultValue={template?.title} />
          </Field>
          <Field label="Body (markdown)" hint="Variables use {{recipient_name}}, {{business_name}}, {{email}}, {{date}}.">
            <Textarea name="body_markdown" defaultValue={template?.body_markdown ?? ''} rows={8} />
          </Field>
          <Field label="Variables" hint="Comma-separated list.">
            <Input
              name="variables"
              defaultValue={(template?.variables ?? ['recipient_name', 'business_name', 'email', 'date']).join(',')}
            />
          </Field>
          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

type AttachedPage = { page_template_id: string; docuseal_field_name: string };

export function AgreementTemplateDialog({
  template,
  pageTemplates,
  attachedPages = [],
  triggerLabel = 'New agreement template',
}: {
  template?: DaAgreementTemplate;
  pageTemplates: DaPageTemplate[];
  attachedPages?: AttachedPage[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AttachedPage[]>(attachedPages);

  const available = useMemo(
    () => pageTemplates.filter((p) => !selected.some((s) => s.page_template_id === p.id)),
    [pageTemplates, selected],
  );

  return (
    <>
      <Button type="button" variant={template ? 'secondary' : 'primary'} size={template ? 'sm' : 'md'} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={template ? 'Edit agreement template' : 'New agreement template'}
      >
        <form
          className="space-y-4"
          action={(fd) => {
            setError(null);
            for (const row of selected) {
              fd.append('page_template_ids', row.page_template_id);
              fd.append('docuseal_field_names', row.docuseal_field_name);
            }
            startTransition(async () => {
              const result = await upsertAgreementTemplateAction(fd);
              if (!result.ok) setError(result.error);
              else setOpen(false);
            });
          }}
        >
          {template && <input type="hidden" name="id" value={template.id} />}
          <Field label="Name">
            <Input name="name" required defaultValue={template?.name} />
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={template?.description ?? ''} />
          </Field>
          <Field label="Recipient type">
            <Select name="recipient_type" defaultValue={(template?.recipient_type ?? 'client') as RecipientType}>
              <option value="client">Client</option>
              <option value="operator">Operator</option>
            </Select>
          </Field>
          <Field label="DocuSeal template id">
            <Input name="docuseal_template_id" required defaultValue={template?.docuseal_template_id} />
          </Field>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-dim)]">
              Attached custom pages
            </p>
            <div className="space-y-2">
              {selected.map((row, index) => {
                const page = pageTemplates.find((p) => p.id === row.page_template_id);
                return (
                  <div
                    key={`${row.page_template_id}-${index}`}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--ws-border)] p-3 sm:flex-row sm:items-center"
                  >
                    <span className="flex-1 text-sm text-white">{page?.name ?? row.page_template_id}</span>
                    <Input
                      value={row.docuseal_field_name}
                      onChange={(e) => {
                        const next = [...selected];
                        next[index] = { ...row, docuseal_field_name: e.target.value };
                        setSelected(next);
                      }}
                      placeholder="DocuSeal field name"
                      className="sm:max-w-[200px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(selected.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
              {available.length > 0 && (
                <Select
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    setSelected([
                      ...selected,
                      { page_template_id: id, docuseal_field_name: `page_url_${selected.length + 1}` },
                    ]);
                    e.target.value = '';
                  }}
                >
                  <option value="">Attach a page template…</option>
                  {available.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
              {pageTemplates.length === 0 && (
                <p className="text-xs text-[var(--ws-dim)]">Create a page template first to attach one.</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
