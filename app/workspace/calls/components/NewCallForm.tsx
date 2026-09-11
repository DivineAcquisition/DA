'use client';

import { useState, useTransition } from 'react';
import { createCallAction } from '@/lib/workspace/call-actions';
import {
  CALL_ROLES,
  FRONT_DESK_SIZES,
  PRACTICE_TYPES,
  callRoleLabel,
  frontDeskLabel,
  practiceTypeLabel,
} from '@/lib/workspace/calls';
import { Button, Field, Input, Select, Textarea, ws } from '../../components/ui';

export default function NewCallForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={`${ws.card} space-y-4 p-5 sm:p-6`}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createCallAction(formData);
          if (result && !result.ok) setError(result.error);
        });
      }}
    >
      <Field label="Contact name">
        <Input name="contact_name" required autoComplete="name" />
      </Field>
      <Field label="Practice name">
        <Input name="practice_name" required />
      </Field>
      <Field label="Practice type">
        <Select name="practice_type" required defaultValue="">
          <option value="" disabled>
            Select type
          </option>
          {PRACTICE_TYPES.map((type) => (
            <option key={type} value={type}>
              {practiceTypeLabel(type)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Role">
        <Select name="role" required defaultValue="">
          <option value="" disabled>
            Select role
          </option>
          {CALL_ROLES.map((role) => (
            <option key={role} value={role}>
              {callRoleLabel(role)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Front desk size">
        <Select name="front_desk_size" required defaultValue="">
          <option value="" disabled>
            Select size
          </option>
          {FRONT_DESK_SIZES.map((size) => (
            <option key={size} value={size}>
              {frontDeskLabel(size)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" autoComplete="tel" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" />
      </Field>
      <Field label="Stated pain">
        <Textarea name="stated_pain" placeholder="From the lead form" />
      </Field>
      <Field label="Source">
        <Input name="source" />
      </Field>
      {error && <p className="text-sm text-[var(--ws-error)]">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating…' : 'Create call'}
      </Button>
    </form>
  );
}
