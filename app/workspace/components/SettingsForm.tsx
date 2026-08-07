'use client';

import { useState, useTransition } from 'react';
import { saveSettingsAction } from '@/lib/workspace/actions';
import type { DaSettings } from '@/lib/workspace/types';
import { Button, Field, Input, SecretInput, Toggle, ws } from './ui';

export default function SettingsForm({ settings }: { settings: DaSettings }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={`${ws.card} space-y-5 p-5 sm:p-7`}
      action={(fd) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await saveSettingsAction(fd);
          if (!result.ok) setError(result.error);
          else setMessage(result.message);
        });
      }}
    >
      <Field
        label="DocuSeal API key"
        hint="Used to pull templates, agreements and submitted values, and to pre-fill forms. Falls back to DOCUSEAL_API_KEY on the deploy when left blank."
      >
        <SecretInput name="docuseal_api_key" defaultValue={settings.docuseal_api_key} />
      </Field>
      <Field label="DocuSeal account identifier">
        <Input name="docuseal_account_id" defaultValue={settings.docuseal_account_id} />
      </Field>
      <Field label="DocuSeal webhook secret">
        <SecretInput name="docuseal_webhook_secret" defaultValue={settings.docuseal_webhook_secret} />
      </Field>
      <Field label="Default booking URL">
        <Input
          name="default_booking_url"
          type="url"
          defaultValue={settings.default_booking_url}
          placeholder="https://…"
        />
      </Field>
      <Field
        label="Public base URL"
        hint="Used to construct token links, e.g. https://admin.divineacquisition.io"
      >
        <Input
          name="public_base_url"
          type="url"
          defaultValue={settings.public_base_url}
          placeholder="https://admin.divineacquisition.io"
        />
      </Field>

      <div className="space-y-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-accent)]">
          Company countersign (VA / operator agreements)
        </p>
        <p className="text-sm text-[var(--ws-dim)]">
          Prefills Authorized Rep / Company Signature fields the way Novara maps VA contractor docs.
        </p>
        <Field label="Company name">
          <Input
            name="company_name"
            defaultValue={settings.company_name}
            placeholder="Divine Acquisition"
          />
        </Field>
        <Field label="Representative name">
          <Input name="company_rep" defaultValue={settings.company_rep} placeholder="Malik Sannie" />
        </Field>
        <Field label="Representative email">
          <Input
            name="company_email"
            type="email"
            defaultValue={settings.company_email}
            placeholder="malik@divineacquisition.io"
          />
        </Field>
        <Field label="Title">
          <Input name="company_title" defaultValue={settings.company_title} placeholder="Owner" />
        </Field>
      </div>

      <div className="space-y-3 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-page)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ws-accent)]">
          Automatic field mapping
        </p>
        <Toggle
          name="auto_prefill"
          defaultChecked={settings.auto_prefill}
          label="Pre-fill fields before signing"
          hint="Maps every template field from the recipient record and their earlier answers, on send and on every pull."
        />
        <Toggle
          name="prefill_readonly"
          defaultChecked={settings.prefill_readonly}
          label="Lock pre-filled values"
          hint="Signers cannot correct what was filled for them. Tokenized page links are always locked."
        />
      </div>

      {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
      {message && <p className="text-sm text-[var(--ws-success)]">{message}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
