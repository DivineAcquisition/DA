'use client';

import { useState, useTransition } from 'react';
import {
  downloadSignedDocumentAction,
  resendAgreementAction,
  sendAgreementAction,
  voidAgreementAction,
} from '@/lib/workspace/actions';
import type { DaAgreementTemplate, DaRecipient } from '@/lib/workspace/types';
import { Button, CopyButton, Dialog, Field, Select } from './ui';

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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} disabled={recipients.length === 0 || templates.length === 0}>
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
            <Select name="recipient_id" required defaultValue={presetRecipientId ?? ''}>
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
            <Select name="template_id" required defaultValue="">
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
          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          {message && <p className="text-sm text-[var(--ws-success)]">{message}</p>}
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
