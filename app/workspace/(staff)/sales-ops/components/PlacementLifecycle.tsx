'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, Field, Input, Textarea } from '../../components/ui';
import { editPlacementAction, placementLifecycleAction, swapPlacementAction } from '@/lib/placement/actions';
import type { OfferBrief } from '@/lib/placement/offer';

export default function PlacementLifecycle({
  placementId,
  status,
  offer,
}: {
  placementId: string;
  status: string;
  offer: Partial<OfferBrief>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string; wizardId?: string }>, after?: (result: { wizardId?: string }) => void) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.error ?? 'That change did not save.');
        return;
      }
      setMessage('Saved.');
      after?.(result);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 text-sm">
      {error ? <p className="text-amber-200">{error}</p> : null}
      {message ? <p className="text-emerald-200">{message}</p> : null}
      {status === 'active' ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => placementLifecycleAction(placementId, 'pause', { reason: data.get('reason'), return_on: data.get('return_on'), tell_client: data.get('tell_client') === 'on' }));
          }}
        >
          <h3 className="font-medium text-white">Pause</h3>
          <Field label="Reason">
            <Textarea name="reason" required minLength={8} rows={2} />
          </Field>
          <Field label="Expected return">
            <Input type="date" name="return_on" required />
          </Field>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="tell_client" /> Tell the client
          </label>
          <Button type="submit" variant="secondary" disabled={pending}>
            Pause placement
          </Button>
        </form>
      ) : null}
      {status === 'paused' ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => placementLifecycleAction(placementId, 'resume', { reason: data.get('reason') }));
          }}
        >
          <h3 className="font-medium text-white">Resume</h3>
          <p className="text-neutral-300">End of day starts again on the next working day.</p>
          <Field label="Reason">
            <Textarea name="reason" required minLength={8} rows={2} />
          </Field>
          <Button type="submit" disabled={pending}>
            Resume placement
          </Button>
        </form>
      ) : null}
      {status === 'active' || status === 'paused' || status === 'scheduled' ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(() => placementLifecycleAction(placementId, 'end', { reason: data.get('reason'), last_day: data.get('last_day') }));
          }}
        >
          <h3 className="font-medium text-white">End</h3>
          <Field label="Last day">
            <Input type="date" name="last_day" required />
          </Field>
          <Field label="Reason">
            <Textarea name="reason" required minLength={8} rows={2} />
          </Field>
          <Button type="submit" variant="danger" disabled={pending}>
            End placement
          </Button>
        </form>
      ) : null}
      {status === 'active' || status === 'paused' || status === 'scheduled' ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            run(
              () => swapPlacementAction(placementId, { reason: data.get('reason'), last_day: data.get('last_day') }),
              (result) => {
                if (result.wizardId) router.push(`/workspace/sales-ops/placements/new?draft=${result.wizardId}`);
              },
            );
          }}
        >
          <h3 className="font-medium text-white">Swap operator</h3>
          <p className="text-neutral-300">Ends this placement on the last day and opens a draft for the same client, without the operator.</p>
          <Field label="Last day">
            <Input type="date" name="last_day" required />
          </Field>
          <Field label="Reason">
            <Textarea name="reason" required minLength={8} rows={2} />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending}>
            Swap
          </Button>
        </form>
      ) : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          run(() =>
            editPlacementAction(placementId, {
              reason: data.get('reason'),
              schedule: {
                shift_start: data.get('shift_start'),
                shift_end: data.get('shift_end'),
                eod_deadline: data.get('eod_deadline'),
              },
              offer: { ...offer, one_liner: data.get('one_liner') },
            }),
          );
        }}
      >
        <h3 className="font-medium text-white">Edit</h3>
        <p className="text-neutral-300">On a live placement, the shift and deadline change on the next working day. The offer changes now.</p>
        <Field label="Reason">
          <Textarea name="reason" required minLength={8} rows={2} />
        </Field>
        <Field label="Shift start">
          <Input type="time" name="shift_start" />
        </Field>
        <Field label="Shift end">
          <Input type="time" name="shift_end" />
        </Field>
        <Field label="EOD deadline">
          <Input type="time" name="eod_deadline" />
        </Field>
        <Field label="Business in one line">
          <Input name="one_liner" defaultValue={offer.one_liner ?? ''} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>
          Save edit
        </Button>
      </form>
    </div>
  );
}
