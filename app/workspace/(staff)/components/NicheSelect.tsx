'use client';

import { type ChangeEvent } from 'react';
import { NICHE_GROUPS, nicheLabel, type WorkspaceNiche } from '@/lib/workspace/niches';
import { Field, Select } from './ui';

export default function NicheSelect({
  name = 'niche',
  value,
  defaultValue,
  onChange,
  required = true,
  label = 'Niche',
  id,
}: {
  name?: string;
  value?: WorkspaceNiche | '';
  defaultValue?: string;
  onChange?: (niche: WorkspaceNiche | '') => void;
  required?: boolean;
  label?: string;
  id?: string;
}) {
  const select = (
    <Select
      id={id}
      name={name}
      required={required}
      {...(onChange
        ? {
            value: value ?? '',
            onChange: (event: ChangeEvent<HTMLSelectElement>) =>
              onChange((event.target.value as WorkspaceNiche | '') || ''),
          }
        : { defaultValue: defaultValue ?? '' })}
    >
      <option value="" disabled>
        Select niche
      </option>
      {NICHE_GROUPS.map((group) => (
        <optgroup key={group.family} label={group.label}>
          {group.niches.map((niche) => (
            <option key={niche} value={niche}>
              {nicheLabel(niche)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );

  if (!label) return select;
  return <Field label={label}>{select}</Field>;
}
