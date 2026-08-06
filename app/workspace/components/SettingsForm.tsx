'use client';

import { useState, useTransition } from 'react';
import { saveSettingsAction } from '@/lib/workspace/actions';
import type { DaSettings } from '@/lib/workspace/types';
import { Button, Field, Input, SecretInput, ws } from './ui';

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
      <Field label="DocuSeal API key">
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
