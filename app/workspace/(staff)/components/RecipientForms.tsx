'use client';

import { useState, useTransition } from 'react';
import { createRecipientAction, updateRecipientAction } from '@/lib/workspace/actions';
import type { DaRecipient } from '@/lib/workspace/types';
import { Button, Dialog, Field, Input, Select, Textarea } from './ui';

function RecipientFields({ recipient }: { recipient?: DaRecipient }) {
  const [type, setType] = useState(recipient?.recipient_type ?? 'client');
  return (
    <div className="space-y-4">
      {recipient && <input type="hidden" name="id" value={recipient.id} />}
      <Field label="Full name">
        <Input name="full_name" required defaultValue={recipient?.full_name} />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required defaultValue={recipient?.email} />
      </Field>
      <Field label="Phone">
        <Input name="phone" defaultValue={recipient?.phone ?? ''} />
      </Field>
      <Field label="Type">
        <Select
          name="recipient_type"
          value={type}
          onChange={(e) => setType(e.target.value as 'client' | 'operator')}
        >
          <option value="client">Client</option>
          <option value="operator">Operator</option>
        </Select>
      </Field>
      {type === 'client' && (
        <Field label="Business name">
          <Input name="business_name" required defaultValue={recipient?.business_name ?? ''} />
        </Field>
      )}
      <Field label="Status">
        <Select name="status" defaultValue={recipient?.status ?? 'active'}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </Field>
      <Field label="Notes">
        <Textarea name="notes" defaultValue={recipient?.notes ?? ''} />
      </Field>
    </div>
  );
}

export function CreateRecipientButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        New recipient
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New recipient">
        <form
          className="space-y-5"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const result = await createRecipientAction(fd);
              if (!result.ok) setError(result.error);
              else setOpen(false);
            });
          }}
        >
          <RecipientFields />
          {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function EditRecipientButton({ recipient }: { recipient: DaRecipient }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit recipient">
        <form
          className="space-y-5"
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const result = await updateRecipientAction(fd);
              if (!result.ok) setError(result.error);
              else setOpen(false);
            });
          }}
        >
          <RecipientFields recipient={recipient} />
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
