'use client';

import { useState, useTransition } from 'react';
import { saveFieldMappingAction } from '@/lib/workspace/actions';
import { PROFILE_FIELDS, type MappedField } from '@/lib/workspace/field-mapping';
import { Badge, Button, Input, Select } from './ui';

const ORIGIN_LABEL: Record<MappedField['origin'], string> = {
  page: 'Tokenized page',
  override: 'Override',
  submitted: 'Previously submitted',
  profile: 'Auto-mapped',
  none: 'No match',
  skipped: 'Signer completes',
};

const ORIGIN_TONE: Record<MappedField['origin'], 'accent' | 'success' | 'pending' | 'neutral'> = {
  page: 'accent',
  override: 'accent',
  submitted: 'success',
  profile: 'success',
  none: 'pending',
  skipped: 'neutral',
};

export function MappingOriginBadge({ origin }: { origin: MappedField['origin'] }) {
  return <Badge tone={ORIGIN_TONE[origin]}>{ORIGIN_LABEL[origin]}</Badge>;
}

/** One row of the mapping table: what auto-mapping chose, and how to override it. */
export function FieldMappingRow({
  templateId,
  field,
}: {
  templateId: string;
  field: MappedField;
}) {
  const currentKey =
    field.origin === 'override' ? field.sourceKey ?? 'auto' : 'auto';
  const [sourceKey, setSourceKey] = useState(currentKey);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <tr className="align-top hover:bg-white/[0.02]">
      <td className="px-4 py-3">
        <div className="font-medium text-white">{field.name}</div>
        <div className="text-xs text-[var(--ws-dim)]">
          {field.type}
          {field.required ? ' · required' : ''}
        </div>
      </td>
      <td className="px-4 py-3">
        <MappingOriginBadge origin={field.origin} />
        <div className="mt-1 text-xs text-[var(--ws-dim)]">{field.sourceLabel}</div>
      </td>
      <td className="px-4 py-3">
        <span className={field.value ? 'text-white' : 'text-[var(--ws-dim)]'}>
          {field.value ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <form
          className="flex flex-wrap items-center gap-2"
          action={(fd) => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const result = await saveFieldMappingAction(fd);
              if (!result.ok) setError(result.error);
              else setSaved(true);
            });
          }}
        >
          <input type="hidden" name="agreement_template_id" value={templateId} />
          <input type="hidden" name="field_name" value={field.name} />
          <Select
            name="source_key"
            value={sourceKey}
            onChange={(event) => setSourceKey(event.target.value)}
            className="w-44"
          >
            <option value="auto">Automatic</option>
            {PROFILE_FIELDS.map((profile) => (
              <option key={profile.key} value={profile.key}>
                {profile.label}
              </option>
            ))}
            <option value="literal">Fixed value…</option>
            <option value="ignore">Leave for signer</option>
          </Select>
          {sourceKey === 'literal' && (
            <Input name="literal_value" placeholder="Value" className="w-44" required />
          )}
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        </form>
        {error && <p className="mt-1 text-xs text-[var(--ws-error)]">{error}</p>}
      </td>
    </tr>
  );
}
