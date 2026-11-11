'use client';

import { useActionState, useState } from 'react';
import type { ActionResult } from '@/lib/ad/rpc';
import { logCallAction, updateLeadAction } from '@/lib/pipeline/actions';
import { CALL_OUTCOMES, STAGE_LABEL, STAGES } from '@/lib/pipeline/desk';
import { area, field, primary, secondary } from '../../components/desk';

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? 'text-flag-good' : 'text-flag-critical'}`}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function localNow(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function LogCallForm({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(logCallAction.bind(null, leadId), null);
  const [stamp] = useState(localNow);
  const [offset] = useState(() => String(new Date().getTimezoneOffset()));
  return (
    <form action={action} className="space-y-3" key={state?.ok ? 'done' : 'open'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] text-neutral-400">
          What happened
          <select name="outcome" required defaultValue="held" className={`${field} mt-1.5 w-full`}>
            {CALL_OUTCOMES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px] text-neutral-400">
          When
          <input type="datetime-local" name="occurred_at" defaultValue={stamp} className={`${field} mt-1.5 w-full`} />
        </label>
      </div>
      <input type="hidden" name="tz_offset" value={offset} />
      <label className="block text-[13px] text-neutral-400">
        Notes
        <textarea name="notes" maxLength={20000} placeholder="Their sales process, the gaps, what they want, next step." className={`${area} mt-1.5 w-full`} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className={primary} disabled={pending}>
          {pending ? 'Logging…' : 'Log the call'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function LeadForm({ leadId, stage, nextAction, notes }: { leadId: string; stage: string; nextAction: string; notes: string }) {
  const [state, action, pending] = useActionState(updateLeadAction.bind(null, leadId), null);
  const options = (STAGES as readonly string[]).includes(stage) ? STAGES : [stage, ...STAGES];
  return (
    <form action={action} className="space-y-3">
      <label className="block text-[13px] text-neutral-400">
        Stage
        <select name="stage" defaultValue={stage} className={`${field} mt-1.5 w-full`}>
          {options.map((value) => (
            <option key={value} value={value}>
              {STAGE_LABEL[value] ?? value}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[13px] text-neutral-400">
        Next step
        <input name="next_action" defaultValue={nextAction} maxLength={500} className={`${field} mt-1.5 w-full`} />
      </label>
      <label className="block text-[13px] text-neutral-400">
        Notes
        <textarea name="notes" defaultValue={notes} maxLength={20000} className={`${area} mt-1.5 w-full`} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className={secondary} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}
