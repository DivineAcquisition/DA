'use client';

import { useRouter } from 'next/navigation';
import { PLACEMENT_TYPES } from '@/lib/sales-workspace/types';
import { setDefaultTargetAction } from '@/lib/workspace/sales-ops-actions';
import type { MetricRow } from '@/lib/workspace/sales-ops-queries';
import { Card, Field, Input, Select } from '../../components/ui';
import ActionForm from './ActionForm';

export default function DefaultTargetForm({ metrics, today }: { metrics: MetricRow[]; today: string }) {
  const router = useRouter();
  return (
    <Card className="p-5 sm:p-7">
      <ActionForm
        action={setDefaultTargetAction}
        submitLabel="Set target"
        className="space-y-4"
        resetOnSuccess
        onDone={(r) => {
          if (r.ok) router.refresh();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Metric">
            <Select name="metric_key" defaultValue="" required>
              <option value="" disabled>
                Choose a metric
              </option>
              {metrics.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Applies to" hint="A type-specific target wins over the all-types one.">
            <Select name="placement_type" defaultValue="">
              <option value="">All placement types</option>
              {PLACEMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} only
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Effective from" hint="Today or later. Past days keep their old target.">
            <Input type="date" name="effective_from" min={today} defaultValue={today} />
          </Field>
          <Field label="Daily target">
            <Input name="daily" inputMode="decimal" placeholder="Blank for none" />
          </Field>
          <Field label="Weekly target">
            <Input name="weekly" inputMode="decimal" placeholder="Blank for none" />
          </Field>
          <Field label="Note">
            <Input name="note" placeholder="Why this number" />
          </Field>
        </div>
        <p className="text-xs text-[var(--ws-dim)]">Leave both targets blank to clear the target from that date.</p>
      </ActionForm>
    </Card>
  );
}
