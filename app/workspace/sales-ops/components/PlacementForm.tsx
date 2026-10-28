'use client';

import { useRouter } from 'next/navigation';
import { DAY_NAMES } from '@/lib/portal/labels';
import { ACTIVITY_CATEGORIES, PLACEMENT_TYPES } from '@/lib/sales-workspace/types';
import { savePlacementAction } from '@/lib/workspace/sales-ops-actions';
import type { PlacementFormOptions, PlacementRow } from '@/lib/workspace/sales-ops-queries';
import { Card, Field, Input, Select, Textarea, Toggle } from '../../components/ui';
import ActionForm, { CheckboxGroup } from './ActionForm';

const TIME_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Toronto',
  'Asia/Manila',
  'Europe/London',
  'UTC',
];

const DAYS = DAY_NAMES.map((label, i) => ({ value: String(i + 1), label }));

export default function PlacementForm({
  options,
  placement,
}: {
  options: PlacementFormOptions;
  placement?: PlacementRow;
}) {
  const router = useRouter();
  const p = placement;
  const zones = p && !TIME_ZONES.includes(p.time_zone) ? [p.time_zone, ...TIME_ZONES] : TIME_ZONES;
  const locked = Boolean(p && (p.status === 'ended' || p.status === 'renewed'));

  return (
    <Card className="p-5 sm:p-7">
      <ActionForm
        submitLabel={p ? 'Save placement' : 'Create placement'}
        readOnly={locked}
        action={async (fd) => {
          const r = await savePlacementAction(fd);
          if (r.ok && !p && r.id) router.push(`/workspace/sales-ops/placements/${r.id}`);
          else if (r.ok) router.refresh();
          return r;
        }}
      >
        {p ? <input type="hidden" name="id" value={p.id} /> : null}

        <fieldset disabled={locked} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Operator" hint="Only operators with Academy Level 1 or higher can enter the workspace.">
              <Select name="operator_id" defaultValue={p?.operator_id ?? ''} required>
                <option value="" disabled>
                  Choose an operator
                </option>
                {options.operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.certified ? '' : ' (not certified)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Client">
              <Select name="case_file_id" defaultValue={p?.case_file_id ?? ''} required>
                <option value="" disabled>
                  Choose a client
                </option>
                {options.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Placement type">
              <Select name="placement_type" defaultValue={p?.placement_type ?? ''} required>
                <option value="" disabled>
                  Choose a type
                </option>
                {PLACEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assigned manager" hint="Sees this operator's workspace. Leave blank for DA Admin only.">
              <Select name="manager_profile_id" defaultValue={p?.manager_profile_id ?? ''}>
                <option value="">No manager yet</option>
                {options.managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role === 'manager' ? '' : ' (DA Admin)'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date">
              <Input type="date" name="start_date" defaultValue={p?.start_date ?? ''} required />
            </Field>
            <Field label="Term end" hint="Blank sets three months from the start.">
              <Input type="date" name="end_date" defaultValue={p?.end_date ?? ''} />
            </Field>
          </div>

          <div className="space-y-4 rounded-xl border border-white/[0.06] bg-ink-850/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300">Shift</p>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Time zone">
                <Select name="time_zone" defaultValue={p?.time_zone ?? 'America/New_York'}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Shift start">
                <Input type="time" name="shift_start" defaultValue={p?.shift_start ?? '09:00'} required />
              </Field>
              <Field label="Shift end">
                <Input type="time" name="shift_end" defaultValue={p?.shift_end ?? '17:00'} required />
              </Field>
              <Field label="EOD deadline" hint="Blank uses the shift end.">
                <Input type="time" name="eod_deadline" defaultValue={p?.eod_deadline ?? ''} />
              </Field>
            </div>
            <Field label="Working days">
              <CheckboxGroup
                name="working_days"
                options={DAYS}
                selected={(p?.working_days ?? [1, 2, 3, 4, 5]).map(String)}
              />
            </Field>
          </div>

          <Field label="Activity categories" hint="Pick at least one. These decide which metrics the operator logs.">
            <CheckboxGroup
              name="activity_categories"
              options={ACTIVITY_CATEGORIES}
              selected={p?.activity_categories ?? []}
            />
          </Field>

          <Field label="Offer and campaign summary" hint="What the operator is selling, to whom, and how.">
            <Textarea name="campaign_summary" rows={4} defaultValue={p?.campaign_summary ?? ''} />
          </Field>

          <Toggle
            name="tracks_results"
            label="Track show rate and closes"
            hint="Off by default. Turn on only when the client shares results."
            defaultChecked={p?.tracks_results ?? false}
          />
        </fieldset>
      </ActionForm>
    </Card>
  );
}
