'use client';

import { useState, useTransition } from 'react';
import { generatePageTokenAction, updatePageTokenAction } from '@/lib/workspace/actions';
import type { DaPageTemplate, DaRecipient } from '@/lib/workspace/types';
import { Button, CopyButton, Dialog, Field, Input, Select } from './ui';

export function GeneratePageTokenButton({
  recipients,
  pageTemplates,
  presetRecipientId,
  presetPageTemplateId,
  baseUrl,
}: {
  recipients: DaRecipient[];
  pageTemplates: DaPageTemplate[];
  presetRecipientId?: string;
  presetPageTemplateId?: string;
  baseUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!baseUrl || recipients.length === 0 || pageTemplates.length === 0}
      >
        Generate token
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Generate page token">
        <form
          className="space-y-4"
          action={(fd) => {
            setError(null);
            setUrl(null);
            startTransition(async () => {
              const result = await generatePageTokenAction(fd);
              if (!result.ok) setError(result.error);
              else setUrl(String(result.data?.url ?? ''));
            });
          }}
        >
          <Field label="Recipient">
            <Select name="recipient_id" required defaultValue={presetRecipientId ?? ''}>
              <option value="" disabled>
                Select recipient
              </option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Page template">
            <Select name="page_template_id" required defaultValue={presetPageTemplateId ?? ''}>
              <option value="" disabled>
                Select page
              </option>
              {pageTemplates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Expiry (optional)">
            <Input name="expires_at" type="datetime-local" />
          </Field>
          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          {url && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--ws-border)] p-3">
              <code className="min-w-0 flex-1 truncate text-xs text-[var(--ws-accent)]">{url}</code>
              <CopyButton value={url} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Generate'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function PageTokenActions({
  id,
  url,
  expiresAt,
}: {
  id: string;
  url: string;
  expiresAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [expiry, setExpiry] = useState(
    expiresAt ? new Date(expiresAt).toISOString().slice(0, 16) : '',
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton value={url} />
      <form
        className="flex items-center gap-1"
        action={(fd) => {
          startTransition(async () => {
            await updatePageTokenAction(fd);
          });
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="set_expiry" />
        <Input
          name="expires_at"
          type="datetime-local"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className="w-auto"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Set expiry
        </Button>
      </form>
      <form
        action={(fd) => {
          startTransition(async () => {
            await updatePageTokenAction(fd);
          });
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="clear_expiry" />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          Clear expiry
        </Button>
      </form>
      <form
        action={(fd) => {
          startTransition(async () => {
            await updatePageTokenAction(fd);
          });
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="revoke" />
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          Revoke
        </Button>
      </form>
    </div>
  );
}
