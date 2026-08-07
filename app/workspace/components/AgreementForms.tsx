'use client';

import { useRef, useState, useTransition } from 'react';
import {
  downloadSignedDocumentAction,
  previewAgreementFieldsAction,
  resendAgreementAction,
  sendAgreementAction,
  voidAgreementAction,
} from '@/lib/workspace/actions';
import type { MappedField, mappingSummary } from '@/lib/workspace/field-mapping';
import type { DaAgreementTemplate, DaRecipient } from '@/lib/workspace/types';
import { Button, CopyButton, Dialog, Field, Select, ws } from './ui';

type Preview = {
  fields: MappedField[];
  summary: ReturnType<typeof mappingSummary>;
};

/** What the recipient will find already filled in when the form opens. */
function PrefillPreview({ preview, loading }: { preview: Preview | null; loading: boolean }) {
  if (loading) {
    return <p className="text-sm text-[var(--ws-dim)]">Mapping fields…</p>;
  }
  if (!preview) return null;
  if (preview.summary.total === 0) {
    return (
      <p className="text-sm text-[var(--ws-dim)]">
        This template has no field catalogue yet. Pull from DocuSeal to load its fields.
      </p>
    );
  }

  const filled = preview.fields.filter((field) => field.value);
  return (
    <div className="rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-accent)]">
        Pre-filled before signing · {preview.summary.filled} of {preview.summary.total}
      </p>
      <dl className="mt-2.5 max-h-52 space-y-1.5 overflow-y-auto text-[13px]">
        {filled.map((field) => (
          <div key={field.name} className="flex justify-between gap-4">
            <dt className="text-[var(--ws-dim)]">{field.name}</dt>
            <dd className="truncate text-white">{field.value}</dd>
          </div>
        ))}
      </dl>
      {preview.summary.unmapped.length > 0 && (
        <p className="mt-2.5 text-xs text-[var(--ws-pending)]">
          Left for the signer: {preview.summary.unmapped.join(', ')}
        </p>
      )}
    </div>
  );
}

export function SendAgreementButton({
  recipients,
  templates,
  presetRecipientId,
}: {
  recipients: DaRecipient[];
  templates: DaAgreementTemplate[];
  presetRecipientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(presetRecipientId ?? '');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  /** Ask the server what it would fill in, ignoring answers to stale asks. */
  const loadPreview = (nextRecipientId: string, nextTemplateId: string) => {
    const id = requestId.current + 1;
    requestId.current = id;

    if (!nextRecipientId || !nextTemplateId) {
      setPreview(null);
      setPreviewing(false);
      return;
    }

    setPreviewing(true);
    const fd = new FormData();
    fd.set('recipient_id', nextRecipientId);
    fd.set('template_id', nextTemplateId);
    previewAgreementFieldsAction(fd)
      .then((result) => {
        if (requestId.current !== id) return;
        setPreview(result.ok ? (result.data as unknown as Preview) : null);
      })
      .finally(() => {
        if (requestId.current === id) setPreviewing(false);
      });
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setOpen(true);
          loadPreview(recipientId, templateId);
        }}
        disabled={recipients.length === 0 || templates.length === 0}
      >
        Send agreement
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Send agreement">
        <form
          className="space-y-4"
          action={(fd) => {
            setError(null);
            setMessage(null);
            startTransition(async () => {
              const result = await sendAgreementAction(fd);
              if (!result.ok) setError(result.error);
              else {
                setMessage(result.message);
                setOpen(false);
              }
            });
          }}
        >
          <Field label="Recipient">
            <Select
              name="recipient_id"
              required
              value={recipientId}
              onChange={(event) => {
                setRecipientId(event.target.value);
                loadPreview(event.target.value, templateId);
              }}
            >
              <option value="" disabled>
                Select recipient
              </option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.full_name} ({r.recipient_type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Template">
            <Select
              name="template_id"
              required
              value={templateId}
              onChange={(event) => {
                setTemplateId(event.target.value);
                loadPreview(recipientId, event.target.value);
              }}
            >
              <option value="" disabled>
                Select template
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <PrefillPreview preview={preview} loading={previewing} />

          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          {message && <p className={`text-sm text-[var(--ws-success)] ${ws.heading}`}>{message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function AgreementActions({
  agreementId,
  status,
  signingUrl,
}: {
  agreementId: string;
  status: string;
  signingUrl: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {signingUrl && <CopyButton value={signingUrl} label="Copy link" />}
      <form
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const result = await resendAgreementAction(fd);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <input type="hidden" name="agreement_id" value={agreementId} />
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          Resend
        </Button>
      </form>
      <form
        action={(fd) => {
          setError(null);
          startTransition(async () => {
            const result = await voidAgreementAction(fd);
            if (!result.ok) setError(result.error);
          });
        }}
      >
        <input type="hidden" name="agreement_id" value={agreementId} />
        <Button type="submit" variant="danger" size="sm" disabled={pending || status === 'declined'}>
          Void
        </Button>
      </form>
      {status === 'completed' && (
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const result = await downloadSignedDocumentAction(fd);
              if (!result.ok) setError(result.error);
              else if (result.data?.url) window.open(String(result.data.url), '_blank');
            });
          }}
        >
          <input type="hidden" name="agreement_id" value={agreementId} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            Download
          </Button>
        </form>
      )}
      {error && <span className="text-xs text-[var(--ws-error)]">{error}</span>}
    </div>
  );
}
