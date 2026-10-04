'use client';

import { useState } from 'react';
import { satisfyGate } from '@/lib/academy/quizAdmin';
import { Button, Field, Input, Select } from '../../../components/ui';

export default function GateForm({ parts }: { parts: { id: string; label: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <form
      className="space-y-3 rounded-2xl border border-white/10 p-4"
      action={(formData) => {
        setError(null);
        setDone(false);
        void satisfyGate(formData).then((result) => {
          if (!result.ok) setError(result.error ?? 'The requirement was not marked.');
          else setDone(true);
        });
      }}
    >
      <h2 className="text-sm font-semibold text-white">Mark a pending requirement satisfied</h2>
      <p className="text-sm text-neutral-400">A note is required. This is a bridge until that requirement has its own flow.</p>
      <Field label="Trainee email">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Requirement">
        <Select name="part_id" defaultValue={parts[0]?.id}>
          {parts.map((part) => (
            <option key={part.id} value={part.id}>
              {part.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Note">
        <Input name="note" required />
      </Field>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {done ? <p className="text-sm text-neutral-300">Recorded.</p> : null}
      <Button type="submit" variant="secondary">
        Mark satisfied
      </Button>
    </form>
  );
}
