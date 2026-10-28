'use client';

import { useRouter } from 'next/navigation';
import { saveOutcomeAction } from '@/lib/workspace/sales-ops-actions';
import type { OutcomeRow } from '@/lib/workspace/sales-ops-queries';
import { Badge, Field, Input, Toggle } from '../../components/ui';
import ActionForm from './ActionForm';

function OutcomeFields({ outcome }: { outcome?: OutcomeRow }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_2fr_6rem]">
      <Field label="Name">
        <Input name="name" defaultValue={outcome?.name ?? ''} placeholder="Appointment booked" required />
      </Field>
      <Field label="What counts">
        <Input
          name="definition"
          defaultValue={outcome?.definition ?? ''}
          placeholder="A date and time on the client's calendar, confirmed by the lead."
          required
        />
      </Field>
      <Field label="Order">
        <Input name="sort_order" type="number" defaultValue={outcome?.sort_order ?? 100} />
      </Field>
    </div>
  );
}

export default function OutcomeEditor({
  placementId,
  outcomes,
  readOnly,
}: {
  placementId: string;
  outcomes: OutcomeRow[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const refresh = (r: { ok: boolean }) => {
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-4">
      {outcomes.length === 0 ? (
        <p className="text-sm text-[var(--ws-dim)]">No positive outcomes yet. Add the first one below.</p>
      ) : null}
      {outcomes.map((o) => (
        <details key={o.id} className="rounded-xl border border-white/[0.06] bg-ink-850/60 p-4">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm text-card-foreground">
            <span className="font-medium">{o.name}</span>
            {o.active ? <Badge tone="success">Active</Badge> : <Badge>Retired</Badge>}
            <span className="w-full text-[var(--ws-dim)] sm:w-auto">{o.definition}</span>
          </summary>
          <ActionForm action={saveOutcomeAction} submitLabel="Save outcome" className="mt-4 space-y-4" onDone={refresh} readOnly={readOnly}>
            <input type="hidden" name="placement_id" value={placementId} />
            <input type="hidden" name="id" value={o.id} />
            <OutcomeFields outcome={o} />
            <Toggle name="active" label="Active" hint="Retire instead of deleting so past days still read correctly." defaultChecked={o.active} />
          </ActionForm>
        </details>
      ))}
      {readOnly ? null : (
        <div className="rounded-xl border border-dashed border-white/[0.12] p-4">
          <p className="mb-4 text-sm font-medium text-card-foreground">Add a positive outcome</p>
          <ActionForm action={saveOutcomeAction} submitLabel="Add outcome" className="space-y-4" onDone={refresh} resetOnSuccess>
            <input type="hidden" name="placement_id" value={placementId} />
            <input type="hidden" name="active" value="on" />
            <OutcomeFields />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
