'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { METRIC_CATEGORIES, METRIC_SOURCES, METRIC_UNITS } from '@/lib/sales-workspace/types';
import { saveMetricAction } from '@/lib/workspace/sales-ops-actions';
import type { MetricRow } from '@/lib/workspace/sales-ops-queries';
import { Field, Input, Select, Textarea, Toggle } from '../../components/ui';
import ActionForm from './ActionForm';

export default function MetricEditor({ metric }: { metric?: MetricRow }) {
  const router = useRouter();
  const [source, setSource] = useState(metric?.source ?? 'operator');

  return (
    <ActionForm
      action={saveMetricAction}
      submitLabel={metric ? 'Save metric' : 'Add metric'}
      className="space-y-4"
      resetOnSuccess={!metric}
      onDone={(r) => {
        if (r.ok) router.refresh();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Key" hint={metric ? 'Fixed once created.' : 'Lowercase, underscores. Fixed once created.'}>
          {metric ? (
            <>
              <input type="hidden" name="key" value={metric.key} />
              <Input value={metric.key} disabled readOnly />
            </>
          ) : (
            <Input name="key" pattern="[a-z][a-z0-9_]*" placeholder="voicemails_left" required />
          )}
        </Field>
        <Field label="Label">
          <Input name="label" defaultValue={metric?.label ?? ''} required />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={metric?.category ?? 'outbound'}>
            {METRIC_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source">
          <Select name="source" value={source} onChange={(e) => setSource(e.target.value)}>
            {METRIC_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unit">
          <Select name="unit" defaultValue={metric?.unit ?? 'count'}>
            {METRIC_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Order">
          <Input name="sort_order" type="number" defaultValue={metric?.sort_order ?? 1000} />
        </Field>
      </div>
      <Field label="Description">
        <Textarea name="description" rows={2} defaultValue={metric?.description ?? ''} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        {source === 'ghl' ? (
          <p className="text-sm text-[var(--ws-dim)]">GHL-only. Operators cannot edit it.</p>
        ) : (
          <Toggle name="operator_editable" label="Operator logs it" defaultChecked={metric?.operator_editable ?? true} />
        )}
        <Toggle name="by_outcome" label="Counted per positive outcome" defaultChecked={metric?.by_outcome ?? false} />
        <Toggle name="active" label="Active" defaultChecked={metric?.active ?? true} />
      </div>
    </ActionForm>
  );
}
