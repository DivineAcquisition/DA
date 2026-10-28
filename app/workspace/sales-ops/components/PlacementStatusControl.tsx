'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { NEXT_STATUSES, STATUS_LABEL } from '@/lib/sales-workspace/view';
import type { WorkspaceStatus } from '@/lib/sales-workspace/types';
import { setPlacementStatusAction } from '@/lib/workspace/sales-ops-actions';
import { Button, Field, Input } from '../../components/ui';
import { FormResult } from './ActionForm';

const VERB: Record<WorkspaceStatus, string> = {
  pending: 'Back to pending',
  active: 'Activate',
  paused: 'Pause',
  ended: 'End placement',
};

export default function PlacementStatusControl({
  placementId,
  status,
  activeOutcomes,
}: {
  placementId: string;
  status: WorkspaceStatus;
  activeOutcomes: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const next = NEXT_STATUSES[status];

  if (next.length === 0) {
    return <p className="text-sm text-[var(--ws-dim)]">This placement has ended. Its status no longer changes.</p>;
  }

  const blockActivate = next.includes('active') && activeOutcomes === 0;

  return (
    <div className="space-y-4">
      <Field label="Reason" hint="Saved to the audit log with the change.">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      </Field>
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <Button
            key={s}
            type="button"
            variant={s === 'ended' ? 'danger' : s === 'active' ? 'primary' : 'secondary'}
            disabled={pending || (s === 'active' && blockActivate)}
            onClick={() => {
              if (s === 'ended' && !window.confirm('End this placement? Workspace access closes and it cannot reopen.')) return;
              setResult(null);
              startTransition(async () => {
                const r = await setPlacementStatusAction(placementId, s, reason.trim());
                setResult(r.ok ? { ok: true, message: `Placement is now ${STATUS_LABEL[s]}.` } : r);
                if (r.ok) {
                  setReason('');
                  router.refresh();
                }
              });
            }}
          >
            {VERB[s]}
          </Button>
        ))}
      </div>
      {blockActivate ? (
        <p className="text-sm text-flag-warning">
          Cannot activate yet. Add at least one active positive outcome below. The operator&apos;s day is measured against it.
        </p>
      ) : null}
      <FormResult result={result} />
    </div>
  );
}
